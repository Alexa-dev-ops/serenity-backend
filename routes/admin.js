const router = require("express").Router();
const { auth, adminOnly } = require("../middleware/auth");
const { queryAll, queryOne, run, saveDB } = require("../db/database");
const { calculateRisk } = require("../utils/risk");

// All admin routes require auth + admin role
router.use(auth, adminOnly);

// GET /api/admin
router.get("/", (req, res) => {
  try {
    const users = queryAll("SELECT id,name,email,role,streak,recovery_focus,created_at FROM users");
    const allCheckins = queryAll("SELECT * FROM checkins ORDER BY created_at DESC LIMIT 200");
    const usersWithRisk = users.map((u) => {
      const uc = allCheckins.filter((c) => c.user_id === u.id);
      return { ...u, risk: calculateRisk(uc, u.streak), checkin_count: uc.length };
    });
    const stats = {
      totalUsers:          users.length,
      totalCheckins:       queryOne("SELECT COUNT(*) as c FROM checkins")?.c || 0,
      totalJournal:        queryOne("SELECT COUNT(*) as c FROM journal_entries")?.c || 0,
      totalNotifications:  queryOne("SELECT COUNT(*) as c FROM notifications")?.c || 0,
      highRiskCount:       usersWithRisk.filter((u) => u.risk.label === "High").length,
    };
    res.json({ users: usersWithRisk, stats });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/admin/users/:id
router.delete("/users/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (id === req.user.id) return res.status(400).json({ error: "Cannot delete yourself" });
    ["checkins", "journal_entries", "notifications", "recovery_plans"].forEach((table) => {
      run(`DELETE FROM ${table} WHERE user_id=?`, [id]);
    });
    run("DELETE FROM users WHERE id=?", [id]);
    saveDB();
    res.json({ message: "User deleted" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/resources
router.post("/resources", (req, res) => {
  try {
    const { category, title, content, read_time_minutes } = req.body;
    if (!category || !title || !content) return res.status(400).json({ error: "category, title, content required" });
    run("INSERT INTO resources (category,title,content,read_time_minutes) VALUES (?,?,?,?)", [
      category, title, content, read_time_minutes || 5,
    ]);
    saveDB();
    res.status(201).json({ message: "Resource added" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/admin/resources/:id
router.delete("/resources/:id", (req, res) => {
  try {
    run("DELETE FROM resources WHERE id=?", [req.params.id]);
    saveDB();
    res.json({ message: "Resource deleted" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/notify — broadcast or send to single user
router.post("/notify", (req, res) => {
  try {
    const { user_id, title, body, type } = req.body;
    if (!title || !body) return res.status(400).json({ error: "title and body required" });
    if (user_id) {
      run("INSERT INTO notifications (user_id,title,body,type) VALUES (?,?,?,?)", [user_id, title, body, type || "system"]);
    } else {
      const users = queryAll("SELECT id FROM users WHERE role != 'admin'");
      users.forEach((u) => {
        run("INSERT INTO notifications (user_id,title,body,type) VALUES (?,?,?,?)", [u.id, title, body, type || "system"]);
      });
    }
    saveDB();
    res.json({ message: "Notification sent" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
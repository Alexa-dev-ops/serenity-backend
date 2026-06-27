const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { queryOne, queryAll } = require("../db/database");
const { calculateRisk } = require("../utils/risk");

// GET /api/dashboard
router.get("/", auth, (req, res) => {
  try {
    const userId = req.user.id;
    const user = queryOne("SELECT id,name,email,role,streak,recovery_focus FROM users WHERE id=?", [userId]);
    if (!user) return res.status(404).json({ error: "User not found" });

    const checkins    = queryAll("SELECT * FROM checkins WHERE user_id=? ORDER BY created_at ASC", [userId]);
    const risk        = calculateRisk(checkins, user.streak);
    const lastCheckin = checkins[checkins.length - 1] || null;
    const journalCount  = queryOne("SELECT COUNT(*) as c FROM journal_entries WHERE user_id=?", [userId])?.c || 0;
    const unreadNotifs  = queryOne("SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND read=0", [userId])?.c || 0;
    const activePlans   = queryAll("SELECT * FROM recovery_plans WHERE user_id=? AND active=1", [userId]);

    res.json({ user, streak: user.streak, risk, lastCheckin, checkins, journalCount, unreadNotifs, activePlans });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
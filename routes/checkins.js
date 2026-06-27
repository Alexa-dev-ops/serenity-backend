const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { queryAll, queryOne, run, saveDB } = require("../db/database");
const { calculateRisk } = require("../utils/risk");

// GET /api/checkins
router.get("/", auth, (req, res) => {
  try {
    const checkins = queryAll(
      "SELECT * FROM checkins WHERE user_id=? ORDER BY created_at DESC LIMIT 30",
      [req.user.id]
    );
    res.json(checkins);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/checkins
router.post("/", auth, (req, res) => {
  try {
    const { mood, urge, notes } = req.body;
    if (mood == null || urge == null) return res.status(400).json({ error: "mood and urge required" });

    run("INSERT INTO checkins (user_id,mood,urge,notes) VALUES (?,?,?,?)", [req.user.id, mood, urge, notes || null]);
    run("UPDATE users SET streak=streak+1 WHERE id=?", [req.user.id]);
    saveDB();

    const checkins = queryAll("SELECT * FROM checkins WHERE user_id=? ORDER BY created_at ASC", [req.user.id]);
    const user = queryOne("SELECT streak FROM users WHERE id=?", [req.user.id]);
    const risk = calculateRisk(checkins, user?.streak || 0);

    // Auto-alert on high risk
    if (risk.label === "High") {
      run("INSERT INTO notifications (user_id,title,body,type) VALUES (?,?,?,?)", [
        req.user.id,
        "High Risk Alert",
        "Your current data indicates elevated relapse risk. Please open AI Support or contact your support anchor.",
        "alert",
      ]);
      saveDB();
    }

    res.status(201).json({ message: "Check-in saved", risk, streak: user?.streak });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
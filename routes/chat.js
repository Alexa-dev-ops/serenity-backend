const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { queryAll, queryOne } = require("../db/database");
const { calculateRisk } = require("../utils/risk");
const { chatWithGemini } = require("../utils/gemini");

const URGE_LABELS = ["None", "Mild", "Moderate", "Strong", "Critical"];

// POST /api/chat
router.post("/", auth, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages?.length) return res.status(400).json({ error: "messages required" });

    const user = queryOne("SELECT * FROM users WHERE id=?", [req.user.id]);
    const checkins = queryAll(
      "SELECT * FROM checkins WHERE user_id=? ORDER BY created_at DESC LIMIT 5",
      [req.user.id]
    );
    const risk = calculateRisk([...checkins].reverse(), user?.streak || 0);
    const last = checkins[0];

    const userContext = last
      ? `User: ${user.name} · Day ${user.streak} sober · ${user.recovery_focus} recovery
Last check-in: Mood ${last.mood}/5, Urge ${last.urge}/4 (${URGE_LABELS[last.urge] || "Unknown"})
Relapse risk: ${risk.label} (${risk.score}/100)
Total check-ins: ${checkins.length}`
      : `User: ${user?.name} · Day ${user?.streak || 0} sober · No check-ins yet`;

    if (!process.env.GEMINI_API_KEY) {
      return res.json({ reply: "AI service not configured. Add GEMINI_API_KEY to your .env file." });
    }

    const reply = await chatWithGemini(messages, userContext);
    res.json({ reply });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
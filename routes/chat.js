const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { queryAll, queryOne, run, saveDB } = require("../db/database");
const { calculateRisk } = require("../utils/risk");
const { chatWithGemini } = require("../utils/gemini");

const URGE_LABELS = ["None", "Mild", "Moderate", "Strong", "Critical"];

// GET /api/chat/history — load persisted messages
router.get("/history", auth, (req, res) => {
  try {
    const session = queryOne(
      "SELECT messages FROM chat_sessions WHERE user_id=? ORDER BY updated_at DESC LIMIT 1",
      [req.user.id]
    );
    const messages = session ? JSON.parse(session.messages) : [];
    res.json(messages);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/chat/history — clear all chat
router.delete("/history", auth, (req, res) => {
  try {
    run("DELETE FROM chat_sessions WHERE user_id=?", [req.user.id]);
    saveDB();
    res.json({ message: "Chat history cleared" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/chat — send message, get reply, persist everything
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

    // Persist the full conversation (all messages + new reply)
    const fullHistory = JSON.stringify([
      ...messages,
      { role: "assistant", content: reply, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }
    ]);

    const existing = queryOne(
      "SELECT id FROM chat_sessions WHERE user_id=?",
      [req.user.id]
    );
    if (existing) {
      run(
        "UPDATE chat_sessions SET messages=?, updated_at=datetime('now') WHERE user_id=?",
        [fullHistory, req.user.id]
      );
    } else {
      run(
        "INSERT INTO chat_sessions (user_id, messages) VALUES (?,?)",
        [req.user.id, fullHistory]
      );
    }
    saveDB();

    res.json({ reply });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
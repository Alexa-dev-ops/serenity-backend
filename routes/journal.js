const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { queryAll, queryOne, run, saveDB } = require("../db/database");
const { generateReflection } = require("../utils/gemini");

// GET /api/journal
router.get("/", auth, (req, res) => {
  try {
    const entries = queryAll(
      "SELECT * FROM journal_entries WHERE user_id=? ORDER BY created_at DESC LIMIT 20",
      [req.user.id]
    );
    res.json(entries);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/journal
router.post("/", auth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: "content required" });

    const ai_reflection = await generateReflection(content);

    run("INSERT INTO journal_entries (user_id,content,ai_reflection) VALUES (?,?,?)", [
      req.user.id, content, ai_reflection,
    ]);
    saveDB();

    const entry = queryOne(
      "SELECT * FROM journal_entries WHERE user_id=? ORDER BY created_at DESC LIMIT 1",
      [req.user.id]
    );
    res.status(201).json(entry);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/journal/:id
router.delete("/:id", auth, (req, res) => {
  try {
    run("DELETE FROM journal_entries WHERE id=? AND user_id=?", [req.params.id, req.user.id]);
    saveDB();
    res.json({ message: "Entry deleted" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
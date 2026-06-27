const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { queryAll, queryOne, run, saveDB } = require("../db/database");
const { generatePlanDescription } = require("../utils/gemini");

// GET /api/plans
router.get("/", auth, (req, res) => {
  try {
    const plans = queryAll(
      "SELECT * FROM recovery_plans WHERE user_id=? ORDER BY active DESC, created_at DESC",
      [req.user.id]
    );
    res.json(plans);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/plans
router.post("/", auth, async (req, res) => {
  try {
    const { title, description, framework, duration_days } = req.body;
    if (!title) return res.status(400).json({ error: "title required" });

    const desc = description || (await generatePlanDescription(title, framework || "CBT")) || "";

    run(
      "INSERT INTO recovery_plans (user_id,title,description,framework,duration_days) VALUES (?,?,?,?,?)",
      [req.user.id, title, desc, framework || "CBT", duration_days || 30]
    );
    saveDB();

    const plan = queryOne(
      "SELECT * FROM recovery_plans WHERE user_id=? ORDER BY created_at DESC LIMIT 1",
      [req.user.id]
    );
    res.status(201).json(plan);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/plans/:id
router.patch("/:id", auth, (req, res) => {
  try {
    const { progress, active } = req.body;
    if (progress != null) {
      run("UPDATE recovery_plans SET progress=? WHERE id=? AND user_id=?", [
        Math.min(100, Math.max(0, progress)), req.params.id, req.user.id,
      ]);
    }
    if (active != null) {
      run("UPDATE recovery_plans SET active=? WHERE id=? AND user_id=?", [
        active ? 1 : 0, req.params.id, req.user.id,
      ]);
    }
    saveDB();
    res.json(queryOne("SELECT * FROM recovery_plans WHERE id=?", [req.params.id]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
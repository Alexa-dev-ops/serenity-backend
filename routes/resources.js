const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { queryAll } = require("../db/database");

// GET /api/resources
router.get("/", auth, (req, res) => {
  try {
    const resources = queryAll("SELECT * FROM resources ORDER BY created_at DESC");
    res.json(resources);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
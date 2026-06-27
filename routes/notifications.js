const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { queryAll, run, saveDB } = require("../db/database");

// GET /api/notifications
router.get("/", auth, (req, res) => {
  try {
    const notifs = queryAll(
      "SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 30",
      [req.user.id]
    );
    res.json(notifs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", auth, (req, res) => {
  try {
    run("UPDATE notifications SET read=1 WHERE id=? AND user_id=?", [req.params.id, req.user.id]);
    saveDB();
    res.json({ message: "Marked as read" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/notifications/read-all
router.patch("/read-all", auth, (req, res) => {
  try {
    run("UPDATE notifications SET read=1 WHERE user_id=?", [req.user.id]);
    saveDB();
    res.json({ message: "All marked as read" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
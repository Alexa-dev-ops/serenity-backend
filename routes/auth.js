const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { queryOne, run, saveDB } = require("../db/database");
const { auth } = require("../middleware/auth");

const JWT_SECRET = process.env.JWT_SECRET || "serenity_jwt_secret_change_in_production";

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

function safeUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, streak: user.streak, recovery_focus: user.recovery_focus };
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, recovery_focus } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "name, email, password required" });
    if (queryOne("SELECT id FROM users WHERE email=?", [email])) return res.status(409).json({ error: "Email already registered" });

    const hash = await bcrypt.hash(password, 10);
    run("INSERT INTO users (name,email,password_hash,recovery_focus) VALUES (?,?,?,?)", [name, email, hash, recovery_focus || "General"]);
    saveDB();

    const user = queryOne("SELECT * FROM users WHERE email=?", [email]);

    // Default plan and welcome notification for new users
    run("INSERT INTO recovery_plans (user_id,title,description,framework,duration_days) VALUES (?,?,?,?,?)",
      [user.id, "CBT 30-Day Stabilisation", "Cognitive restructuring and daily grounding practice.", "CBT", 30]);
    run("INSERT INTO notifications (user_id,title,body,type) VALUES (?,?,?,?)",
      [user.id, "Welcome to Serenity", "Your recovery journey starts today. Begin with your first check-in.", "system"]);
    saveDB();

    res.status(201).json({ token: signToken(user), user: safeUser(user) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "email and password required" });
    const user = queryOne("SELECT * FROM users WHERE email=?", [email]);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    res.json({ token: signToken(user), user: safeUser(user) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/auth/me
router.get("/me", auth, (req, res) => {
  const user = queryOne("SELECT id,name,email,role,streak,recovery_focus,created_at FROM users WHERE id=?", [req.user.id]);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

// PATCH /api/auth/profile
router.patch("/profile", auth, async (req, res) => {
  try {
    const { name, recovery_focus, password } = req.body;
    if (name) run("UPDATE users SET name=? WHERE id=?", [name, req.user.id]);
    if (recovery_focus) run("UPDATE users SET recovery_focus=? WHERE id=?", [recovery_focus, req.user.id]);
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      run("UPDATE users SET password_hash=? WHERE id=?", [hash, req.user.id]);
    }
    saveDB();
    res.json(queryOne("SELECT id,name,email,role,streak,recovery_focus FROM users WHERE id=?", [req.user.id]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
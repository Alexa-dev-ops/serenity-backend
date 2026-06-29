const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const DB_PATH = path.join(__dirname, "../serenity.db");
let db;

async function initDB() {
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      streak INTEGER DEFAULT 0,
      recovery_focus TEXT DEFAULT 'General',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mood INTEGER NOT NULL,
      urge INTEGER NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      ai_reflection TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      type TEXT DEFAULT 'reminder',
      read INTEGER DEFAULT 0,
      scheduled_for TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS recovery_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      framework TEXT DEFAULT 'CBT',
      duration_days INTEGER DEFAULT 30,
      progress INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      read_time_minutes INTEGER DEFAULT 5,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      messages TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  const count = queryOne("SELECT COUNT(*) as c FROM users")?.c;
  if (!count) await seedDemoData();

  saveDB();
  console.log("Database ready.");
}

function saveDB() {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function queryAll(sql, params = []) {
  const result = db.exec(sql, params);
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map(row => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}

function queryOne(sql, params = []) {
  return queryAll(sql, params)[0] || null;
}

function run(sql, params = []) {
  db.run(sql, params);
}

async function seedDemoData() {
  const adminHash = await bcrypt.hash("admin123", 10);
  const userHash  = await bcrypt.hash("user123", 10);

  run(`INSERT INTO users (name,email,password_hash,role,streak,recovery_focus) VALUES
    ('Alex Morgan',  'alex@serenity.app',  '${userHash}',  'user',  12, 'Alcohol'),
    ('Jamie Osei',   'jamie@serenity.app', '${userHash}',  'user',   5, 'Substance'),
    ('Sam Adeyemi',  'sam@serenity.app',   '${userHash}',  'user',  30, 'Alcohol'),
    ('Admin',        'admin@serenity.app', '${adminHash}', 'admin',  0, 'N/A')`);

  const moods = [2,3,2,4,2,3,3];
  const urges = [2,1,3,1,3,2,3];
  moods.forEach((m, i) => {
    run(`INSERT INTO checkins (user_id,mood,urge,created_at) VALUES (1,?,?,datetime('now','${i-6} days'))`, [m, urges[i]]);
  });
  run(`INSERT INTO checkins (user_id,mood,urge,created_at) VALUES (2,3,2,datetime('now','-1 days'))`);
  run(`INSERT INTO checkins (user_id,mood,urge,created_at) VALUES (3,4,1,datetime('now','-1 days'))`);

  run(`INSERT INTO journal_entries (user_id,content,ai_reflection,created_at) VALUES
    (1,'Ran into someone from before. The pull was real but I kept walking.',
     'What made it possible to keep walking — and can you access that resource right now?',
     datetime('now','-1 days')),
    (1,'Day 10 felt like a milestone. Bought myself a decent meal.',
     'What would it mean for normal to feel like something worth staying for?',
     datetime('now','-3 days'))`);

  run(`INSERT INTO recovery_plans (user_id,title,description,framework,duration_days,progress) VALUES
    (1,'CBT 30-Day Stabilisation','Cognitive restructuring, trigger mapping, and daily grounding.','CBT',30,42),
    (1,'Daily Mindfulness Protocol','Morning body scan, urge surfing, and evening reflection.','ACT',21,60),
    (2,'Motivational Interviewing Track','Exploring ambivalence and building intrinsic motivation.','MI',14,20),
    (3,'Maintenance & Relapse Prevention','Long-term coping and social support rebuilding.','CBT',60,75)`);

  run(`INSERT INTO resources (category,title,content,read_time_minutes) VALUES
    ('Science','Neuroplasticity & the Recovery Window','The brain retains remarkable capacity for structural change throughout recovery. Dopamine receptor density, disrupted by prolonged substance use, begins to normalise within weeks of abstinence. This window represents a critical opportunity for habit formation.',6),
    ('Practice','Somatic Grounding Techniques','Somatic grounding redirects attention to physical sensation, interrupting cognitive loops that sustain cravings. The 5-4-3-2-1 technique engages all sensory channels sequentially.',4),
    ('Education','Understanding Cue-Reactivity','Cue-reactivity is the neurological process by which stimuli associated with past substance use trigger automatic craving responses. Recognition is the first step to interruption.',8),
    ('Social','Rebuilding a Structural Support Network','Social isolation is one of the strongest relapse predictors. The CRAFT model distinguishes enabling relationships from supportive ones and provides a rebuilding framework.',5),
    ('Science','Dopamine Dysregulation & Cravings','Chronic substance use downregulates the dopamine system, reducing baseline reward sensitivity. This explains the anhedonia many people experience early in recovery.',7),
    ('Practice','Urge Surfing: A Step-by-Step Guide','Urge surfing treats cravings as waves — they rise, peak, and fall without action required. Observing the urge with curiosity rather than resistance reduces its power over time.',3)`);

  run(`INSERT INTO notifications (user_id,title,body,type) VALUES
    (1,'Welcome to Serenity','Your recovery journey starts here. Begin with your first check-in.','system'),
    (1,'Milestone Approaching','You are 3 days away from your 2-week mark. Stay the course.','milestone'),
    (2,'Daily Reminder','Your check-in is overdue. A few seconds of honesty can prevent hours of struggle.','reminder')`);

  saveDB();
  console.log("Demo data seeded.");
}

module.exports = { initDB, saveDB, queryAll, queryOne, run };
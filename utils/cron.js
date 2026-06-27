const cron = require("node-cron");
const { queryAll, queryOne, run, saveDB } = require("../db/database");

function startCron() {
  // Daily 9am: check-in reminder for users who haven't logged today
  cron.schedule("0 9 * * *", () => {
    console.log("Running daily reminder cron...");
    try {
      const users = queryAll("SELECT id, name FROM users WHERE role='user'");
      users.forEach((u) => {
        const logged = queryOne(
          "SELECT id FROM checkins WHERE user_id=? AND date(created_at)=date('now')",
          [u.id]
        );
        if (!logged) {
          run(
            "INSERT INTO notifications (user_id,title,body,type,scheduled_for) VALUES (?,?,?,?,datetime('now'))",
            [
              u.id,
              "Daily Check-In",
              `Good morning, ${u.name}. Your check-in keeps your risk score accurate and your recovery on track.`,
              "reminder",
            ]
          );
        }
      });

      // Milestone notifications
      const MILESTONES = [7, 14, 30, 60, 90, 180, 365];
      const milestoneUsers = queryAll(
        `SELECT id, name, streak FROM users WHERE role='user' AND streak IN (${MILESTONES.join(",")})`
      );
      milestoneUsers.forEach((u) => {
        run(
          "INSERT INTO notifications (user_id,title,body,type) VALUES (?,?,?,?)",
          [
            u.id,
            `${u.streak}-Day Milestone`,
            `${u.name}, you have reached ${u.streak} days. This is a clinically significant marker. Take a moment to acknowledge what you have built.`,
            "milestone",
          ]
        );
      });

      saveDB();
      console.log(`Daily cron complete. Processed ${users.length} users.`);
    } catch (err) {
      console.error("Cron error:", err.message);
    }
  });

  console.log("Cron scheduler started (daily reminders at 9am).");
}

module.exports = { startCron };
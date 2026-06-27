require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { initDB } = require("./db/database");
const { startCron } = require("./utils/cron");

const authRoutes         = require("./routes/auth");
const dashboardRoutes    = require("./routes/dashboard");
const checkinRoutes      = require("./routes/checkins");
const journalRoutes      = require("./routes/journal");
const chatRoutes         = require("./routes/chat");
const notificationRoutes = require("./routes/notifications");
const planRoutes         = require("./routes/plans");
const resourceRoutes     = require("./routes/resources");
const adminRoutes        = require("./routes/admin");

const app = express();
app.use(cors({
  origin: [
    "https://serenity-app-mu.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
  ],
  credentials: true,
}));
app.use(express.json());

// Routes
app.use("/api/auth",          authRoutes);
app.use("/api/dashboard",     dashboardRoutes);
app.use("/api/checkins",      checkinRoutes);
app.use("/api/journal",       journalRoutes);
app.use("/api/chat",          chatRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/plans",         planRoutes);
app.use("/api/resources",     resourceRoutes);
app.use("/api/admin",         adminRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 4000;

initDB().then(() => {
  startCron();
  app.listen(PORT, () => {
    console.log(`\n✦ Serenity API running on http://localhost:${PORT}`);
    console.log(`  Demo: alex@serenity.app / user123`);
    console.log(`  Admin: admin@serenity.app / admin123\n`);
  });
});
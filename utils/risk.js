function calculateRisk(checkins, streak) {
  if (!checkins.length) return { score: 20, label: "Low" };

  const recent = checkins.slice(-3);
  const avgMood = recent.reduce((s, c) => s + c.mood, 0) / recent.length;
  const avgUrge = recent.reduce((s, c) => s + c.urge, 0) / recent.length;
  const streakFactor = streak < 7 ? 20 : streak < 30 ? 10 : 0;
  const trend =
    checkins.length >= 2
      ? checkins[checkins.length - 1].urge - checkins[checkins.length - 2].urge
      : 0;

  const raw =
    ((5 - avgMood) / 4) * 35 +
    (avgUrge / 4) * 40 +
    streakFactor +
    (trend > 0 ? 10 : 0);

  const score = Math.min(98, Math.max(5, Math.round(raw)));
  const label = score < 35 ? "Low" : score < 65 ? "Moderate" : "High";
  return { score, label };
}

module.exports = { calculateRisk };
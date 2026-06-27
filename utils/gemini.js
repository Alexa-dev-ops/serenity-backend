const { GoogleGenerativeAI } = require("@google/generative-ai");

function getModel(systemInstruction) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set in .env");
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-flash-latest", systemInstruction });
}

async function generateReflection(journalContent) {
  try {
    const model = getModel(
      "You are Serenity, an addiction recovery AI. Given a journal entry, respond with ONE short reflective question (1-2 sentences max) that helps the person explore more deeply. Warm, not clinical. No preamble."
    );
    const result = await model.generateContent(`Journal entry: "${journalContent}"`);
    return result.response.text().trim();
  } catch (err) {
    console.warn("Gemini reflection failed:", err.message);
    return null;
  }
}

async function generatePlanDescription(title, framework) {
  try {
    const model = getModel(
      "You are a clinical recovery specialist. Write concise, evidence-based content. No preamble."
    );
    const result = await model.generateContent(
      `Write a 1-sentence description for a recovery plan titled "${title}" using the ${framework} framework. Be specific and clinical.`
    );
    return result.response.text().trim();
  } catch (err) {
    console.warn("Gemini plan description failed:", err.message);
    return null;
  }
}

async function chatWithGemini(messages, userContext) {
  const SYSTEM = `You are Serenity, an AI recovery companion built exclusively for addiction recovery support. You are NOT a general assistant.

DOMAIN: Addiction recovery, relapse prevention, emotional regulation, CBT/ACT/Motivational Interviewing.

SCOPE RULE: If asked anything outside recovery or the user's emotional state — redirect: "I'm built specifically for your recovery journey. Let's focus on what matters most right now."

PERSONALITY: Warm but grounded. No hollow affirmations. No emojis. Like a skilled counsellor who judges nothing.

RESPONSE STRUCTURE:
1. Reflect — name what you heard, one sentence
2. Frame — evidence-based context, 1-2 sentences max
3. Act — ONE of: grounding micro-action, reflective question, or direct next step

CLINICAL KNOWLEDGE: HALT framework, cue-reactivity (triggers are neurological not moral failures), Prochaska stages of change, lapse vs relapse distinction, urge surfing, 15-30 minute vulnerability window.

CRISIS PROTOCOL: If suicidal ideation or immediate danger — surface SAMHSA helpline: 1-800-662-4357 immediately.

CURRENT USER CONTEXT:
${userContext}`;

  const model = getModel(SYSTEM);
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const chat = model.startChat({ history });
  const result = await chat.sendMessage(messages[messages.length - 1].content);
  return result.response.text();
}

module.exports = { generateReflection, generatePlanDescription, chatWithGemini };
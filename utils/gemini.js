const { GoogleGenerativeAI } = require("@google/generative-ai");

// If the primary model is overloaded, try these in order before giving up.
const MODEL_FALLBACKS = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"];

function getModel(modelName) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set in .env");
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: modelName });
}

function isOverloaded(err) {
  return err.message?.includes("503") || err.message?.includes("overloaded") || err.message?.includes("high demand");
}

// Runs `fn(modelName)` against each fallback model in turn. Only moves to the
// next model on an overload (503) error — any other error fails immediately,
// since retrying a different model won't fix a bad key or invalid request.
async function withModelFallback(fn) {
  let lastErr;
  for (const modelName of MODEL_FALLBACKS) {
    try {
      return await fn(modelName);
    } catch (err) {
      lastErr = err;
      if (!isOverloaded(err)) throw err;
      // else: try the next model in the fallback list
    }
  }
  throw lastErr;
}

async function generateReflection(journalContent) {
  try {
    return await withModelFallback(async (modelName) => {
      const model = getModel(modelName);
      const prompt = `You are Serenity, an addiction recovery AI. Given a journal entry, respond with ONE short reflective question (1-2 sentences max) that helps the person explore more deeply. Warm, not clinical. No preamble.

Journal entry: "${journalContent}"`;
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    });
  } catch (err) {
    console.warn("Gemini reflection failed:", err.message);
    return null;
  }
}

async function generatePlanDescription(title, framework) {
  try {
    return await withModelFallback(async (modelName) => {
      const model = getModel(modelName);
      const prompt = `You are a clinical recovery specialist. Write concise, evidence-based content. No preamble.

Write a 1-sentence description for a recovery plan titled "${title}" using the ${framework} framework. Be specific and clinical.`;
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    });
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

  const priming = [
    { role: "user", parts: [{ text: SYSTEM }] },
    { role: "model", parts: [{ text: "Understood. I'm ready to support this person in their recovery." }] },
  ];

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const lastMessage = messages[messages.length - 1].content;

  // Tries each fallback model; within a given model, retries briefly on 503
  // before moving to the next model in the list.
  return await withModelFallback(async (modelName) => {
    const model = getModel(modelName);
    const chat = model.startChat({ history: [...priming, ...history] });

    const MAX_ATTEMPTS = 2;
    let lastErr;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await chat.sendMessage(lastMessage);
        return result.response.text();
      } catch (err) {
        lastErr = err;
        if (!isOverloaded(err) || attempt === MAX_ATTEMPTS) throw err;
        await new Promise((r) => setTimeout(r, attempt * 1000)); // 1s
      }
    }
    throw lastErr;
  });
}

module.exports = { generateReflection, generatePlanDescription, chatWithGemini };
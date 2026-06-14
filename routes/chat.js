'use strict';

/**
 * POST /api/chat
 * Secure server-side proxy → Google Gemini API.
 * The GEMINI_API_KEY never leaves the server.
 */

const express  = require('express');
const rateLimit = require('express-rate-limit');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { validateChatRequest } = require('../middleware/validate');

const router = express.Router();

// ── Rate limit ─────────────────────────────────────────────────────────────────
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute window
  max: 20,               // 20 AI requests / minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Please wait a moment.' },
});

// ── Lazy-init Gemini client ────────────────────────────────────────────────────
let _genAI = null;
function getClient() {
  if (!_genAI) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY is not set');
    _genAI = new GoogleGenerativeAI(key);
  }
  return _genAI;
}

// ── System prompt ──────────────────────────────────────────────────────────────
function buildSystemPrompt(context) {
  const { activities = [], totalCO2 = 0 } = context;

  const activitySummary =
    activities.length > 0
      ? `Today's logged activities:\n${activities
          .map(a => `  • ${sanitize(a.label)} — ${Number(a.co2).toFixed(2)} kg CO₂`)
          .join('\n')}\n  Total: ${Number(totalCO2).toFixed(2)} kg CO₂`
      : 'No activities logged yet today.';

  return `You are EcoTrace, a knowledgeable and empathetic AI carbon footprint coach.

Your mission: help individuals understand, track, and meaningfully reduce their carbon emissions through science-backed, practical guidance.

Personality:
- Warm, encouraging, non-judgmental — celebrate every positive step
- Specific and data-driven — always use real numbers and relatable comparisons
- Concise — 2–4 short paragraphs or a tight bullet list per response
- Never shame or lecture; frame reductions as gains, not sacrifices

Reference data:
- Global average daily footprint: ~16 kg CO₂
- Paris 1.5°C target per capita per day: ~3.7 kg CO₂
- 1 mature tree absorbs ~21 kg CO₂/year (~0.057 kg/day)

${activitySummary}

When the user asks about their activities, reference the actual log above.
If no activities are logged, invite them to use the tracker.
End every response with one concrete, immediately actionable suggestion.`;
}

// ── Sanitise user input ────────────────────────────────────────────────────────
function sanitize(str) {
  return String(str)
    .replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]*>/g, '')
    .slice(0, 200);
}

// ── Route ──────────────────────────────────────────────────────────────────────
router.post('/', chatLimiter, validateChatRequest, async (req, res, next) => {
  const { message, history = [], context = {} } = req.body;

  try {
    const genAI = getClient();
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      systemInstruction: buildSystemPrompt(context),
    });

    // Convert prior turns into Gemini's {role, parts} format
    // Gemini uses "model" instead of "assistant"
    const geminiHistory = history.slice(-18).map(m => ({
      role:  m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: sanitize(m.content) }],
    }));

    const chat   = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(sanitize(message));
    const reply  = result.response.text();

    res.json({ reply });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports._buildSystemPrompt = buildSystemPrompt;
module.exports._sanitize          = sanitize;
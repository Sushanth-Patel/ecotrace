'use strict';

/**
 * Validates POST /api/chat request body.
 * Rejects malformed or oversized payloads before they reach the route handler.
 */
function validateChatRequest(req, res, next) {
  const { message, history, context } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'message is required and must be a non-empty string.' });
  }

  if (message.length > 2000) {
    return res.status(400).json({ error: 'message must be 2000 characters or fewer.' });
  }

  if (history !== undefined) {
    if (!Array.isArray(history)) {
      return res.status(400).json({ error: 'history must be an array.' });
    }
    if (history.length > 40) {
      return res.status(400).json({ error: 'history may not exceed 40 entries.' });
    }
    for (const entry of history) {
      if (!entry || typeof entry !== 'object') {
        return res.status(400).json({ error: 'Each history entry must be an object.' });
      }
      if (!['user', 'assistant'].includes(entry.role)) {
        return res.status(400).json({ error: 'History entry role must be "user" or "assistant".' });
      }
      if (typeof entry.content !== 'string' || entry.content.length > 4000) {
        return res.status(400).json({ error: 'History entry content must be a string ≤ 4000 chars.' });
      }
    }
  }

  if (context !== undefined) {
    if (typeof context !== 'object' || Array.isArray(context)) {
      return res.status(400).json({ error: 'context must be an object.' });
    }
    if (context.activities !== undefined) {
      if (!Array.isArray(context.activities) || context.activities.length > 50) {
        return res.status(400).json({ error: 'context.activities must be an array of ≤ 50 items.' });
      }
    }
    if (context.totalCO2 !== undefined) {
      const v = Number(context.totalCO2);
      if (!Number.isFinite(v) || v < 0 || v > 10000) {
        return res.status(400).json({ error: 'context.totalCO2 must be a finite number between 0 and 10000.' });
      }
    }
  }

  next();
}

module.exports = { validateChatRequest };

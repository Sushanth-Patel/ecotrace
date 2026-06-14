'use strict';

function notFound(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
}

function errorHandler(err, req, res, _next) {
  const isProd = process.env.NODE_ENV === 'production';

  // Anthropic SDK errors
  if (err.status && err.error) {
    const status = err.status;
    const message =
      status === 401 ? 'AI service authentication failed. Contact the administrator.' :
      status === 429 ? 'AI service is busy. Please try again in a moment.' :
      status >= 500 ? 'AI service is temporarily unavailable. Please try again.' :
      'AI request failed. Please try again.';
    return res.status(status < 500 ? status : 502).json({ error: message });
  }

  // Missing API key
  if (err.message === 'ANTHROPIC_API_KEY is not set') {
    console.error('[EcoTrace] ANTHROPIC_API_KEY environment variable is missing.');
    return res.status(503).json({ error: 'AI service is not configured. Please contact the administrator.' });
  }

  // Unexpected errors
  console.error('[EcoTrace] Unhandled error:', err);
  res.status(500).json({
    error: isProd ? 'An unexpected error occurred. Please try again.' : err.message,
  });
}

module.exports = { notFound, errorHandler };

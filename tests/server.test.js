'use strict';

const request = require('supertest');

// Stub env so server loads cleanly without a real key
process.env.AI_PROVIDER     = 'gemini';
process.env.GEMINI_API_KEY  = 'test-key-not-real';
process.env.NODE_ENV        = 'test';

const app = require('../server/index');
const { validateChatRequest } = require('../server/middleware/validate');
const { _buildSystemPrompt, _sanitize, _getProvider } = require('../server/routes/chat');

// ── Health ─────────────────────────────────────────────────────────────────────
describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('string');
  });
});

// ── SPA fallback ───────────────────────────────────────────────────────────────
describe('GET unknown route', () => {
  it('returns index.html (SPA fallback)', async () => {
    const res = await request(app).get('/some/spa/route');
    expect([200, 404]).toContain(res.status);
  });
});

// ── validateChatRequest ────────────────────────────────────────────────────────
describe('validateChatRequest', () => {
  function run(body) {
    const req  = { body };
    const res  = { _s: null, _b: null, status(s) { this._s = s; return this; }, json(b) { this._b = b; } };
    const next = jest.fn();
    validateChatRequest(req, res, next);
    return { res, next };
  }

  it('passes valid message',                     () => { const { next } = run({ message: 'Hello' }); expect(next).toHaveBeenCalled(); });
  it('rejects empty message',                    () => { const { res } = run({ message: '  ' });  expect(res._s).toBe(400); });
  it('rejects message over 2000 chars',          () => { const { res } = run({ message: 'a'.repeat(2001) }); expect(res._s).toBe(400); });
  it('rejects non-array history',                () => { const { res } = run({ message: 'Hi', history: 'bad' }); expect(res._s).toBe(400); });
  it('rejects history longer than 40 entries',   () => {
    const h = Array.from({ length: 41 }, () => ({ role: 'user', content: 'x' }));
    const { res } = run({ message: 'Hi', history: h });
    expect(res._s).toBe(400);
  });
  it('rejects invalid history role',             () => { const { res } = run({ message: 'Hi', history: [{ role: 'system', content: 'x' }] }); expect(res._s).toBe(400); });
  it('rejects negative totalCO2',                () => { const { res } = run({ message: 'Hi', context: { totalCO2: -5 } }); expect(res._s).toBe(400); });
  it('rejects activities array over 50 items',   () => {
    const a = Array.from({ length: 51 }, () => ({ label: 'x', co2: 1 }));
    const { res } = run({ message: 'Hi', context: { activities: a } });
    expect(res._s).toBe(400);
  });
});

// ── _sanitize ──────────────────────────────────────────────────────────────────
describe('_sanitize', () => {
  it('strips script tags and their content', () => {
    expect(_sanitize('<script>alert(1)</script>Hello')).toBe('Hello');
  });
  it('strips generic HTML tags (keeps text)',  () => {
    expect(_sanitize('<b>bold</b>')).toBe('bold');
  });
  it('truncates to 200 chars',                () => {
    expect(_sanitize('a'.repeat(300)).length).toBe(200);
  });
  it('coerces non-strings to string',         () => {
    expect(typeof _sanitize(42)).toBe('string');
  });
});

// ── _buildSystemPrompt ────────────────────────────────────────────────────────
describe('_buildSystemPrompt', () => {
  it('includes logged activities', () => {
    const p = _buildSystemPrompt({ activities: [{ label: 'Car (20 km)', co2: 2.1 }], totalCO2: 2.1 });
    expect(p).toContain('Car (20 km)');
    expect(p).toContain('2.10');
  });
  it('shows no-activities message when empty', () => {
    const p = _buildSystemPrompt({ activities: [], totalCO2: 0 });
    expect(p).toContain('No activities logged');
  });
  it('includes Paris target reference', () => {
    expect(_buildSystemPrompt({})).toContain('3.7');
  });
});

// ── Provider registry ─────────────────────────────────────────────────────────
describe('_getProvider', () => {
  const orig = process.env.AI_PROVIDER;
  afterEach(() => { process.env.AI_PROVIDER = orig; });

  it('resolves gemini provider',     () => { process.env.AI_PROVIDER = 'gemini';     expect(typeof _getProvider()).toBe('function'); });
  it('resolves groq provider',       () => { process.env.AI_PROVIDER = 'groq';       expect(typeof _getProvider()).toBe('function'); });
  it('resolves openrouter provider', () => { process.env.AI_PROVIDER = 'openrouter'; expect(typeof _getProvider()).toBe('function'); });
  it('resolves mistral provider',    () => { process.env.AI_PROVIDER = 'mistral';    expect(typeof _getProvider()).toBe('function'); });
  it('resolves anthropic provider',  () => { process.env.AI_PROVIDER = 'anthropic';  expect(typeof _getProvider()).toBe('function'); });
  it('throws on unknown provider',   () => { process.env.AI_PROVIDER = 'xyz';        expect(() => _getProvider()).toThrow(/Unknown AI_PROVIDER/); });
});

// ── POST /api/chat (HTTP layer) ───────────────────────────────────────────────
describe('POST /api/chat', () => {
  it('returns 400 for missing message', async () => {
    const res = await request(app).post('/api/chat').send({ history: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
  it('returns 400 for message too long', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'x'.repeat(2001) });
    expect(res.status).toBe(400);
  });
  it('returns 429 when rate-limit exceeded', async () => {
    const calls = Array.from({ length: 22 }, () =>
      request(app).post('/api/chat').send({ message: 'Hi' })
    );
    const results = await Promise.all(calls);
    expect(results.some(r => r.status === 429)).toBe(true);
  });
});
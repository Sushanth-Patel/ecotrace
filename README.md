# 🌿 EcoTrace — Carbon Footprint Awareness Platform

> PromptWars Challenge 3 | Google for Developers × H2S | Build with AI

---

## Chosen Vertical

**Carbon Footprint Awareness Platform** — A solution that helps individuals understand, track, and reduce their carbon footprint through simple daily actions and AI-powered personalised insights.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Client)                  │
│  public/index.html  ·  public/css/style.css          │
│  public/js/app.js   →  fetch('/api/chat', ...)       │
└───────────────────────────┬─────────────────────────┘
                            │ HTTPS (same origin)
┌───────────────────────────▼─────────────────────────┐
│              Node.js / Express Server                │
│  server/index.js          (helmet, cors, rateLimit)  │
│  server/routes/chat.js    (validate → Anthropic SDK) │
│  server/middleware/        (validate, errorHandler)  │
└───────────────────────────┬─────────────────────────┘
                            │ HTTPS (server → Anthropic)
┌───────────────────────────▼─────────────────────────┐
│              Anthropic Claude API                    │
│              claude-sonnet-4-20250514                │
└─────────────────────────────────────────────────────┘
```

**Why a web service, not static?**
The Anthropic API key must never be exposed in client-side JavaScript. All AI calls go through our Express proxy (`/api/chat`), which validates, rate-limits, and forwards requests server-side. The browser never touches the API key.

---

## How It Works

### 1 — Daily Tracker
Users click `+` on any of 16 pre-loaded activities across four categories (Transport, Food, Home Energy, Shopping). Each action carries a peer-reviewed CO₂ value. The ring meter and nav counter update in real time.

### 2 — Personalised Insights
Four insight cards update as activities are logged:
- **Comparison bars** — your total vs world average (16 kg/day) and Paris 1.5°C target (3.7 kg/day)
- **Tree offset** — trees needed to absorb today's emissions (21 kg/tree/year)
- **Smart tip** — dynamically derived from whichever category has the highest total
- **Annual projection** — today's rate extrapolated to a year

### 3 — AI Carbon Coach
The chat window calls `POST /api/chat`. The server builds a dynamic system prompt that injects the user's actual logged activities, then queries Claude. Every response is grounded in what the user did today, not generic advice.

---

## Prompt Flow & Evolution

### Final system prompt structure
```
[Role + Personality] + [Reference data] + [Live user activity log]
```

### How prompts evolved

| Iteration | Change | Outcome |
|-----------|--------|---------|
| v1 | Generic "sustainability expert" role | Responses were too broad |
| v2 | Added global avg + Paris target numbers | Responses became quantified |
| v3 | Injected actual logged activities as structured text | Responses became truly personalised |
| v4 | Added personality guardrails (non-judgmental, celebrate wins) | Tone became empathetic |
| v5 | Added "end with one immediately actionable suggestion" rule | Every response has a clear CTA |

### What Claude handled vs what humans designed

| Aspect | Claude AI | Human |
|--------|-----------|-------|
| Personalised reduction advice | ✅ | |
| Contextual Q&A on user's logged day | ✅ | |
| CO₂ values per activity | | ✅ |
| System prompt architecture | | ✅ |
| UI/UX design & accessibility | | ✅ |
| Security (rate-limit, validation, CSP) | | ✅ |
| Ring meter + bar chart calculations | | ✅ |

---

## Evaluation Focus Areas

### ✅ Code Quality
- Clean separation: `server/routes/`, `server/middleware/`, `public/`
- All functions single-responsibility; no global mutable state on the server
- Consistent `'use strict'`; descriptive variable names; JSDoc comments

### ✅ Security
- **API key never in the browser** — server-side proxy only
- **Helmet.js** — sets Content-Security-Policy, X-Frame-Options, etc.
- **express-rate-limit** — 200 req/15 min globally; 20 req/min on `/api/chat`
- **Input validation middleware** — rejects malformed payloads before they reach Claude
- **XSS prevention** — all user text escaped via `esc()` before DOM insertion
- **CORS** — allowlist-based, configurable via `ALLOWED_ORIGINS` env var
- **Request size cap** — `express.json({ limit: '16kb' })`

### ✅ Efficiency
- **Compression middleware** — gzip all responses
- **Static file caching** — `maxAge: 1d` in production
- **Chat history trimmed** — last 18 turns sent to avoid ballooning token costs
- **DOM node cache** — `$()` helper memoises `getElementById` calls
- **No dependencies in the browser** — zero npm packages client-side

### ✅ Testing
- **Jest + Supertest** — integration and unit tests
- Tests cover: health endpoint, validation middleware (8 cases), `_sanitize`, `_buildSystemPrompt`, rate-limiting
- Run: `npm test`
- Coverage: `npm test -- --coverage`

### ✅ Accessibility
- Skip-to-content link for keyboard users
- Semantic HTML (`<nav>`, `<main>`, `<section>`, `<footer>`, `role` attributes)
- `aria-live` regions on all dynamic values (score, insights, chat log)
- `aria-label` on every interactive element
- `role="progressbar"` with `aria-valuenow` on comparison bars
- Full keyboard navigation; `:focus-visible` outline on all focusable elements
- `prefers-reduced-motion` respected — animations disabled when set
- Screen-reader-only labels via `.sr-only` class
- Colour contrast ratio ≥ 4.5:1 on all text

---

## AI Tools Used

| Tool | Role |
|------|------|
| **Anthropic Claude API** (`claude-sonnet-4-20250514`) | Powers the in-app AI carbon coach |
| **Claude.ai** | Rapid prototyping, code generation, prompt iteration |

---

## Project Structure

```
ecotrace/
├── server/
│   ├── index.js                  # Express app (security, middleware, routes)
│   ├── routes/
│   │   └── chat.js               # POST /api/chat — Anthropic proxy
│   └── middleware/
│       ├── validate.js           # Request validation
│       └── errorHandler.js       # Unified error handling
├── public/                       # Served as static files
│   ├── index.html                # Single-page app shell
│   ├── css/style.css             # Dark forest theme, responsive, a11y
│   └── js/app.js                 # Tracker logic, insights, chat client
├── tests/
│   └── server.test.js            # Jest + Supertest test suite
├── .env.example                  # Environment variable template
├── .gitignore
├── package.json
├── render.yaml                   # One-click Render deployment config
└── README.md
```

---

## Local Development

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/ecotrace.git
cd ecotrace

# 2. Install
npm install

# 3. Configure
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=sk-ant-...

# 4. Run
npm run dev        # hot-reload via nodemon
# or
npm start          # production mode

# 5. Test
npm test

# Open http://localhost:3000
```

---

## Deployment — Render (Recommended)

Render offers a free tier with no credit card required.

### Steps

1. Push this repository to GitHub (public, single branch `main`)
2. Go to [render.com](https://render.com) → **New** → **Web Service**
3. Connect your GitHub repo
4. Render auto-detects `render.yaml` — review and confirm settings
5. Under **Environment Variables**, add:
   - `ANTHROPIC_API_KEY` → your key from [console.anthropic.com](https://console.anthropic.com)
   - `ALLOWED_ORIGINS` → your Render URL (e.g. `https://ecotrace.onrender.com`)
6. Click **Deploy**

> **Health check:** Render pings `/api/health` to confirm the service is running.

### Alternative: Railway

```bash
npm install -g @railway/cli
railway login
railway init
railway up
# Set ANTHROPIC_API_KEY in the Railway dashboard → Variables
```

---

## Assumptions

- CO₂ values are representative averages from IPCC, OurWorldInData, and Carbon Brief; they vary by region and behaviour
- Paris 3.7 kg/day target is derived from the IPCC 1.5°C per-capita budget pathway to 2030
- Tree absorption: 21 kg CO₂/year (USDA average, mature broadleaf tree) ≈ 0.057 kg/day
- "Daily" tracking resets via the **Clear all** button; no persistence layer keeps the architecture simple and privacy-preserving (no user data stored)

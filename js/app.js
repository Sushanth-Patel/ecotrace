/**
 * EcoTrace — Frontend Application
 *
 * Security: all user-supplied text is escaped before DOM insertion.
 * Accessibility: ARIA live regions handle dynamic updates.
 * Efficiency: DOM nodes cached; no polling; history trimmed server-side.
 */

'use strict';

// ── Constants ──────────────────────────────────────────────────────────────────
const MAX_CO2_SCALE  = 30;   // kg — ring / bar scale ceiling
const TREE_DAILY_ABS = 0.057; // kg CO₂ absorbed per tree per day
const CHAR_WARN      = 1700;
const CHAR_MAX       = 2000;

// ── State ──────────────────────────────────────────────────────────────────────
const state = {
  totalCO2:    0,
  activities:  [],   // { label, category, co2 }
  chatHistory: [],   // { role, content } — kept in sync with server-side window
};

// ── DOM cache ──────────────────────────────────────────────────────────────────
const dom = {};
function $(id) {
  if (!dom[id]) dom[id] = document.getElementById(id);
  return dom[id];
}

// ── Utilities ──────────────────────────────────────────────────────────────────
function round2(n) { return Math.round(n * 100) / 100; }

/** Escape text for safe insertion into innerHTML */
function esc(str) {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function co2Color(kg) {
  if (kg <= 4)  return '#4ade80';
  if (kg <= 10) return '#fbbf24';
  return '#f87171';
}

// ── Ring meter ─────────────────────────────────────────────────────────────────
function updateRing(kg) {
  const ring    = $('hero-ring');
  const numEl   = $('ring-number');
  const navEl   = $('nav-score');
  const pct     = Math.min(kg / MAX_CO2_SCALE, 1);
  const offset  = 502 - pct * 502;

  if (ring)  { ring.style.strokeDashoffset = offset; ring.style.stroke = co2Color(kg); }
  if (numEl) numEl.textContent = round2(kg);
  if (navEl) navEl.textContent = round2(kg) + ' kg CO₂';
}

// ── Insights ───────────────────────────────────────────────────────────────────
function updateInsights(kg) {
  // Bar
  const youBar = $('you-bar');
  const youVal = $('you-val');
  const pct    = Math.min((kg / MAX_CO2_SCALE) * 100, 100);
  if (youBar) { youBar.style.width = pct + '%'; youBar.style.background = co2Color(kg); }
  if (youVal) youVal.textContent = round2(kg) + ' kg';

  // Update progressbar aria
  const barTrack = youBar?.closest('[role="progressbar"]');
  if (barTrack) barTrack.setAttribute('aria-valuenow', round2(kg));

  // Trees
  const treesEl = $('trees-metric');
  if (treesEl) treesEl.textContent = kg > 0 ? Math.ceil(kg / TREE_DAILY_ABS) : 0;

  // Annual
  const annualEl = $('annual-metric');
  if (annualEl) annualEl.textContent = kg > 0 ? round2(kg * 365 / 1000) + ' t' : '0 t';

  // Smart tip
  const tipEl   = $('tip-metric');
  const tipDesc = $('tip-desc');
  if (kg === 0) {
    if (tipEl)   tipEl.textContent  = 'Log activities';
    if (tipDesc) tipDesc.textContent = 'to receive a personalised suggestion';
    return;
  }

  const catTotals = {};
  state.activities.forEach(a => {
    catTotals[a.category] = (catTotals[a.category] || 0) + a.co2;
  });
  const [bigCat] = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const tips = {
    transport: ['Switch to public transport', 'saves ~1.85 kg CO₂ per commute'],
    food:      ['Try one plant-based meal',   'cuts up to 6 kg CO₂ today'],
    energy:    ['Raise AC set-point by 2°C',  'saves ~0.5 kg CO₂ per day'],
    shopping:  ['Buy second-hand',            'cuts 90 % of clothing emissions'],
  };
  const [headline, detail] = tips[bigCat?.[0]] ?? ['Keep tracking', 'more days = better insights'];
  if (tipEl)   tipEl.textContent  = headline;
  if (tipDesc) tipDesc.textContent = detail;
}

// ── Activity logging ───────────────────────────────────────────────────────────
function logActivity(btn, label, category, co2) {
  // Sanitise: discard anything that looks injected
  if (typeof label !== 'string' || typeof category !== 'string' || typeof co2 !== 'number') return;

  btn.classList.add('added');
  setTimeout(() => btn.classList.remove('added'), 350);

  state.totalCO2   = round2(state.totalCO2 + co2);
  state.activities.push({ label, category, co2 });

  // DOM
  const emptyEl     = $('log-empty');
  const logItems    = $('log-items');
  const logTotal    = $('log-total');
  const totalDisplay = $('total-display');

  if (emptyEl)      emptyEl.style.display = 'none';
  if (logTotal)     logTotal.hidden        = false;
  if (totalDisplay) totalDisplay.textContent = round2(state.totalCO2) + ' kg CO₂';

  const li = document.createElement('li');
  li.className = 'log-entry';
  li.setAttribute('role', 'listitem');
  li.innerHTML = `
    <span class="log-entry-name">${esc(label)}</span>
    <span class="log-entry-co2">${co2 > 0 ? '+' + co2 : '0'} kg</span>
  `;
  if (logItems) logItems.appendChild(li);

  updateRing(state.totalCO2);
  updateInsights(state.totalCO2);
}

function clearLog() {
  state.totalCO2  = 0;
  state.activities = [];

  const emptyEl  = $('log-empty');
  const logItems = $('log-items');
  const logTotal = $('log-total');

  if (emptyEl)  emptyEl.style.display = 'block';
  if (logItems) logItems.innerHTML    = '';
  if (logTotal) logTotal.hidden       = true;

  const totalDisplay = $('total-display');
  if (totalDisplay) totalDisplay.textContent = '0 kg CO₂';

  updateRing(0);
  updateInsights(0);
}

// ── Chat ───────────────────────────────────────────────────────────────────────
function appendMessage(role, html, isError = false) {
  const chatWindow = $('chat-window');
  if (!chatWindow) return;

  const div = document.createElement('div');
  div.className = `chat-message ${role === 'user' ? 'user-msg' : 'assistant-msg'}${isError ? ' error-bubble' : ''}`;
  const avatar = role === 'user' ? '👤' : '🌿';
  div.innerHTML = `
    <div class="msg-avatar" aria-hidden="true">${avatar}</div>
    <div class="msg-bubble">${html}</div>
  `;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/** Convert plain text → safe HTML (preserve newlines, no XSS) */
function textToHtml(text) {
  return esc(text).replace(/\n/g, '<br>');
}

function showTyping() {
  const chatWindow = $('chat-window');
  if (!chatWindow) return;
  const div = document.createElement('div');
  div.className  = 'chat-message assistant-msg typing-indicator';
  div.id         = 'typing-indicator';
  div.setAttribute('aria-label', 'AI is typing');
  div.innerHTML  = `
    <div class="msg-avatar" aria-hidden="true">🌿</div>
    <div class="msg-bubble" aria-hidden="true">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function hideTyping() {
  document.getElementById('typing-indicator')?.remove();
}

async function sendMessage() {
  const input   = $('chat-input');
  const sendBtn = $('send-btn');
  const text    = input?.value.trim();

  if (!text || sendBtn?.disabled) return;

  // Hide quick prompts permanently after first use
  const qp = $('quick-prompts');
  if (qp) qp.style.display = 'none';

  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;
  updateCharCount('');

  appendMessage('user', textToHtml(text));
  state.chatHistory.push({ role: 'user', content: text });

  showTyping();

  try {
    const res = await fetch('/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: state.chatHistory.slice(-18),   // send last 18 turns
        context: {
          activities: state.activities.map(a => ({ label: a.label, co2: a.co2 })),
          totalCO2:   state.totalCO2,
        },
      }),
    });

    hideTyping();

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      appendMessage(
        'assistant',
        esc(err.error || `Request failed (${res.status}). Please try again.`),
        true
      );
      return;
    }

    const { reply } = await res.json();
    state.chatHistory.push({ role: 'assistant', content: reply });
    // Trim local history to match server window
    if (state.chatHistory.length > 40) state.chatHistory = state.chatHistory.slice(-40);
    appendMessage('assistant', textToHtml(reply));

  } catch {
    hideTyping();
    appendMessage(
      'assistant',
      'Unable to reach the AI service. Please check your connection and try again.',
      true
    );
  } finally {
    if (sendBtn) sendBtn.disabled = false;
    input?.focus();
  }
}

function sendQuick(btn) {
  const input = $('chat-input');
  if (input) input.value = btn.textContent.trim();
  sendMessage();
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
  autoResizeTextarea(e.target);
  updateCharCount(e.target.value);
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 112) + 'px';
}

function updateCharCount(value) {
  const el = $('char-count');
  if (!el) return;
  const len = value.length;
  if (len >= CHAR_WARN) {
    el.textContent = `${len} / ${CHAR_MAX}`;
    el.className   = `char-count ${len >= CHAR_MAX ? 'limit' : 'warn'}`;
  } else {
    el.textContent = '';
    el.className   = 'char-count';
  }
}

// ── Init ───────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateRing(0);
  updateInsights(0);

  const input = $('chat-input');
  if (input) {
    input.addEventListener('input', function () {
      autoResizeTextarea(this);
      updateCharCount(this.value);
    });
  }
});

// ============================================================
//  sidepanel.js — WebChat AI Chrome Extension
//  Handles: session management, URL capture, backend calls,
//           chat UI, typing animations, source citations
// ============================================================

// ── CONFIG ──────────────────────────────────────────────────────
// ⚠️  Replace this with your actual Render URL after deploying!
const BACKEND_URL = 'https://chrome-extension-1-webai.onrender.com';

// ── STATE ────────────────────────────────────────────────────────
let sessionId = null;
let isBusy = false;
let loadedUrls = [];

// ── DOM REFS ─────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const stepLoad = $('step-load');
const stepChat = $('step-chat');
const urlInput = $('url-input');
const loadBtn = $('load-btn');
const loadBtnText = $('load-btn-text');
const loadStatus = $('load-status');
const errorBox = $('error-box');
const errorMsg = $('error-message');
const statusBadge = $('status-badge');
const resetBtn = $('reset-btn');
const messagesDiv = $('messages');
const chatInput = $('chat-input');
const sendBtn = $('send-btn');
const loadedUrlDisplay = $('loaded-url-display');

const ps = {
  scraping: $('ps-scraping'),
  chunking: $('ps-chunking'),
  embedding: $('ps-embedding'),
  ready: $('ps-ready'),
};

// ── INIT ──────────────────────────────────────────────────────────
async function init() {
  // Retrieve or create a stable session ID stored in Chrome storage
  const stored = await chrome.storage.local.get('sessionId');
  sessionId = stored.sessionId || crypto.randomUUID();
  await chrome.storage.local.set({ sessionId });

  // Auto-populate with the current active tab's URL
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url && !tab.url.startsWith('chrome') && !tab.url.startsWith('about')) {
      urlInput.value = tab.url;
    }
  } catch (_) {
    // No active tab access — user can paste manually
  }
}

// ── STATUS HELPERS ────────────────────────────────────────────────
function setStatus(type, label) {
  statusBadge.className = `status-badge status-${type}`;
  statusBadge.textContent = `● ${label}`;
}

function showError(msg) {
  errorBox.classList.remove('hidden');
  errorMsg.textContent = msg;
  setStatus('error', 'Error');
}

function clearError() {
  errorBox.classList.add('hidden');
}

// ── PROGRESS ANIMATION ────────────────────────────────────────────
const STEPS = ['scraping', 'chunking', 'embedding', 'ready'];
const DELAYS = [0, 3500, 7500, 12000]; // ms — rough pacing

function startProgress() {
  STEPS.forEach(s => ps[s].classList.remove('active', 'done'));
  loadStatus.classList.remove('hidden');

  STEPS.forEach((step, i) => {
    setTimeout(() => {
      // Mark all prior steps as done
      STEPS.slice(0, i).forEach(s => {
        ps[s].classList.remove('active');
        ps[s].classList.add('done');
      });
      ps[step].classList.add('active');
    }, DELAYS[i]);
  });
}

function finishProgress() {
  STEPS.forEach(s => { ps[s].classList.remove('active'); ps[s].classList.add('done'); });
}

// ── LOAD URLS ─────────────────────────────────────────────────────
async function loadURLs() {
  if (isBusy) return;

  const raw = urlInput.value.trim();
  if (!raw) { showError('Please enter at least one URL.'); return; }

  const urls = raw.split('\n').map(u => u.trim()).filter(Boolean);
  clearError();
  isBusy = true;

  // Lock UI
  loadBtn.disabled = true;
  loadBtnText.textContent = 'Analyzing…';
  setStatus('loading', 'Loading…');
  startProgress();

  try {
    const res = await fetch(`${BACKEND_URL}/load-urls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls, session_id: sessionId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server error ${res.status}`);
    }

    finishProgress();
    await sleep(700); // brief pause so user sees "Ready" tick

    loadedUrls = urls;
    transitionToChat(urls);
    setStatus('ready', 'Ready');

  } catch (err) {
    showError(
      err.message.includes('fetch')
        ? `Cannot reach backend. Is it deployed to Render? (${err.message})`
        : err.message
    );
    setStatus('error', 'Error');
  } finally {
    isBusy = false;
    loadBtn.disabled = false;
    loadBtnText.textContent = 'Load & Analyze Page';
    loadStatus.classList.add('hidden');
  }
}

// ── TRANSITION TO CHAT ────────────────────────────────────────────
function transitionToChat(urls) {
  stepLoad.classList.add('hidden');
  stepChat.classList.remove('hidden');
  resetBtn.classList.remove('hidden');

  loadedUrlDisplay.textContent =
    urls.length === 1 ? urls[0] : `${urls.length} pages loaded`;

  renderWelcome();
}

// ── WELCOME CARD ──────────────────────────────────────────────────
const SUGGESTIONS = [
  'What is this page about?',
  'Summarize the main points',
  'What are the key features?',
  'What can I do here?',
];

function renderWelcome() {
  const el = document.createElement('div');
  el.className = 'welcome';
  el.innerHTML = `
    <div class="welcome-icon">✨</div>
    <div class="welcome-title">Ready to Answer!</div>
    <p class="welcome-text">I've analyzed the page content.<br>Ask me anything about it.</p>
    <div class="suggestion-chips">
      ${SUGGESTIONS.map(s => `<button class="chip">${s}</button>`).join('')}
    </div>
  `;

  // Suggestion click handlers
  el.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      chatInput.value = btn.textContent;
      sendMessage();
    });
  });

  messagesDiv.appendChild(el);
}

// ── SEND MESSAGE ──────────────────────────────────────────────────
async function sendMessage() {
  const query = chatInput.value.trim();
  if (!query || isBusy) return;

  chatInput.value = '';
  autoResize(chatInput);
  isBusy = true;
  sendBtn.disabled = true;

  addMessage('user', query);
  const typingEl = addTyping();
  scrollBottom();

  try {
    const res = await fetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, session_id: sessionId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server error ${res.status}`);
    }

    const data = await res.json();
    typingEl.remove();
    addMessage('ai', data.answer, data.sources || []);

  } catch (err) {
    typingEl.remove();
    addMessage('ai', `⚠️ ${err.message}`);
  } finally {
    isBusy = false;
    sendBtn.disabled = false;
    chatInput.focus();
    scrollBottom();
  }
}

// ── ADD MESSAGE ───────────────────────────────────────────────────
function addMessage(role, content, sources = []) {
  const wrap = document.createElement('div');
  wrap.className = `message ${role}`;

  // Avatar
  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = role === 'user' ? '👤' : '🤖';

  // Body container
  const body = document.createElement('div');
  body.className = 'msg-body';

  // Bubble
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = renderMarkdown(content);

  // Timestamp
  const time = document.createElement('div');
  time.className = 'msg-time';
  time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  body.appendChild(bubble);
  body.appendChild(time);

  // Sources (AI only)
  if (role === 'ai' && sources.length > 0) {
    const sourcesDiv = document.createElement('div');
    sourcesDiv.className = 'msg-sources';

    const label = document.createElement('div');
    label.className = 'sources-label';
    label.textContent = 'Sources';
    sourcesDiv.appendChild(label);

    sources.forEach(url => {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.className = 'source-link';
      a.title = url;
      a.textContent = url.replace(/https?:\/\//, '').slice(0, 40) + (url.length > 43 ? '…' : '');
      sourcesDiv.appendChild(a);
    });

    body.appendChild(sourcesDiv);
  }

  // Copy button (AI only)
  if (role === 'ai') {
    const actions = document.createElement('div');
    actions.className = 'msg-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = '📋 Copy';
    copyBtn.addEventListener('click', () => copyText(copyBtn, content));

    actions.appendChild(copyBtn);
    body.appendChild(actions);
  }

  wrap.appendChild(avatar);
  wrap.appendChild(body);
  messagesDiv.appendChild(wrap);
  scrollBottom();
}

// ── TYPING INDICATOR ──────────────────────────────────────────────
function addTyping() {
  const el = document.createElement('div');
  el.className = 'typing';
  el.innerHTML = `
    <div class="msg-avatar" style="background:linear-gradient(135deg,#0891b2,#06b6d4)">🤖</div>
    <div class="typing-dots">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  messagesDiv.appendChild(el);
  return el;
}

// ── RESET SESSION ─────────────────────────────────────────────────
async function resetSession() {
  // Tell backend to clear this session
  try {
    await fetch(`${BACKEND_URL}/session/${sessionId}`, { method: 'DELETE' });
  } catch (_) { /* ignore if backend unavailable */ }

  // New session ID
  sessionId = crypto.randomUUID();
  await chrome.storage.local.set({ sessionId });

  // Reset UI
  messagesDiv.innerHTML = '';
  chatInput.value = '';
  loadedUrls = [];

  stepChat.classList.add('hidden');
  stepLoad.classList.remove('hidden');
  resetBtn.classList.add('hidden');
  setStatus('idle', 'Idle');
  clearError();

  // Re-fetch current tab URL
  await init();
}

// ── HELPERS ───────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function scrollBottom() {
  setTimeout(() => { messagesDiv.scrollTop = messagesDiv.scrollHeight; }, 60);
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 90) + 'px';
}

async function copyText(btn, text) {
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = '✅ Copied!';
  } catch (_) {
    btn.textContent = '❌ Failed';
  }
  setTimeout(() => { btn.textContent = '📋 Copy'; }, 2000);
}

/** Lightweight Markdown → HTML renderer for AI responses */
function renderMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

// ── EVENT LISTENERS ───────────────────────────────────────────────
loadBtn.addEventListener('click', loadURLs);
resetBtn.addEventListener('click', resetSession);
sendBtn.addEventListener('click', sendMessage);

chatInput.addEventListener('input', () => autoResize(chatInput));
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// ── BOOT ─────────────────────────────────────────────────────────
init();

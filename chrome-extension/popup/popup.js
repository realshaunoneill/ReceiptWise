// ReceiptWise Clipper - Popup
// Connect (one click, or a pasted key), show who it's connected to, and start a capture.

const API_BASE_URL = self.RW_API_BASE_URL;

// DOM Elements
const container = document.getElementById('container');
const setupView = document.getElementById('setup-view');
const mainView = document.getElementById('main-view');
const connectBtn = document.getElementById('connect-btn');
const setupNote = document.getElementById('setup-note');
const showKeyFormBtn = document.getElementById('show-key-form');
const keyForm = document.getElementById('key-form');
const apiKeyInput = document.getElementById('api-key');
const saveKeyBtn = document.getElementById('save-key');
const toggleVisibilityBtn = document.getElementById('toggle-visibility');
const accountLine = document.getElementById('account-line');
const premiumNote = document.getElementById('premium-note');
const captureBtn = document.getElementById('capture-btn');
const captureNote = document.getElementById('capture-note');
const disconnectBtn = document.getElementById('disconnect-btn');

// Links follow config.js, so a development copy points at its own server.
document.getElementById('settings-link').href = `${API_BASE_URL}/settings?tab=integrations`;
document.getElementById('upgrade-link').href = `${API_BASE_URL}/upgrade`;

// The shortcut as this platform writes it.
const isMac = /Mac/i.test(navigator.userAgentData?.platform || navigator.platform || '');
document.getElementById('shortcut-keys').replaceChildren(
  ...(isMac ? ['⌃', '⇧', 'R'] : ['Alt', 'Shift', 'R']).flatMap((key, index) => {
    const kbd = document.createElement('kbd');
    kbd.textContent = key;
    if (index === 0) return [kbd];
    const plus = document.createElement('span');
    plus.textContent = '+';
    return [plus, kbd];
  }),
);

let currentTab = null;

// Pre-fetch the current tab: opening the popup grants activeTab, which is what lets the
// extension read its address and capture it.
chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
  currentTab = tabs[0];
});

// ============================================
// Views
// ============================================

function showSetupView(note) {
  setupView.classList.remove('hidden');
  mainView.classList.add('hidden');
  setNote(setupNote, note);
}

function showMainView(account) {
  setupView.classList.add('hidden');
  mainView.classList.remove('hidden');
  accountLine.textContent = account?.email ? `Connected as ${account.email}` : 'Connected';
  premiumNote.classList.toggle('hidden', account?.subscribed !== false);
  setNote(captureNote, null);
}

function setNote(element, text) {
  element.textContent = text || '';
  element.classList.toggle('hidden', !text);
}

// Open on what's cached, then check the key still works.
(async () => {
  const { apiKey } = await chrome.storage.sync.get('apiKey');
  const { account } = await chrome.storage.local.get('account');
  if (apiKey) showMainView(account);
  else showSetupView();
  requestAnimationFrame(() => container.classList.add('ready'));

  if (!apiKey) return;
  const check = await verifyApiKey(apiKey);
  if (check.status === 'ok') {
    await chrome.storage.local.set({ account: check.account });
    showMainView(check.account);
  } else if (check.status === 'rejected') {
    // Revoked in Settings, or the account changed: start again rather than fail at upload time.
    await chrome.storage.sync.remove('apiKey');
    await chrome.storage.local.remove('account');
    showSetupView('That connection was turned off. Connect again to keep clipping.');
  }
  // Offline: keep the cached view.
})();

// ============================================
// Connect
// ============================================

connectBtn.addEventListener('click', () => {
  // The page signs in if needed, then hands a key back to this extension by its id.
  chrome.tabs.create({ url: `${API_BASE_URL}/connect/extension?ext=${chrome.runtime.id}` });
  window.close();
});

showKeyFormBtn.addEventListener('click', () => {
  keyForm.classList.remove('hidden');
  showKeyFormBtn.classList.add('hidden');
  apiKeyInput.focus();
});

// Picks up a connection made on the connect page while the popup is open.
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'sync' && changes.apiKey?.newValue) {
    const { account } = await chrome.storage.local.get('account');
    showMainView(account);
  }
});

toggleVisibilityBtn?.addEventListener('click', () => {
  const eyeIcon = toggleVisibilityBtn.querySelector('.eye-icon');
  const eyeOffIcon = toggleVisibilityBtn.querySelector('.eye-off-icon');
  const show = apiKeyInput.type === 'password';
  apiKeyInput.type = show ? 'text' : 'password';
  eyeIcon.classList.toggle('hidden', show);
  eyeOffIcon.classList.toggle('hidden', !show);
});

// A pasted key: the fallback to one-click connect.
saveKeyBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    showInputError('Paste your API key first.');
    return;
  }
  if (!apiKey.startsWith('rw_')) {
    showInputError('That isn’t a ReceiptWise key: they start with rw_.');
    return;
  }

  const originalContent = saveKeyBtn.innerHTML;
  saveKeyBtn.textContent = 'Checking…';
  saveKeyBtn.disabled = true;

  const check = await verifyApiKey(apiKey);
  saveKeyBtn.innerHTML = originalContent;
  saveKeyBtn.disabled = false;

  if (check.status === 'ok') {
    await chrome.storage.sync.set({ apiKey });
    await chrome.storage.local.set({ account: check.account });
    showMainView(check.account);
  } else if (check.status === 'rejected') {
    showInputError(check.error || 'That key wasn’t accepted. Create a new one in Settings.');
  } else {
    showInputError('Couldn’t reach ReceiptWise. Check your connection and try again.');
  }
});

/** { status: 'ok', account } | { status: 'rejected', error } | { status: 'offline' } */
async function verifyApiKey(apiKey) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/extension/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    });
    const body = await response.json().catch(() => null);
    if (response.ok && body?.user) {
      return { status: 'ok', account: { email: body.user.email, subscribed: Boolean(body.user.subscribed) } };
    }
    // 401: revoked or unknown key. 403: suspended, or a deletion pending (the message says which).
    if (response.status === 401 || response.status === 403) return { status: 'rejected', error: body?.error };
    return { status: 'offline' };
  } catch {
    return { status: 'offline' };
  }
}

// ============================================
// Capture
// ============================================

// Pages a content script can't run on: those get a screenshot and the cropper page instead.
const RESTRICTED_PATTERNS = [
  'chrome://', 'chrome-extension://', 'edge://', 'about:', 'data:',
  'file://', 'devtools://', 'view-source:',
  'https://mail.google.com', 'https://accounts.google.com',
  'https://myaccount.google.com', 'https://payments.google.com',
  'https://pay.google.com', 'https://chrome.google.com/webstore',
  'https://chromewebstore.google.com',
  'https://addons.mozilla.org', 'https://microsoftedge.microsoft.com',
];

function isRestrictedUrl(url) {
  if (!url) return true;
  return RESTRICTED_PATTERNS.some(pattern => url.startsWith(pattern));
}

// Pages Chrome won't even screenshot.
function isCompletelyBlocked(url) {
  if (!url) return true;
  return ['chrome://', 'chrome-extension://', 'edge://', 'about:', 'devtools://', 'view-source:']
    .some(pattern => url.startsWith(pattern));
}

captureBtn.addEventListener('click', async () => {
  const tab = currentTab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

  if (!tab?.id) {
    setNote(captureNote, 'Couldn’t reach this tab. Try again.');
    return;
  }
  if (isCompletelyBlocked(tab.url)) {
    setNote(captureNote, 'Browser pages like this one can’t be clipped. Open the page with the receipt and try again.');
    return;
  }

  // Close at once: the capture happens on the page.
  window.close();

  if (isRestrictedUrl(tab.url)) {
    chrome.runtime.sendMessage({ action: 'captureAndCrop' });
    return;
  }
  chrome.runtime.sendMessage({ action: 'startCapture', tabId: tab.id, url: tab.url });
});

disconnectBtn.addEventListener('click', async () => {
  await chrome.storage.sync.remove('apiKey');
  await chrome.storage.local.remove('account');
  apiKeyInput.value = '';
  showSetupView('Disconnected. The key still exists until you revoke it in Settings → Integrations.');
});

// ============================================
// Helpers
// ============================================

apiKeyInput.addEventListener('input', () => {
  apiKeyInput.style.borderColor = '';
  apiKeyInput.style.boxShadow = '';
  setNote(setupNote, null);
});

apiKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveKeyBtn.click();
  }
});

function showInputError(message) {
  apiKeyInput.style.borderColor = '#ef4444';
  apiKeyInput.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
  setNote(setupNote, message);
  apiKeyInput.focus();
}

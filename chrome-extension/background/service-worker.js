// ReceiptWise Clipper - Service Worker
// Starts captures, uploads what was clipped, and takes the key from the one-click connect page.

importScripts('../config.js');
const API_BASE_URL = self.RW_API_BASE_URL;

// ============================================
// URL Restriction Handling
// ============================================

// Pages a content script can't run on, but whose screenshot can still be taken: they get the
// cropper page instead of the in-page overlay.
const RESTRICTED_PATTERNS = [
  'chrome://', 'chrome-extension://', 'edge://', 'about:', 'data:',
  'file://', 'devtools://', 'view-source:',
  'https://mail.google.com', 'https://accounts.google.com',
  'https://myaccount.google.com', 'https://payments.google.com',
  'https://pay.google.com', 'https://chrome.google.com/webstore',
  'https://chromewebstore.google.com',
  'https://addons.mozilla.org', 'https://microsoftedge.microsoft.com',
];

// Pages Chrome won't even screenshot.
const COMPLETELY_BLOCKED = [
  'chrome://', 'chrome-extension://', 'edge://', 'about:', 'devtools://', 'view-source:',
];

function isRestrictedUrl(url) {
  if (!url) return true;
  return RESTRICTED_PATTERNS.some(pattern => url.startsWith(pattern));
}

function isCompletelyBlocked(url) {
  if (!url) return true;
  return COMPLETELY_BLOCKED.some(pattern => url.startsWith(pattern));
}

// ============================================
// Screenshot & Cropper Fallback
// ============================================

async function captureFullTabAndOpenCropper() {
  try {
    const imageData = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    const screenshotKey = Date.now().toString();

    await chrome.storage.local.set({ [`screenshot_${screenshotKey}`]: imageData });

    chrome.tabs.create({
      url: `cropper/cropper.html?key=${screenshotKey}`,
      active: true,
    });

    return true;
  } catch (error) {
    console.error('Failed to capture tab:', error);
    showNotification('error', 'Capture failed', "Couldn't take a screenshot of this page.");
    return false;
  }
}

// ============================================
// Content Script Injection
// ============================================

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['shared/image.js', 'content/content.js'],
    });
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content/content.css'],
    });
    return true;
  } catch (error) {
    console.error('Failed to inject content script:', error);
    return false;
  }
}

async function ensureContentScriptLoaded(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    return true;
  } catch {
    return await injectContentScript(tabId);
  }
}

// ============================================
// Capture Flow
// ============================================

// Every capture starts from the toolbar button or the keyboard shortcut, which is what grants
// activeTab for the page: that is all the access the extension needs, so it asks for no host
// permission beyond receiptwise.io itself.
async function startCaptureOnTab(tabId, url) {
  if (isRestrictedUrl(url)) {
    await captureFullTabAndOpenCropper();
    return;
  }

  const scriptLoaded = await ensureContentScriptLoaded(tabId);

  if (!scriptLoaded) {
    await captureFullTabAndOpenCropper();
    return;
  }

  await new Promise(resolve => setTimeout(resolve, 50));

  try {
    await chrome.tabs.sendMessage(tabId, { action: 'startCapture' });
  } catch {
    await captureFullTabAndOpenCropper();
  }
}

// ============================================
// Keyboard Shortcut Handler
// ============================================

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'capture-receipt') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) return;

  if (isCompletelyBlocked(tab.url)) {
    showNotification('error', "Can't clip this page", 'Browser system pages cannot be captured.');
    return;
  }

  await startCaptureOnTab(tab.id, tab.url);
});

// ============================================
// Message Handler (popup, content script, cropper)
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'uploadReceipt':
      handleReceiptUpload(message.imageData);
      sendResponse({ received: true });
      break;

    case 'uploadReceiptWithResponse':
      handleReceiptUploadWithResponse(message.imageData)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'captureAndCrop':
      captureFullTabAndOpenCropper();
      sendResponse({ received: true });
      break;

    case 'startCapture':
      (async () => {
        const tabId = message.tabId || sender.tab?.id;
        if (!tabId) return;
        await startCaptureOnTab(tabId, message.url);
      })();
      sendResponse({ received: true });
      break;

    case 'captureTab':
      captureVisibleTab().then(data => sendResponse({ imageData: data }));
      return true;
  }
  return true;
});

// ============================================
// One-click connect (from https://www.receiptwise.io/connect/extension)
// ============================================

// externally_connectable already limits who can message the extension to receiptwise.io pages;
// the origin is checked again here, and the key is verified before it is kept.
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (sender.origin !== API_BASE_URL) {
    sendResponse({ ok: false, error: 'Not allowed' });
    return false;
  }

  if (message?.action === 'ping') {
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
    return false;
  }

  if (message?.action === 'connect') {
    (async () => {
      const apiKey = typeof message.apiKey === 'string' ? message.apiKey : '';
      if (!apiKey.startsWith('rw_')) {
        sendResponse({ ok: false, error: 'That key is not valid.' });
        return;
      }
      const account = await verifyApiKey(apiKey);
      if (!account) {
        sendResponse({ ok: false, error: "That key didn't work. Try connecting again." });
        return;
      }
      await chrome.storage.sync.set({ apiKey });
      await chrome.storage.local.set({ account });
      showNotification('success', 'Connected', `Clipping to ${account.email}.`);
      sendResponse({ ok: true });
    })();
    return true;
  }

  sendResponse({ ok: false, error: 'Unknown request' });
  return false;
});

// ============================================
// Account
// ============================================

/** The account a key belongs to ({ email, subscribed }), or null if the key isn't accepted. */
async function verifyApiKey(apiKey) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/extension/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    });
    if (!response.ok) return null;
    const body = await response.json();
    return body?.user ? { email: body.user.email, subscribed: Boolean(body.user.subscribed) } : null;
  } catch {
    return null;
  }
}

// ============================================
// Tab Screenshot
// ============================================

async function captureVisibleTab() {
  try {
    return await chrome.tabs.captureVisibleTab(null, { format: 'png' });
  } catch (error) {
    console.error('Failed to capture tab:', error);
    return null;
  }
}

// ============================================
// Upload Handling
// ============================================

const EXTENSIONS = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

/** A data: URL as a Blob of its own type (captures are WebP now; older paths sent PNG). */
function dataUrlToBlob(imageData) {
  const [header, base64Data] = imageData.split(',');
  const type = header.match(/^data:([^;]+)/)?.[1] || 'image/png';
  const byteCharacters = atob(base64Data);
  const byteArray = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([byteArray], { type });
}

async function uploadToServer(apiKey, blob) {
  const formData = new FormData();
  formData.append('file', blob, `receipt-${Date.now()}.${EXTENSIONS[blob.type] || 'png'}`);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/extension/upload`, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey },
      body: formData,
    });
  } catch {
    throw new Error("Couldn't reach ReceiptWise. Check your connection and try again.");
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');

  if (!response.ok) {
    // The server's own message where there is one: it says what to do (Premium ended, account
    // suspended, too many uploads in an hour).
    if (isJson) {
      const errorData = await response.json().catch(() => null);
      if (errorData?.error) throw new Error(errorData.error);
    }
    if (response.status === 401) throw new Error('This connection has been revoked. Connect again from the extension.');
    if (response.status === 413) throw new Error('That clip is too large. Select a smaller area.');
    throw new Error(`Upload failed (${response.status}). Please try again.`);
  }

  if (!isJson) throw new Error('Unexpected response from ReceiptWise.');
  return await response.json();
}

async function upload(imageData) {
  const { apiKey } = await chrome.storage.sync.get('apiKey');
  if (!apiKey) throw new Error('Not connected. Open the extension and connect it to ReceiptWise.');
  return uploadToServer(apiKey, dataUrlToBlob(imageData));
}

async function handleReceiptUpload(imageData) {
  try {
    setBadge('uploading');
    const result = await upload(imageData);
    showNotification('success', 'Sent to ReceiptWise', "It's read in a few seconds. Bills go to your Bill inbox.", result.receiptId);
  } catch (error) {
    console.error('Upload error:', error);
    showNotification('error', 'Upload failed', error.message);
  }
}

async function handleReceiptUploadWithResponse(imageData) {
  try {
    const result = await upload(imageData);
    showNotification('success', 'Sent to ReceiptWise', "It's read in a few seconds. Bills go to your Bill inbox.", result.receiptId);
    return { success: true, receiptId: result.receiptId };
  } catch (error) {
    console.error('Upload error:', error);
    showNotification('error', 'Upload failed', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================
// Notifications
// ============================================

const BADGES = {
  success: { text: '✓', color: '#00825a' },
  error: { text: '!', color: '#ef4444' },
  uploading: { text: '…', color: '#f59e0b' },
};

function setBadge(type) {
  chrome.action.setBadgeText({ text: BADGES[type].text });
  chrome.action.setBadgeBackgroundColor({ color: BADGES[type].color });
  if (type !== 'uploading') setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
}

/** A notification; clicking a successful upload's opens that receipt. */
function showNotification(type, title, message, receiptId) {
  setBadge(type);
  const notificationId = receiptId ? `receipt:${receiptId}` : `rw:${Date.now()}`;
  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message,
    priority: type === 'error' ? 2 : 1,
  }).catch(() => {});
}

chrome.notifications.onClicked.addListener((notificationId) => {
  const receiptId = notificationId.startsWith('receipt:') ? notificationId.slice('receipt:'.length) : null;
  chrome.tabs.create({ url: receiptId ? `${API_BASE_URL}/receipts?selected=${encodeURIComponent(receiptId)}` : `${API_BASE_URL}/receipts` });
  chrome.notifications.clear(notificationId);
});

// ============================================
// Lifecycle Events
// ============================================

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'popup/popup.html' });
  }
});

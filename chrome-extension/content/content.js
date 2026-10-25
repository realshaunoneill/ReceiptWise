// ReceiptWise Clipper - Content Script
// Handles the screen capture overlay and snipping functionality

let isCapturing = false;
let overlay = null;
let selectionBox = null;
let sizeIndicator = null;
let startX = 0;
let startY = 0;

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'ping') {
    // Simple ping to check if content script is loaded
    sendResponse({ pong: true });
    return true;
  }
  if (message.action === 'startCapture') {
    // Prevent duplicate captures
    if (isCapturing) {
      sendResponse({ started: false, reason: 'already capturing' });
      return true;
    }
    startCapture();
    sendResponse({ started: true });
  }
  return true;
});

// Start capture mode
function startCapture() {
  if (isCapturing) return;
  isCapturing = true;

  // Create overlay
  overlay = document.createElement('div');
  overlay.id = 'receiptwise-overlay';
  overlay.innerHTML = `
    <div class="receiptwise-instructions">
      <span>Click and drag to select area</span>
      <span class="receiptwise-hint">Press <kbd>Esc</kbd> to cancel</span>
    </div>
  `;
  document.body.appendChild(overlay);

  // Create selection box
  selectionBox = document.createElement('div');
  selectionBox.id = 'receiptwise-selection';
  document.body.appendChild(selectionBox);

  // Create size indicator
  sizeIndicator = document.createElement('div');
  sizeIndicator.id = 'receiptwise-size';
  sizeIndicator.className = 'receiptwise-size-indicator';
  document.body.appendChild(sizeIndicator);

  // Add event listeners
  overlay.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('keydown', handleKeyDown);
}

// Handle mouse down - start selection
function handleMouseDown(e) {
  if (!isCapturing) return;

  // Only handle left mouse button
  if (e.button !== 0) return;

  e.preventDefault();
  e.stopPropagation();

  startX = e.clientX;
  startY = e.clientY;

  selectionBox.style.left = `${startX}px`;
  selectionBox.style.top = `${startY}px`;
  selectionBox.style.width = '0';
  selectionBox.style.height = '0';
  selectionBox.classList.add('active');
  overlay.classList.add('receiptwise-selecting');

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}

// Handle mouse move - update selection
function handleMouseMove(e) {
  if (!isCapturing) return;

  const currentX = e.clientX;
  const currentY = e.clientY;

  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  const left = Math.min(currentX, startX);
  const top = Math.min(currentY, startY);

  selectionBox.style.left = `${left}px`;
  selectionBox.style.top = `${top}px`;
  selectionBox.style.width = `${width}px`;
  selectionBox.style.height = `${height}px`;

  // Update size indicator
  if (sizeIndicator && width > 50 && height > 50) {
    sizeIndicator.textContent = `${Math.round(width)} × ${Math.round(height)}`;
    sizeIndicator.style.left = `${left + width / 2}px`;
    sizeIndicator.style.top = `${top + height + 8}px`;
    sizeIndicator.style.display = 'block';
  }
}

// Handle mouse up - complete selection
async function handleMouseUp(_e) {
  if (!isCapturing) return;

  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);

  const rect = selectionBox.getBoundingClientRect();

  // Minimum size check
  if (rect.width < 20 || rect.height < 20) {
    cancelCapture();
    return;
  }

  // Hide the overlay, and give the page a moment to repaint without it before the screenshot.
  overlay.style.display = 'none';
  selectionBox.style.display = 'none';
  if (sizeIndicator) sizeIndicator.style.display = 'none';
  await new Promise(resolve => setTimeout(resolve, 60));

  try {
    // Capture the visible tab
    const imageData = await captureSelection(rect);

    if (imageData) {
      // Send to background script for upload
      chrome.runtime.sendMessage({
        action: 'uploadReceipt',
        imageData: imageData,
      });

      showCaptureSuccess();
    }
  } catch (error) {
    console.error('Capture error:', error);
    showCaptureError(error.message);
  }

  // Cleanup
  cancelCapture();
}

// Capture the selected area: a screenshot of the visible tab from the background, cropped to the
// selection and encoded for upload (shared/image.js).
async function captureSelection(rect) {
  const response = await chrome.runtime.sendMessage({ action: 'captureTab' }).catch(() => null);
  if (!response?.imageData) throw new Error("Couldn't take a screenshot of this page.");
  return cropImage(response.imageData, rect);
}

// Crop the screenshot to the selection. The screenshot is in device pixels, the selection in CSS
// pixels, so the selection is scaled by devicePixelRatio (which also covers page zoom).
async function cropImage(imageDataUrl, rect) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const dpr = window.devicePixelRatio || 1;
      resolve(globalThis.rwEncodeForUpload(img, rect.left * dpr, rect.top * dpr, rect.width * dpr, rect.height * dpr));
    };
    img.onerror = () => reject(new Error('Failed to load the screenshot'));
    img.src = imageDataUrl;
  });
}

// Handle keyboard events
function handleKeyDown(e) {
  if (e.key === 'Escape') {
    cancelCapture();
  }
}

// Cancel capture mode
function cancelCapture() {
  isCapturing = false;

  // Remove event listeners
  if (overlay) overlay.removeEventListener('mousedown', handleMouseDown);
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
  document.removeEventListener('keydown', handleKeyDown);

  // Remove overlay elements
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
  if (selectionBox) {
    selectionBox.remove();
    selectionBox = null;
  }
  if (sizeIndicator) {
    sizeIndicator.remove();
    sizeIndicator = null;
  }
}

// Toasts in the page. Built from elements, not innerHTML: the error text can come from the server,
// and this runs inside someone else's page.
const TOAST_ICONS = {
  success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
  error: '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>',
};

function showToast(type, text, durationMs) {
  const toast = document.createElement('div');
  toast.className = `receiptwise-toast receiptwise-toast-${type}`;
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('width', '20');
  icon.setAttribute('height', '20');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '2');
  icon.innerHTML = TOAST_ICONS[type]; // constant markup above, never a message
  const label = document.createElement('span');
  label.textContent = text;
  toast.append(icon, label);
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, durationMs);
}

function showCaptureSuccess() {
  showToast('success', 'Sending to ReceiptWise…', 3000);
}

function showCaptureError(message) {
  showToast('error', message || 'Failed to capture the receipt', 4000);
}

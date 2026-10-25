// Cropper page script - handles selection and upload of cropped screenshot

// Get screenshot data from URL params
const urlParams = new URLSearchParams(window.location.search);
const screenshotKey = urlParams.get('key');

// DOM elements
const screenshot = document.getElementById('screenshot');
const container = document.getElementById('container');
const selection = document.getElementById('selection');
const sizeIndicator = document.getElementById('size-indicator');
const uploadBtn = document.getElementById('upload-btn');
const cancelBtn = document.getElementById('cancel-btn');
const loading = document.getElementById('loading');

// Selection state
let isSelecting = false;
let startX = 0;
let startY = 0;
let currentSelection = null;

// Load screenshot from storage
async function loadScreenshot() {
  try {
    const { [`screenshot_${screenshotKey}`]: imageData } = await chrome.storage.local.get(`screenshot_${screenshotKey}`);

    if (!imageData) {
      alert('Screenshot not found. Please try again.');
      window.close();
      return;
    }

    screenshot.src = imageData;

    // Clean up storage after loading
    chrome.storage.local.remove(`screenshot_${screenshotKey}`);
  } catch (error) {
    console.error('Failed to load screenshot:', error);
    alert('Failed to load screenshot. Please try again.');
    window.close();
  }
}

// Initialize
loadScreenshot();

// Selection handling
screenshot.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;

  isSelecting = true;
  const rect = screenshot.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;

  selection.style.left = `${rect.left + startX}px`;
  selection.style.top = `${rect.top + startY}px`;
  selection.style.width = '0';
  selection.style.height = '0';
  selection.classList.add('active');

  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isSelecting) return;

  const rect = screenshot.getBoundingClientRect();
  const currentX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
  const currentY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  const left = Math.min(currentX, startX);
  const top = Math.min(currentY, startY);

  selection.style.left = `${rect.left + left}px`;
  selection.style.top = `${rect.top + top}px`;
  selection.style.width = `${width}px`;
  selection.style.height = `${height}px`;

  // Update size indicator
  sizeIndicator.textContent = `${Math.round(width)} × ${Math.round(height)}`;

  currentSelection = { left, top, width, height };
});

document.addEventListener('mouseup', () => {
  if (!isSelecting) return;
  isSelecting = false;

  // Enable upload button if selection is valid
  if (currentSelection && currentSelection.width > 20 && currentSelection.height > 20) {
    uploadBtn.disabled = false;
  } else {
    uploadBtn.disabled = true;
    selection.classList.remove('active');
    currentSelection = null;
  }
});

// Upload button
uploadBtn.addEventListener('click', async () => {
  if (!currentSelection) return;

  // Disable button and show loading
  uploadBtn.disabled = true;
  loading.classList.remove('hidden');
  updateLoadingText('Preparing image...');

  try {
    // Get the actual image dimensions vs displayed dimensions
    const displayedWidth = screenshot.clientWidth;
    const displayedHeight = screenshot.clientHeight;
    const naturalWidth = screenshot.naturalWidth;
    const naturalHeight = screenshot.naturalHeight;

    const scaleX = naturalWidth / displayedWidth;
    const scaleY = naturalHeight / displayedHeight;

    // Scale selection to actual image coordinates
    const scaledSelection = {
      left: currentSelection.left * scaleX,
      top: currentSelection.top * scaleY,
      width: currentSelection.width * scaleX,
      height: currentSelection.height * scaleY,
    };

    // Crop and encode for upload (shared/image.js): scaled down if huge, and WebP rather than PNG.
    const croppedImageData = globalThis.rwEncodeForUpload(
      screenshot,
      scaledSelection.left,
      scaledSelection.top,
      scaledSelection.width,
      scaledSelection.height,
    );

    updateLoadingText('Uploading to ReceiptWise...');

    // Send to background script for upload and wait for response
    const response = await chrome.runtime.sendMessage({
      action: 'uploadReceiptWithResponse',
      imageData: croppedImageData,
    });

    if (response?.success) {
      // Show success state
      loading.classList.add('success');
      updateLoadingText('Upload complete!');
      // Close after showing success
      setTimeout(() => {
        window.close();
      }, 1000);
    } else {
      throw new Error(response?.error || 'Upload failed');
    }

  } catch (error) {
    console.error('Upload error:', error);
    loading.classList.add('hidden');
    uploadBtn.disabled = false;
    showError(error.message || 'Failed to upload. Please try again.');
  }
});

// Helper to update loading text
function updateLoadingText(text) {
  const loadingText = document.querySelector('.loading-text');
  if (loadingText) {
    loadingText.textContent = text;
  }
}

// Helper to show error message
function showError(message) {
  // Create error toast if it doesn't exist
  let errorToast = document.getElementById('error-toast');
  if (!errorToast) {
    errorToast = document.createElement('div');
    errorToast.id = 'error-toast';
    errorToast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      padding: 14px 24px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      z-index: 300;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
      animation: slideUp 0.3s ease;
    `;
    document.body.appendChild(errorToast);
  }
  errorToast.textContent = message;
  errorToast.style.display = 'block';

  // Hide after 4 seconds
  setTimeout(() => {
    errorToast.style.display = 'none';
  }, 4000);
}

// Cancel button
cancelBtn.addEventListener('click', () => {
  window.close();
});

// Escape key to cancel
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.close();
  }
});

// Clear selection on new click outside
container.addEventListener('mousedown', (e) => {
  if (e.target === container) {
    selection.classList.remove('active');
    currentSelection = null;
    uploadBtn.disabled = true;
  }
});

// Shared by the snipping overlay (content/content.js) and the cropper page.
//
// Captures are screenshots at the screen's full resolution. Sent as PNG, a large selection on a
// retina screen could pass the 4.5 MB a Vercel function accepts, and the upload failed with a bare
// 413. The image is scaled so its longest side is at most 2400 px (more than enough to read a
// receipt) and sent as WebP, typically a tenth of the size.
//
// Assigned to globalThis rather than declared, so injecting it into a tab twice is harmless.
globalThis.RW_MAX_UPLOAD_SIDE = 2400;

globalThis.rwEncodeForUpload = globalThis.rwEncodeForUpload || function rwEncodeForUpload(source, sx, sy, sw, sh) {
  const scale = Math.min(1, globalThis.RW_MAX_UPLOAD_SIDE / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const context = canvas.getContext('2d');
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/webp', 0.9);
};

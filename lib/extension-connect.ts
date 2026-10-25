/** Chrome extension ids are 32 letters a–p. */
export function isExtensionId(value: string): boolean {
  return /^[a-p]{32}$/.test(value);
}

/**
 * Whether this extension may be handed a key by the one-click connect. EXTENSION_IDS
 * (comma-separated) pins it to the Chrome Web Store listing once there is one, so the connect page
 * can't give a key to some other extension that also lists receiptwise.io as allowed to message
 * it. Unset (before the listing exists, and for unpacked development copies), any well-formed id is
 * accepted.
 */
export function isAllowedExtension(id: string, configured: string | undefined = process.env.EXTENSION_IDS): boolean {
  if (!isExtensionId(id)) return false;
  const allowed = (configured ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  return allowed.length === 0 || allowed.includes(id);
}

# ReceiptWise Clipper

A Chrome extension (Manifest V3) that clips a receipt or bill from any web page into ReceiptWise. You drag over it on the page; it's uploaded, read and filed. A bill goes to the Bill inbox, not Receipts.

## Using it

1. **Connect.** Click the toolbar icon, then **Connect to ReceiptWise**. A tab opens on receiptwise.io: sign in if asked, then press **Connect**. The page hands the extension its own API key. You can revoke that key any time in Settings → Integrations.
   - The fallback, **Use an API key instead**, takes a key created in Settings → Integrations.
2. **Clip.** Click the icon, then **Clip a receipt or bill**, or press `⌃⇧R` on a Mac (`Alt+Shift+R` elsewhere). Drag over the receipt; `Esc` cancels.
   - On pages Chrome won't let an extension draw on (Gmail, Google sign-in, the Web Store), a screenshot opens in a cropper tab instead.
3. A notification says it was sent. Click it to open the receipt. If it was a bill, you're taken to the Bill inbox on the Plan.

Needs ReceiptWise Premium.

## Permissions, and why

| Permission | For |
| --- | --- |
| `activeTab` | The page you clip from, and only when you click the icon or press the shortcut. |
| `scripting` | Drawing the selection overlay on that page. |
| `storage` | The API key (`storage.sync`), the account it belongs to, and a screenshot passed to the cropper (`storage.local`). |
| `notifications` | "Sent" and error messages. |
| host `https://www.receiptwise.io/*` | Uploads, and checking the key. |

There is no access to other sites: no `<all_urls>`, no `tabs`. `externally_connectable` lets only receiptwise.io pages message the extension, and the service worker checks the sender's origin as well.

## How it fits together

```
chrome-extension/
├── manifest.json
├── config.js                  # The site it talks to (one place)
├── background/service-worker.js   # Starts captures, uploads, takes the key from the connect page
├── content/content.{js,css}   # The selection overlay, injected on demand
├── cropper/cropper.{html,js}  # Fallback for pages the overlay can't run on
├── shared/image.js            # Crop, scale to 2400 px max, encode as WebP for upload
├── popup/popup.{html,css,js}  # Connect, account, capture button
├── icons/
├── store/                     # Chrome Web Store listing copy and images (not packaged)
└── scripts/                   # Icon generation, packaging (not packaged)
```

The server routes it uses are all in the Next.js app:
- `POST /api/extension/verify`: checks the key and returns `{ user: { email, subscribed } }`.
- `POST /api/extension/upload`: takes a multipart `file` (WebP, JPEG or PNG). It creates a receipt and reads it, and moves it to the Bill inbox if the reader says it's a bill.
- `POST /api/extension/connect`: called by the signed-in `/connect/extension` page. It mints the key handed to the extension. Once the extension is listed, set `EXTENSION_IDS` to its Web Store id, so only that extension can be given a key.

Uploads are WebP at most 2400 px on the longest side, because Vercel functions refuse request bodies over 4.5 MB.

## Development

1. Edit `config.js` to point at your dev server, e.g. `http://localhost:3000`. Add that origin to `host_permissions` and `externally_connectable.matches` in `manifest.json`. **Put both back before packaging.**
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick this folder.
3. After a change, press the reload icon on the extension's card, then reload the page you're testing on.

## Packaging for the Web Store

`npm run extension:zip` (from the repo root) writes `receiptwise-clipper-<version>.zip`. It packages only what the extension needs: no `README.md`, `scripts/` or `store/`. It refuses to package if `config.js` or the manifest point anywhere but https://www.receiptwise.io.

Listing copy, permission justifications, privacy-practices answers and images are in `store/`.

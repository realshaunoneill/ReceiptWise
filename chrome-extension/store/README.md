# Chrome Web Store listing

Everything the developer dashboard asks for, for ReceiptWise Clipper 1.1.0. The package is `npm run extension:zip`, from the repo root.

## Store listing tab

**Name** (from the manifest): ReceiptWise Clipper

**Summary** (from the manifest, 132 characters at most): Clip a receipt or bill from any web page into ReceiptWise, where it's read and filed for you.

**Category**: Productivity → Tools

**Language**: English

**Description**:

> Clip receipts and bills from any web page straight into ReceiptWise.
>
> Bought something online? Drag over the order confirmation, invoice or e-receipt, and ReceiptWise reads it for you: the shop, the date, every item, the VAT and the total. It's filed with the rest of your receipts, and shared with your household if you share with one.
>
> Clip a bill (electricity, broadband, a card statement) and it goes to the Bill inbox on your Plan instead, ready to file against the bill it belongs to.
>
> How it works
> • Click the ReceiptWise icon, or press Control+Shift+R on a Mac (Alt+Shift+R elsewhere)
> • Drag over the receipt. Esc cancels
> • It's sent to your account and read in a few seconds
>
> Connect in one click: press Connect to ReceiptWise, sign in, and the extension gets its own key. Revoke it any time in Settings → Integrations.
>
> Private by design
> • The extension sees a page only when you start a clip on it, and sends only the area you select
> • It can't read your browsing history or any other site, and talks only to receiptwise.io
>
> Needs a ReceiptWise account with Premium. Sign up at https://www.receiptwise.io

**Images**: `screenshot-1.jpg` to `screenshot-4.jpg` (1280×800), in that order, and `promo-440x280.jpg` as the small promo tile. The store icon is the package's `icons/icon128.png`.

**Official URL**: https://www.receiptwise.io. **Homepage**: https://www.receiptwise.io. **Support**: https://www.receiptwise.io/support

## Privacy practices tab

**Single purpose**: Capture an area of the web page the user is on (a receipt, invoice or bill) and add it to their ReceiptWise account.

**Permission justifications**:

| Permission | Justification |
| --- | --- |
| `activeTab` | To take a screenshot of the tab the user is on and draw the selection overlay on it. It applies only after the user clicks the toolbar button or presses the shortcut, and only to that tab. |
| `scripting` | To add the selection overlay to that tab when the user starts a clip. |
| `storage` | To keep the user's ReceiptWise API key and account email, and to pass a screenshot to the extension's own cropper page on pages where the overlay can't run. The screenshot is deleted once the cropper has loaded it. |
| `notifications` | To tell the user that a clip was sent, or why it failed. |
| Host `https://www.receiptwise.io/*` | To upload the clip to the user's account and to check the API key. The extension contacts no other site. |

**Remote code**: No. All of the extension's code is in the package.

**Data usage**: tick these, all for the extension's single purpose:

- **Personally identifiable information**: a clipped receipt can show a name or delivery address.
- **Financial and payment information**: the receipts and bills the user clips.
- **Authentication information**: the API key, which is sent with each upload.
- **Website content**: the image of the area the user selects.

Leave the rest unticked: health, personal communications, location, web history and user activity. The extension sends no URLs, page text or browsing data.

Then tick all three certifications: the data is not sold to third parties, not used or transferred for anything unrelated to the single purpose, and not used to determine creditworthiness or for lending. Reading a receipt with an AI model, as the privacy policy describes, is part of that purpose.

**Privacy policy URL**: https://www.receiptwise.io/privacy. It has a section on the extension.

## For the reviewer

The "Test instructions" field. Reviewers need a Premium account, or they can only connect and see the upsell. Give them a production account with Premium, and remove it after review:

> Sign in at https://www.receiptwise.io with the account below. Then click the extension's icon and press "Connect to ReceiptWise", and press Connect on the page that opens. On any page with a receipt or invoice, click the icon again and press "Clip a receipt or bill", then drag over it. The receipt shows on https://www.receiptwise.io/receipts within a few seconds.

## After it's published

1. Set `EXTENSION_IDS` in Vercel (Production) to the Web Store id, so that only the listed extension can be given a key by `/connect/extension`. Unpacked copies get a different id, so add theirs too, comma-separated, if you still use one.
2. Replace the "coming soon" copy with a link to the listing: the landing page's feature badge, the pricing list, the comparison table, the Settings integrations card and the line on the Receipts page.

## Regenerating the images

The images are HTML in `src/`, rendered from real captures in `src/captures/` (2x, light theme):

- `clip.webp`: the extension's overlay mid-drag over `src/order.html`, a made-up shop's order page
- `receipt.webp`: that clip as ReceiptWise read it
- `bills.webp`: the Plan's Bill inbox
- `connect-done.webp`, `popup.webp`: the connect page and the popup once connected

The captures came from a dev server with the test account, using `src/capture-init.js` as an agent-browser `--init-script`. It sets the light theme, declines analytics, hides the staging banner and dev tools, and shows a made-up email address.

To render them, serve `chrome-extension/` (for example `python3 -m http.server 8766 --directory chrome-extension`). Then screenshot `store/src/screenshot.html?n=1` to `?n=4` at a 1280×800 viewport, and `store/src/promo.html` at 440×280, both at scale 1, as JPEG.

# receiptwise-inbound-email

A Cloudflare Email Worker that takes mail sent or forwarded to `<token>@in.receiptwise.io` and
hands it to the app, which reads the bills and receipts in it. How it works is in `src/index.ts`;
the app side is `lib/inbound-email/` and `app/api/webhooks/inbound-email/`.

It is not part of the Next.js build (excluded in the root `tsconfig.json` and `eslint.config.mjs`).

## Setting it up (once)

The app needs the private bills Blob store first (`BILLS_BLOB_READ_WRITE_TOKEN` in Vercel; see
`lib/storage/private-blob.ts`).

1. **Secret.** Generate one (`openssl rand -hex 32`) and put it in both places, without writing it
   to a file:
   - Vercel, all environments: `INBOUND_WORKER_SECRET`
   - the Worker: `npx wrangler secret put INBOUND_WORKER_SECRET` (and `--env staging`)
   Also set `INBOUND_EMAIL_DOMAIN=in.receiptwise.io` in Vercel (`in-staging.receiptwise.io` for Preview).
2. **Deploy:** `npm install && npm run deploy` in this folder.
3. **Email Routing on the subdomain only.** In Cloudflare for `receiptwise.io`: Email → Email Routing
   → Settings → Subdomains → add `in.receiptwise.io`. Check exactly which DNS records it will add
   before confirming: they must be MX/TXT records on `in.receiptwise.io`. **The apex MX records
   (`aspmx1`/`aspmx2.migadu.com`) must not change**; if Cloudflare wants to touch them, stop.
4. **Route:** Email Routing → Routing rules → Catch-all address → Send to a Worker →
   `receiptwise-inbound-email`. Add `support@receiptwise.io` as a verified destination address
   (it is the fallback when the app is unreachable).
5. **Check:** in the app, Settings → Integrations shows your address. Send it a bill as an
   attachment: it should appear on the Plan page within a minute.

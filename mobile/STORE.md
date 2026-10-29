# Store readiness

What the App Store and Google Play need before ReceiptWise can launch, and where each thing
stands. The plan's Phase 6 (`~/.claude/plans/could-we-build-it-sorted-moore.md`) has the reasoning.
Tick an item when it's true in the store's console, not when the code merely exists.

## Apple App Store

| Guideline | What it needs | Where it stands |
| --- | --- | --- |
| 2.1 App completeness | A reviewer can sign in and see real data | A demo account is owed: an `@receiptwise.test`-style login doesn't work in production, so it has to be a Google account with seeded data and comp Premium |
| 3.1.1 In-app purchase | Premium bought in the app goes through Apple | Built behind `EXPO_PUBLIC_REVENUECAT_*` (phase 3); needs the products and RevenueCat |
| 3.1.1 No steering | No link or price for buying on the website | Settings says "Billed through the ReceiptWise website" as plain text for Stripe customers |
| 3.1.2 Subscriptions | The paywall states price, length, trial and auto-renewal, with Terms (EULA) and Privacy links, and offers Restore | In the paywall (phase 3) |
| 4.8 Sign in with Apple | Offered alongside Google | Done; Apple's private relay addresses get the "new or existing?" step |
| 5.1.1(v) Account deletion | Deleting the account from inside the app | Settings → Delete account; it warns that a store subscription isn't cancelled by deleting |
| 5.1.2 Data use | The privacy label matches what's collected | Privacy policy covers the app (high level since 2026-10-29: kinds of data and of company); the label is to fill in (below) |

**App Store Connect: app 6828428892 "ReceiptWise"** (`io.receiptwise.app`, primary language
English (UK), SKU `receiptwise`), created 2026-10-29 with the web session. Filled in that day:

| Field | Value |
| --- | --- |
| Subtitle | Receipts, bills and your month |
| Description, promotional text, keywords | in App Store Connect (keywords 94 of 100 bytes) |
| URLs | support /support, marketing www.receiptwise.io, privacy /privacy |
| Copyright | 2026 Shaun O'Neill |
| Categories | Finance, then Productivity |
| Price | Free (base country Ireland); Premium comes as an in-app purchase later |
| Content rights | Doesn't use third-party content |
| Age rating | Nothing objectionable, no user-generated content (households share privately), 4+ |
| App Privacy | Published, below |
| TestFlight | Test information in; internal group "Team" (every build) with Shaun |

Still owed: availability (which countries), the App Review contact phone, screenshots, review
notes, and the demo account. Export compliance: `ITSAppUsesNonExemptEncryption: false` is set.
Screenshots: 6.9" iPhone (1320 × 2868) of Home, Plan, a receipt, capture and Bills, with persona data.
Review notes: how to sign in (the demo account), that the camera is for scanning, how to delete the
account, and a sandbox purchase.

**Privacy label, as published (all linked to the user, no tracking):**
- App functionality: email address, name, user ID, device ID (notifications), photos (receipts),
  other user content, purchase history (receipts), other financial info (bills, balances, pay),
  crash data.
- Analytics: product interaction, only with analytics consent (recorded by the server).

## Google Play

- **Closed testing:** 12 or more testers opted in for 14 days before production access is granted.
- **Data safety form:** the same data as Apple's label. Data is encrypted in transit, and deletion can be requested in the app and at https://www.receiptwise.io/delete-account.
- **Financial features declaration:** a personal finance and budgeting app. It doesn't connect to banks, and it doesn't lend, trade or hold money.
- **App access:** the demo Google account, as for Apple.
- **Listing:** the 512 px icon is `store/play-icon.png` (from `scripts/brand-assets.py`). A 1024 × 500 feature graphic and phone screenshots are still owed.
- **Target API level:** whatever Expo SDK 58 sets. Check `npx expo config` before submitting.

## Before the first store build

- **Apple step on cevo:** done 2026-10-29 for the first production build: Push Notifications on the App ID, an App Store provisioning profile, and a new APNs key assigned on EAS. Later the widget and the share extension need an app group. Never do this from the work Mac: see the memory note `eas-cli-keychain-alert`.
- **Firebase:** a project for FCM v1, its `google-services.json` as an EAS file env, and a service account.
- **RevenueCat:** the project, the `premium` entitlement, the store products, the webhook secret (`REVENUECAT_WEBHOOK_AUTH` on Vercel) and its DPA. The privacy policy names no suppliers, so it needs only "app store billing" added under Payments.
- **EAS:** a production build (`autoIncrement`), then a submission. Builds are scarce on the free plan, so batch native changes.
- **Legal:** the privacy policy names the controller and describes processors by kind, never by name (`app/(support)/legal-pages.test.ts` enforces it). When in-app purchase goes live, say that Apple or Google bill a subscription bought in the app.

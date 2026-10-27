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
| 5.1.2 Data use | The privacy label matches what's collected | Privacy policy updated 2026-10-27 for the app; the label is to fill in (below) |

**Also for App Store Connect:**
- Screenshots: 6.9" iPhone (1320 × 2868) of Home, Plan, a receipt, capture and Bills, with persona data.
- The age rating questionnaire.
- Export compliance: `ITSAppUsesNonExemptEncryption: false` is set.
- Review notes: how to sign in (the demo account), that the camera is for scanning, how to delete the account, and a sandbox purchase.

**Privacy label (data linked to the user):**
- Contact info: email.
- Financial info: purchase history, other financial info.
- User content: photos, other user content.
- Identifiers: user ID.
- Diagnostics: crash data.
- Usage data: product interaction, only with analytics consent.
- No tracking.

## Google Play

- **Closed testing:** 12 or more testers opted in for 14 days before production access is granted.
- **Data safety form:** the same data as Apple's label. Data is encrypted in transit, and deletion can be requested in the app and at https://www.receiptwise.io/delete-account.
- **Financial features declaration:** a personal finance and budgeting app. It doesn't connect to banks, and it doesn't lend, trade or hold money.
- **App access:** the demo Google account, as for Apple.
- **Listing:** the 512 px icon is `store/play-icon.png` (from `scripts/brand-assets.py`). A 1024 × 500 feature graphic and phone screenshots are still owed.
- **Target API level:** whatever Expo SDK 58 sets. Check `npx expo config` before submitting.

## Before the first store build

- **Apple step on cevo:** the App ID needs the Push Notifications capability and an APNs key. Later, it also needs an app group for the widget and the share extension. Never do this from the work Mac: see the memory note `eas-cli-keychain-alert`.
- **Firebase:** a project for FCM v1, its `google-services.json` as an EAS file env, and a service account.
- **RevenueCat:** the project, the `premium` entitlement, the store products, the webhook secret (`REVENUECAT_WEBHOOK_AUTH` on Vercel) and its DPA. Then add RevenueCat and store billing to the privacy policy.
- **EAS:** a production build (`autoIncrement`), then a submission. Builds are scarce on the free plan, so batch native changes.
- **Legal:** the privacy policy names the controller and its processors. Add RevenueCat, Apple and Google as billing processors when in-app purchase goes live.

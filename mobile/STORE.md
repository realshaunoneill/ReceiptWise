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
| Subtitle | Know what's left until payday (since 2026-10-30; see "Listing copy" below) |
| Description, promotional text, keywords | in App Store Connect (keywords 94 of 100 bytes) |
| URLs | support /support, marketing www.receiptwise.io, privacy /privacy |
| Copyright | 2026 Shaun O'Neill |
| Categories | Finance, then Productivity |
| Price | Free (base country Ireland); Premium comes as an in-app purchase later, at the prices below |
| Content rights | Doesn't use third-party content |
| Age rating | Nothing objectionable, no user-generated content (households share privately), 4+ |
| App Privacy | Published, below |
| TestFlight | Test information in; internal group "Team" (every build) with Shaun; build 1.0.0 (3) live there since 2026-10-29 |
| Build for the App Store version | 1.0.0 (3) attached to version 1.0 on 2026-10-30, so its icon shows in App Store Connect; replace it with the store build when there is one |

## Premium's prices (decided 2026-10-29)

The same on the website (Stripe), the App Store and Google Play. On the website the trial is
`NEXT_PUBLIC_STRIPE_TRIAL_DAYS=14`, and the live prices are `price_1UW2aSIiErQWui9ErO16TNJl` (monthly)
and `price_1UW2aTIiErQWui9E3HOoXuPO` (yearly). Subscribers from before then keep the price they have.

| Product | Store product id | Price (Ireland, the base) | Introductory offer |
| --- | --- | --- | --- |
| Premium, monthly | `io.receiptwise.premium.monthly` | €4.99 a month | Free for 2 weeks, new subscribers only |
| Premium, yearly | `io.receiptwise.premium.yearly` | €34.99 a year | Free for 2 weeks, new subscribers only |

- **One subscription group, "Premium"**, holding both, so changing between them is an upgrade or a
  downgrade rather than a second subscription. Other countries take Apple's and Google's equalised
  prices from the Irish base.
- **The yearly plan is the one sold:** list it first in the RevenueCat offering, as the website does.
- **Enrol in the App Store Small Business Program** before the first sale. Otherwise the commission is
  30%, not 15%.
- The paywall reads prices and the trial from the store (`src/purchases/terms.ts`), so nothing in the
  app needs changing when they're set. Never type a price into the app.

## Listing copy (2026-10-29, to replace what's in App Store Connect)

The plan leads, as on the website. **In App Store Connect since 2026-10-30** (pushed through iris
with `ASC_WEB_SESSION` and read back): en-GB app info localization `20e3699b-…` for the subtitle,
and version 1.0's localization `4483559b-…` for the rest. Change it here first, then there.

| Field | Text |
| --- | --- |
| Subtitle (29 of 30) | Know what's left until payday |
| Promotional text (165 of 170) | Your pay, your bills and your spending in one plan, payday to payday. Receipts and bills are read for you, and the plan is shared with your household. No bank login. |
| Keywords (95 of 100 bytes) | `budget,planner,bills,receipt,scanner,household,family,money,spending,tracker,salary,tax,ireland` |

Keywords leave out the words already in the name and subtitle, which Apple indexes anyway.

Description:

```
Know what's left until payday.

ReceiptWise puts your pay, your bills and your spending in one plan that runs from one payday to the next. It shows what's left after the bills, and what that comes to each week.

YOUR MONTH, PLANNED
• Add your pay and your main bills, or paste them from your budget spreadsheet
• A bigger card bill this month? Change that month's amount and the rest of the plan follows
• Savings goals and one-offs, with a weekly figure for what's left

BILLS AND RECEIPTS, READ FOR YOU
• Photograph a receipt: the shop, the date, every item and the total are read for you
• Scan a paper bill or forward the email to your own ReceiptWise address, and file it against the right bill and month
• Doctor, consultant and pharmacy receipts are sorted into Healthcare and Pharmacy as they arrive, so the year's are in one place for your tax-back claim

PLANNED TOGETHER
• Share the plan, bills and receipts with your partner or the family
• One Premium covers up to six people in your household

NO BANK LOGIN
Nothing connects to your bank. You decide what goes in.

Premium includes everything, with a free trial for new subscribers. Payment is charged to your Apple Account when you confirm the purchase. The subscription renews automatically unless it is cancelled at least 24 hours before the end of the current period. Manage or cancel it in your Apple Account settings.

Terms: https://www.receiptwise.io/terms
Privacy: https://www.receiptwise.io/privacy
```

Still owed: availability (which countries), the App Review contact phone, screenshots, review
notes, and the demo account. Export compliance: `ITSAppUsesNonExemptEncryption: false` is set.
Screenshots: 6.9" iPhone (1320 × 2868) of Home, Plan, a receipt, capture and Bills, with persona data.
With iPad support on (`supportsTablet`, from the build after 1.0.0 (3)), 13" iPad screenshots
(2064 × 2752) are required too. The app's web build at 1032 × 1376 shows the iPad layout.
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

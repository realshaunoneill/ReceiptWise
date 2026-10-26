# ReceiptWise app

The iOS and Android app (Expo SDK 58, Expo Router, TanStack Query), in the same repository as the
website, which is its server. It's built on what Behind The Badge's app learned; the plan and its
phases are in `~/.claude/plans/could-we-build-it-sorted-moore.md`, and the design is `DESIGN.md` at the
repository root.

## Layout

- `app/`: the screens (Expo Router):
  - `sign-in` and `capture`
  - five tabs, Home, Receipts, Plan, Bills and Settings, each with its own stack
- `src/`:
  - `auth/` signs in with Google, Apple, or a password for test accounts, and keeps the session
    token in SecureStore
  - `api/` holds the fetch client and its errors
  - `hooks/` holds the queries and mutations
  - `upload/` is the capture queue
  - `ui/` holds the primitives; `theme/` holds the colours, from the website's tokens
- `../shared/`: framework-free code the website uses too: money, dates, the plan's maths, query
  keys, and the wire types of what the API returns (`shared/api/`).
  - Nothing there imports a package (`shared/imports.test.ts`).
  - The website's `lib/types/wire-contract.ts` fails `tsc` if a route stops matching its wire type.

## Running it

`npm install` here (not at the root: this is its own package), then:

- **Checking screens in a browser** (no device needed):
  1. Run the website with the test login on: from the root, `RECEIPTWISE_DEV_LOGIN=1 npm run dev`,
     or `next dev -p 3418` with `BETTER_AUTH_URL` to match.
  2. Run `EXPO_PUBLIC_SITE_URL=http://localhost:3418 EXPO_PUBLIC_DEV_LOGIN=1 npx expo start --web`
     on port 8081. That origin is trusted by the auth server in development only.
  3. Open it in a Chrome started with `--disable-web-security`: the API sends no CORS headers.
  4. Sign in with a test account (`claude@receiptwise.test`; the password is on cevo as
     `RECEIPTWISE_STAGING_TEST_PASSWORD`).

  Native tabs draw as a bar across the top in this preview only. Camera and file uploads need a
  phone.
- **On a phone:** a development build from EAS (`eas build --profile development`). This Mac has
  no Xcode or Android SDK, so every build is on EAS.
  - Expo Go can't be used: signing in returns to the app's `receiptwise://` scheme, which Expo Go
    doesn't have.
  - iOS builds need the Apple Developer membership.
- **Build profiles** (`eas.json`):
  - `preview` talks to production.
  - `e2e` talks to staging, with the password sign-in for test accounts.
  - Secrets go in with `eas env:create`, never in the repository.

## Checks

`npm run verify` runs `tsc` and the unit tests: the cookie jar, API errors, the upload queue and
receipt grouping. Screens aren't unit-tested; check them in the web preview and on a device.
`npx expo-doctor` checks the dependencies against the SDK. To upgrade the SDK, run
`npx expo install expo@^59.0.0 --fix`; if npm can't resolve it, delete `node_modules` and
`package-lock.json` and install again.

## Things learned the hard way (from Behind The Badge)

- **Deploy the server before any build that needs it.** App sign-in from Behind The Badge's app
  returned 500 in production until `lib/expo-origin.ts` existed. Check with curl, sending
  `expo-origin: receiptwise://`.
- **Close a sheet with `navigation.goBack()`.** After a swipe down, `router.back()` also pops the
  screen beneath.
- **Render string conditions with `!!`, never `&&`.** An empty string inside a `View` crashes React
  Native.
- **Validate anything read from the phone's storage,** because it outlives app versions.
- **Keep only the session token in SecureStore.** Some Android versions refuse values over 2 KB.

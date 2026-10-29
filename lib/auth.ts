import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthEndpoint, createAuthMiddleware, sessionMiddleware } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import { nextCookies } from 'better-auth/next-js';
import { multiSession } from 'better-auth/plugins';
import type { BetterAuthPlugin } from 'better-auth/types';
import { expo } from '@better-auth/expo';
import { db } from '@/lib/db';
import { authAccount, authSession, authUser, authVerification } from '@/lib/db/schema';
import { isDevLoginEnabled, isTestEmail, TEST_EMAIL_DOMAIN } from '@/lib/dev-login';

/**
 * Sign-in: Better Auth with Google (moved off Clerk on 2026-10-24, like the other products).
 *
 * Better Auth owns who someone is (auth_user, auth_session, auth_account). The app's own `users`
 * row, with the subscription, households and settings, is linked to it on first sign-in by
 * lib/auth-helpers.ts, which matches existing accounts by their verified email. So everyone who
 * used Clerk keeps their data: they sign in with the same Google account and land in it.
 *
 * Built on first use rather than at import: betterAuth() touches the database adapter eagerly, and
 * importing it at module scope would need DATABASE_URL during `next build`.
 */

const PRODUCTION_URL = 'https://www.receiptwise.io';
/** The app's deep-link scheme (`scheme` in mobile/app.config.ts) and its bundle id on both stores. */
const APP_SCHEME = 'receiptwise://';
const APP_BUNDLE_ID = 'io.receiptwise.app';
/**
 * The development build is an app of its own (APP_VARIANT=development in mobile/app.config.ts), so
 * it can sit beside the TestFlight or store app on one phone. Trusted everywhere but production:
 * nothing real signs in from it there, and in production its scheme would be one nobody's phone
 * claims, so another app could register it and catch a sign-in's redirect.
 */
const DEV_APP_SCHEME = 'receiptwise-dev://';
const DEV_APP_BUNDLE_ID = 'io.receiptwise.app.dev';
const TRUST_DEV_APP = process.env.VERCEL_ENV !== 'production';

/**
 * The website's account switcher keeps each account signed in to this browser in a cookie of its
 * own, which multiSession() sets on every new session. Sessions from before it was added have no
 * such cookie, so POST /multi-session/adopt gives the current one its cookie before "Add another
 * account" signs someone else in; without it, that first account would drop out of the switcher.
 */
const adoptSession = {
  id: 'adopt-session',
  endpoints: {
    adoptSession: createAuthEndpoint('/multi-session/adopt', { method: 'POST', use: [sessionMiddleware] }, async (ctx) => {
      // Sets the session cookie again, which multiSession()'s after-hook answers with the account's own cookie.
      await setSessionCookie(ctx, ctx.context.session);
      return ctx.json({ ok: true });
    }),
  },
} satisfies BetterAuthPlugin;

/** Where OAuth comes back to: BETTER_AUTH_URL (www in production, staging on Preview), else this deployment. */
function baseURL(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_BRANCH_URL) return `https://${process.env.VERCEL_BRANCH_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.NODE_ENV === 'production' ? PRODUCTION_URL : 'http://localhost:3000';
}

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user: authUser, session: authSession, account: authAccount, verification: authVerification },
    }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: baseURL(),
    trustedOrigins: [
      PRODUCTION_URL,
      'https://receiptwise.io',
      'https://staging.receiptwise.io',
      'http://localhost:3000',
      ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
      ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
      ...(process.env.VERCEL_BRANCH_URL ? [`https://${process.env.VERCEL_BRANCH_URL}`] : []),
      // The app. Expo Go's exp:// is trusted by the expo() plugin only under `next dev`, so signing
      // in needs a development or store build.
      APP_SCHEME,
      ...(TRUST_DEV_APP ? [DEV_APP_SCHEME] : []),
      // Apple's web flow posts its callback from here.
      'https://appleid.apple.com',
      // The app's web preview (`expo start --web`), for checking screens in a browser; development only.
      ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:8081'] : []),
    ],
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        // Always ask which Google account: a shared family computer is a common case here.
        prompt: 'select_account',
      },
      // Sign in with Apple, which the App Store requires next to Google. The app signs in natively
      // and posts Apple's identity token to /sign-in/social; checking it needs only the audience,
      // the bundle id, so this works with no Apple env. APPLE_CLIENT_ID (a Services ID) and
      // APPLE_CLIENT_SECRET (a signed JWT) are only for Apple's web redirect flow, which the
      // website doesn't offer yet.
      apple: {
        clientId: process.env.APPLE_CLIENT_ID || APP_BUNDLE_ID,
        clientSecret: process.env.APPLE_CLIENT_SECRET ?? '',
        appBundleIdentifier: APP_BUNDLE_ID,
        audience: [
          APP_BUNDLE_ID,
          ...(TRUST_DEV_APP ? [DEV_APP_BUNDLE_ID] : []),
          ...(process.env.APPLE_CLIENT_ID ? [process.env.APPLE_CLIENT_ID] : []),
        ],
      },
    },
    account: {
      // Google and Apple verify addresses, so signing in with Apple under the same email as a
      // Google account is the same person: it joins that account rather than making a new one.
      // Apple's "Hide my email" gives a different address, so the app offers to link the two from
      // Settings, which needs allowDifferentEmails (it applies only to a signed-in user linking).
      accountLinking: { enabled: true, trustedProviders: ['google', 'apple'], allowDifferentEmails: true },
    },
    // Off except locally and on staging (lib/dev-login.ts): Google covers everyone, and there is no
    // password to leak.
    emailAndPassword: {
      enabled: isDevLoginEnabled(),
      requireEmailVerification: false,
    },
    hooks: {
      // Password accounts are test accounts: only the reserved test domain. Nothing verifies a
      // password account's address, so with a real one it could be linked to that person's data.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/sign-up/email' && !isTestEmail(ctx.body?.email)) {
          throw new APIError('BAD_REQUEST', { message: `Password accounts must use an @${TEST_EMAIL_DOMAIN} address.` });
        }
      }),
    },
    session: {
      // A household app opened a few times a week: a long, rolling session.
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      // The session is checked on every API request; a signed 5-minute cookie cache saves a
      // database read each time (Clerk used to cost a network call to fetch the email instead).
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    // Sessions don't record the IP address they came from (one less thing for the privacy policy to
    // list: it says only that sessions are kept 30 days). That also
    // turns off better-auth's per-IP rate limiting, which on serverless is per instance anyway.
    advanced: { ipAddress: { disableIpTracking: true } },
    plugins: [
      // Lets the app sign in: it accepts the app's `expo-origin` header in place of the Origin a
      // browser sends, and after the Google callback hands the session to the app's deep link.
      // Browsers always send Origin and the website's callbacks are https, so the site is
      // untouched. The origin copy itself is lib/expo-origin.ts, in the auth route.
      expo({ disableOriginOverride: true }),
      // Several accounts signed in to one browser, as a household sharing a computer is: switch
      // between them from the account menu (components/layout/navigation.tsx). The app keeps its
      // own sessions, one per account (mobile/src/auth/accounts.ts), and sends only the active one.
      multiSession({ maximumSessions: 5 }),
      adoptSession,
      // Must be last: lets route handlers and server actions set cookies.
      nextCookies(),
    ],
  });
}

let instance: ReturnType<typeof createAuth> | null = null;

export function getAuth() {
  instance ??= createAuth();
  return instance;
}

export type AuthSession = NonNullable<Awaited<ReturnType<ReturnType<typeof getAuth>['api']['getSession']>>>;

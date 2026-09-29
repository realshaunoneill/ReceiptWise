import posthog from 'posthog-js';

/*
 * Analytics consent.
 *
 * PostHog used to initialise on first paint for every visitor — setting cookies, identifying the
 * person and recording the session with inputs unmasked — on a personal-finance app, with no
 * consent asked. Under ePrivacy/GDPR that needs prior opt-in, so PostHog now does not load at all
 * until the visitor accepts in the consent banner, and loads with inputs and amounts masked.
 *
 * The choice lives in localStorage (not a cookie) and can be changed from "Cookie settings" in the
 * footer. Vercel Analytics is cookieless and stays on regardless.
 */

export type ConsentChoice = 'granted' | 'denied';

const STORAGE_KEY = 'rw-analytics-consent';
export const CONSENT_COOKIE = 'rw-analytics-consent';
export const CONSENT_CHANGE_EVENT = 'rw-consent-change';
export const OPEN_CONSENT_EVENT = 'rw-open-consent';

export const isAnalyticsConfigured = !!process.env.NEXT_PUBLIC_POSTHOG_KEY;

export function getConsent(): ConsentChoice | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

export function setConsent(choice: ConsentChoice) {
  try {
    window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Storage unavailable (private mode): the choice holds for this page view only.
  }

  // Mirrored into a first-party cookie so server-side capture (hasServerAnalyticsConsent) can
  // honour the same choice. It records the preference only; it is not an analytics cookie.
  document.cookie = `${CONSENT_COOKIE}=${choice}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax${window.location.protocol === 'https:' ? '; secure' : ''}`;

  if (choice === 'granted') {
    initAnalytics();
  } else {
    if (posthog.__loaded) {
      // Changing your mind after accepting: stop capture for the rest of this page view.
      posthog.stopSessionRecording();
      posthog.opt_out_capturing();
    }
    clearAnalyticsStorage();
  }

  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: choice }));
}

/**
 * Remove what PostHog left behind: its cookie and its localStorage entries. PostHog does not
 * load again while consent is denied, so nothing re-creates them.
 */
function clearAnalyticsStorage() {
  try {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith('ph_') || key.startsWith('__ph'))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Storage unavailable: nothing to clear.
  }

  document.cookie
    .split(';')
    .map((cookie) => cookie.trim().split('=')[0])
    .filter((name) => name.startsWith('ph_'))
    .forEach((name) => {
      const expire = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      document.cookie = expire;
      // PostHog sets its cookie on the registrable domain (.receiptwise.io) when it can.
      document.cookie = `${expire}; domain=.${window.location.hostname.replace(/^www\./, '')}`;
    });
}

export function hasAnalyticsConsent() {
  return getConsent() === 'granted';
}

/** Initialise PostHog, once, and only after consent. */
export function initAnalytics() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || typeof window === 'undefined' || !hasAnalyticsConsent()) return;

  if (posthog.__loaded) {
    // Previously opted out in this page view, then accepted again.
    if (posthog.has_opted_out_capturing()) {
      posthog.opt_in_capturing();
      posthog.startSessionRecording();
    }
    return;
  }

  posthog.init(key, {
    api_host: '/ingest',
    ui_host: 'https://eu.posthog.com',
    defaults: '2025-05-24',
    capture_exceptions: true,
    debug: process.env.NODE_ENV === 'development',
    person_profiles: 'identified_only',
    respect_dnt: true,
    session_recording: {
      // Receipts, business notes, API keys and invite emails are all typed into this app.
      maskAllInputs: true,
      // Rendered money (every amount carries the .amount class) and anything marked private.
      maskTextSelector: '.amount, [data-private]',
    },
  });
}

import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { api } from './api/client';
import { Updates } from './updates';

type ErrorLike = { message?: unknown; stack?: unknown } | null | undefined;

/** Send an error to the website's logs (POST /api/app-errors). Best effort: never throws. */
export function reportError(error: unknown, path?: string | null) {
  const e = error as ErrorLike;
  api('/api/app-errors', {
    method: 'POST',
    json: {
      message: String(e?.message ?? error).slice(0, 1000),
      stack: typeof e?.stack === 'string' ? e.stack.slice(0, 6000) : undefined,
      path: path?.slice(0, 300) || undefined,
      appVersion: Application.nativeApplicationVersion ?? undefined,
      updateId: Updates?.updateId ?? undefined,
      platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
    },
  }).catch(() => undefined);
}

/**
 * Errors outside a screen's render (a tap handler, a timer) never reach the error screen: in a
 * release build a fatal one closes the app. Report them first, then let React Native carry on.
 */
export function reportUncaughtErrors() {
  const global = globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void; setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void } };
  if (Platform.OS === 'web' || !global.ErrorUtils) return;
  const previous = global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    reportError(error, isFatal ? 'fatal' : 'uncaught');
    previous(error, isFatal);
  });
}

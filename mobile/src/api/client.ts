import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { activeSlot } from '../auth/accounts';
import { absorbSetCookie, authHeaders, credentials } from '../auth/auth';
import { SITE_URL } from '../config';
import { ApiError, offlineError, toApiError } from './errors';

export { ApiError } from './errors';

/**
 * Every call to the website's API: the session (src/auth/auth.ts), which app and version is asking
 * (the server logs it, so old versions can be spotted before a change breaks them), and the
 * server's errors as ApiError (src/api/errors.ts). A refreshed session cookie on any response is
 * kept, since the session rolls over 30 days. A call is the active account's unless `account`
 * names another (src/auth/accounts.ts), as an upload captured by someone else on a shared iPad is.
 */

const CLIENT = `receiptwise-app/${Application.nativeApplicationVersion ?? 'dev'} (${Platform.OS})`;

/** The error, and the account (its slot) whose call it was. */
type Listener = (error: ApiError, account: string | null) => void;
const listeners = new Set<Listener>();

/** Hear about errors every screen should react to the same way: signed out, deletion pending. */
export function onApiError(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Sent as JSON. */
  json?: unknown;
  /** Sent as multipart (uploads). */
  form?: FormData;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Whose call it is (an account's slot): the active account's by default. */
  account?: string | null;
};

export async function api<T>(path: string, { method = 'GET', json, form, headers, signal, account = activeSlot() }: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SITE_URL}${path}`, {
      method,
      credentials,
      signal,
      headers: {
        Accept: 'application/json',
        'x-client': CLIENT,
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(await authHeaders(account)),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : form,
    });
  } catch (error) {
    if ((error as { name?: string }).name === 'AbortError') throw error;
    throw offlineError();
  }

  await absorbSetCookie(res, account);
  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const error = toApiError(res.status, body, res.headers.get('retry-after'));
    for (const listener of listeners) listener(error, account);
    throw error;
  }
  return body as T;
}

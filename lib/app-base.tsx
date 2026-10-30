'use client';

import { createContext, useCallback, useContext } from 'react';

/**
 * Where the app's pages are: '' normally, and '/demo' inside the demo (app/demo). There the plan,
 * bills and receipts link to each other's demo copies, and anything else (Settings, upgrading)
 * goes to sign-up instead, since the demo has no account behind it.
 */
const AppBase = createContext('');

export const AppBaseProvider = AppBase.Provider;

const IN_THE_DEMO = ['/plan', '/subscriptions', '/receipts'];

/** A link to one of the app's pages, made right for wherever the page is showing. */
export function useAppHref(): (path: string) => string {
  const base = useContext(AppBase);
  return useCallback((path: string) => {
    if (!base) return path;
    return IN_THE_DEMO.includes(path.split(/[?#]/)[0]) ? `${base}${path}` : '/sign-up';
  }, [base]);
}

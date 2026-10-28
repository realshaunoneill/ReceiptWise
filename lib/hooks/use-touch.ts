'use client';

import { useSyncExternalStore } from 'react';

const COARSE = '(pointer: coarse)';

function subscribe(onChange: () => void) {
  const query = window.matchMedia(COARSE);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** True on a touch screen (a coarse pointer). False on the server, so the first render says "Click". */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(COARSE).matches, () => false);
}

/** "Tap" on a phone, "Click" with a mouse: for hints like "Click an amount to change it". */
export function useTapOrClick(): 'Tap' | 'Click' {
  return useCoarsePointer() ? 'Tap' : 'Click';
}

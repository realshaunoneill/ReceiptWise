'use client';

import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTapOrClick } from '@/lib/hooks/use-touch';

const KEY = 'receiptwise-plan-intro-seen';

// One store for the card and the plan's section hints, so dismissing the card hides both.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function readSeen(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    // Storage blocked: don't nag on every visit.
    return true;
  }
}

/**
 * Whether How it works has been read. Seen on the server and in the first render, so the server's
 * page and the browser's agree; the card and the hints appear once the browser has checked.
 */
export function usePlanIntroSeen(): boolean {
  return useSyncExternalStore(subscribe, readSeen, () => true);
}

function dismissPlanIntro() {
  try {
    window.localStorage.setItem(KEY, '1');
  } catch {
    // Storage blocked: readSeen already says seen.
  }
  listeners.forEach((listener) => listener());
}

/**
 * How the plan works, until it's been read once: the things the page doesn't make obvious (bills
 * come first, an amount can change for one month, next month can be planned now). As on the app's
 * Plan.
 */
export function HowItWorks() {
  const seen = usePlanIntroSeen();
  const tap = useTapOrClick();
  if (seen) return null;
  return (
    <Card className="py-0">
      <CardContent className="space-y-3 p-5">
        <p className="font-medium">How your plan works</p>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>Each month runs from one payday to the next: your pay comes in, then the bills go out.</li>
          <li>After bills is what you have once the essentials are paid. Subscriptions, savings and one-offs come out of that.</li>
          <li>Something different this month, like a bigger credit card bill, a bonus or less to save? {tap} its amount. Only that month changes.</li>
          <li>Use the arrows to plan next month before it starts.</li>
        </ul>
        <Button variant="outline" size="sm" onClick={dismissPlanIntro}>
          Got it
        </Button>
      </CardContent>
    </Card>
  );
}

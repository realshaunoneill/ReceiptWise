'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const KEY = 'receiptwise-plan-intro-seen';

/**
 * How the plan works, until it's been read once: the three things the page doesn't make obvious
 * (bills come first, an amount can change for one month, next month can be planned now). As on
 * the app's Plan. Shown only after mount, so the server's render and the browser's agree.
 */
export function HowItWorks() {
  const [seen, setSeen] = useState(true);
  useEffect(() => {
    try {
      setSeen(window.localStorage.getItem(KEY) === '1');
    } catch {
      // Storage blocked: don't nag on every visit.
    }
  }, []);
  if (seen) return null;
  return (
    <Card className="py-0">
      <CardContent className="space-y-3 p-5">
        <p className="font-medium">How your plan works</p>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>Each month runs from one payday to the next: your pay comes in, then the bills go out.</li>
          <li>After bills is what you have once the essentials are paid. Subscriptions, savings and one-offs come out of that.</li>
          <li>A bill different this month, like a bigger credit card bill? Click its amount. Only that month changes.</li>
          <li>Use the arrows to plan next month before it starts.</li>
        </ul>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSeen(true);
            try {
              window.localStorage.setItem(KEY, '1');
            } catch {
              // Storage blocked: it's hidden for this visit.
            }
          }}
        >
          Got it
        </Button>
      </CardContent>
    </Card>
  );
}

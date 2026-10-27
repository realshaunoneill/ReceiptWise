'use client';

import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { HIDE_AMOUNTS_KEY } from '@/lib/hide-amounts';

/**
 * Hide amounts, per browser: every `.amount` is blurred (app/globals.css), for showing someone the
 * screen without the figures. The app has the same switch, per phone (mobile/src/privacy.ts).
 */

export function HideAmountsSetting() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(document.documentElement.classList.contains('hide-amounts')), []);
  const change = (next: boolean) => {
    setOn(next);
    document.documentElement.classList.toggle('hide-amounts', next);
    try {
      if (next) window.localStorage.setItem(HIDE_AMOUNTS_KEY, '1');
      else window.localStorage.removeItem(HIDE_AMOUNTS_KEY);
    } catch {
      // Storage blocked: it lasts until the page is reloaded.
    }
  };
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <Label htmlFor="hide-amounts">Hide amounts</Label>
        <p className="text-sm text-muted-foreground">
          Blurs every amount, for showing someone your receipts or plan without the figures. Only in this browser.
        </p>
      </div>
      <Switch id="hide-amounts" checked={on} onCheckedChange={change} />
    </div>
  );
}

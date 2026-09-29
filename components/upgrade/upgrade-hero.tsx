'use client';

import { useTrialDays } from '@/lib/hooks/use-trial-days';

/**
 * Was a Crown badge reading "Premium Features" above the heading "Upgrade to
 * Premium" above the line "Unlock the full power of ReceiptWise and take control
 * of your finances" — the word Premium three times in three stacked elements, and
 * a closing claim that says nothing a reader can check.
 */
export function UpgradeHero() {
  const trialDays = useTrialDays();
  return (
    <div className="mx-auto max-w-2xl">
      <h1
        id="upgrade-title"
        className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl"
      >
        One subscription, all of it
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
        Unlimited receipts, unlimited households, and every insight the app can produce.
        There is no higher tier to graduate to.
      </p>
      {trialDays > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          The first <strong className="text-foreground">{trialDays} days are free</strong>. Cancel
          before they are up and you are not charged.
        </p>
      )}
    </div>
  );
}

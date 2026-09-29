'use client';

import { useQuery } from '@tanstack/react-query';

const CONFIGURED_TRIAL_DAYS = process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS
  ? parseInt(process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS, 10) || 0
  : 0;

/**
 * Trial days checkout will actually grant the signed-in user.
 *
 * Checkout only gives the trial to first-time subscribers, so a returning customer must not be
 * told "Start your 7-day trial". Returns 0 while loading rather than the configured length, so
 * the prompt can understate for a moment but never overstate. Public pages (landing, sign-up)
 * are for new visitors and keep reading the env var directly.
 */
export function useTrialDays(): number {
  const { data } = useQuery({
    queryKey: ['checkout-trial-days'],
    queryFn: async () => {
      const response = await fetch('/api/checkout', { cache: 'no-store' });
      if (!response.ok) return 0;
      const body = (await response.json()) as { trialDays?: number };
      return body.trialDays ?? 0;
    },
    enabled: CONFIGURED_TRIAL_DAYS > 0,
    staleTime: 5 * 60 * 1000,
  });

  return CONFIGURED_TRIAL_DAYS > 0 ? (data ?? 0) : 0;
}

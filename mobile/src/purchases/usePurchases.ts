import { useMutation, useQuery } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { type WirePremium } from '@shared/api/user';
import { api } from '../api/client';
import { queryClient } from '../query/client';
import { purchasesAvailable, purchasesModule, purchasesUser } from './index';

type Offering = NonNullable<Awaited<ReturnType<NonNullable<ReturnType<typeof purchasesModule>>['default']['getOfferings']>>['current']>;
export type PremiumPackage = Offering['availablePackages'][number];

/** Premium's packages, yearly first (as the stores list it), from RevenueCat's current offering. */
export function useOfferings() {
  return useQuery({
    queryKey: ['offerings', purchasesUser()],
    enabled: purchasesAvailable && !!purchasesUser(),
    queryFn: async () => {
      const module = purchasesModule()!;
      const offerings = await module.default.getOfferings();
      const packages = [...(offerings.current?.availablePackages ?? [])];
      const rank = (pkg: PremiumPackage) => (pkg.packageType === 'ANNUAL' ? 0 : pkg.packageType === 'MONTHLY' ? 1 : 2);
      return packages.sort((a, b) => rank(a) - rank(b));
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Which products still offer their free trial to this person. On iOS RevenueCat asks the App
 * Store; on Android Google only offers the trial to someone who can have it, so its presence is
 * the answer.
 */
export function useTrialEligibility(packages: PremiumPackage[] | undefined) {
  const ids = (packages ?? []).map((pkg) => pkg.product.identifier);
  return useQuery({
    queryKey: ['offerings', 'trial', purchasesUser(), ids],
    enabled: purchasesAvailable && ids.length > 0,
    queryFn: async (): Promise<Record<string, boolean>> => {
      const module = purchasesModule()!;
      if (Platform.OS !== 'ios') return Object.fromEntries((packages ?? []).map((pkg) => [pkg.product.identifier, !!pkg.product.introPrice]));
      const status = await module.default.checkTrialOrIntroductoryPriceEligibility(ids);
      return Object.fromEntries(ids.map((id) => [id, status[id]?.status !== module.INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_INELIGIBLE]));
    },
  });
}

/** Ask the website to look at the purchase now (rather than wait for RevenueCat's webhook), then refresh everything Premium decides. */
async function syncPremium(): Promise<{ subscribed: boolean; premium: WirePremium }> {
  const result = await api<{ subscribed: boolean; premium: WirePremium }>('/api/users/me/premium/sync', { method: 'POST' });
  await queryClient.invalidateQueries();
  return result;
}

/** The person closed the store's sheet: not an error to show. */
export function isCancelled(error: unknown): boolean {
  const e = error as { userCancelled?: boolean | null; code?: string } | null;
  const module = purchasesModule();
  return !!e?.userCancelled || (!!module && e?.code === module.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR);
}

export function usePurchase() {
  return useMutation({
    mutationFn: async (pkg: PremiumPackage) => {
      await purchasesModule()!.default.purchasePackage(pkg);
      return syncPremium();
    },
  });
}

export function useRestore() {
  return useMutation({
    mutationFn: async () => {
      await purchasesModule()!.default.restorePurchases();
      return syncPremium();
    },
  });
}

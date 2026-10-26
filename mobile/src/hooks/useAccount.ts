import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type WireInboundAddress, type WireInboundEmail } from '@shared/api/inbound';
import { type WireMe } from '@shared/api/user';
import { api } from '../api/client';
import { linkApple, linkGoogle, listLinkedAccounts, unlinkAccount, type LinkedAccount } from '../auth/auth';

/** Where new receipts go when none is chosen: a household, or null for your own. */
export function useSetDefaultHousehold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (householdId: string | null) => api('/api/users/default-household', { method: 'PATCH', json: { householdId } }),
    onSuccess: (_data, householdId) => {
      queryClient.setQueryData<WireMe>(['me'], (me) => (me ? { ...me, defaultHouseholdId: householdId } : me));
      return queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

/** First run is over: the website's tour won't show either. */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api('/api/users/onboarding', { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.setQueryData<WireMe>(['me'], (me) => (me ? { ...me, onboardingCompletedAt: new Date().toISOString() } : me));
      return queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

// ----- Email forwarding -----

export function useInboundAddress(enabled = true) {
  return useQuery({ queryKey: ['inbound-address'], queryFn: () => api<WireInboundAddress>('/api/inbound-address'), enabled });
}

/** The last 20 forwarded emails; looked at again every 15 seconds while the screen is open, as on the website. */
export function useInboundEmails(enabled = true) {
  return useQuery({ queryKey: ['inbound-emails'], queryFn: () => api<WireInboundEmail[]>('/api/inbound-emails'), enabled, refetchInterval: 15_000 });
}

/** A new address; mail to the old one is refused from then on. */
export function useRotateInboundAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<WireInboundAddress>('/api/inbound-address/rotate', { method: 'POST' }),
    onSuccess: (next) => queryClient.setQueryData(['inbound-address'], next),
  });
}

// ----- Sign-in methods -----

export function useLinkedAccounts() {
  return useQuery<LinkedAccount[]>({ queryKey: ['linked-accounts'], queryFn: listLinkedAccounts });
}

export function useLinkAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: 'google' | 'apple') => (provider === 'google' ? linkGoogle() : linkApple()),
    onSuccess: (linked) => (linked ? queryClient.invalidateQueries({ queryKey: ['linked-accounts'] }) : undefined),
  });
}

export function useUnlinkAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unlinkAccount,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['linked-accounts'] }),
  });
}

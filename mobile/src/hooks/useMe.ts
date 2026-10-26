import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type WireMe } from '@shared/api/user';
import { api } from '../api/client';

/** The account: Premium, currency, features, and what the finance features may show. */
export function useMe(enabled = true) {
  return useQuery({ queryKey: ['me'], queryFn: () => api<WireMe>('/api/users/me'), enabled });
}

/** The currency totals are shown in (receipts keep their own). */
export function useUpdateCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (currency: string) => api<WireMe>('/api/users/me', { method: 'PATCH', json: { currency } }),
    onSuccess: (me) => {
      queryClient.setQueryData(['me'], me);
      return Promise.all([queryClient.invalidateQueries({ queryKey: ['plan'] }), queryClient.invalidateQueries({ queryKey: ['receipts'] })]);
    },
  });
}

/** Delete the account in 24 hours (cancellable till then), as on the website. */
export function useScheduleDeletion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api('/api/users/me', { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useCancelDeletion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api('/api/users/cancel-deletion', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });
}

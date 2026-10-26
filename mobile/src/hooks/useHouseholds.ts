import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { type WireCreatedInvitation, type WireHousehold, type WireHouseholdDetail, type WireSentInvitation } from '@shared/api/households';
import { invalidateFinanceQueries, invalidateReceiptQueries } from '@shared/query/refresh';
import { api } from '../api/client';

/** The households the signed-in person belongs to. Joining or leaving one invalidates this. */
export function useHouseholds() {
  return useQuery({ queryKey: ['households'], queryFn: () => api<WireHousehold[]>('/api/households'), staleTime: 10 * 60 * 1000 });
}

/** One household and its members. Under the 'households' key, so every change refreshes it too. */
export function useHousehold(id: string | undefined) {
  return useQuery({
    queryKey: ['households', id],
    queryFn: () => api<WireHouseholdDetail>(`/api/households/${id}`),
    enabled: !!id,
  });
}

/**
 * Invitations still waiting to be taken up; only the owner's carry the link. Not under
 * 'households', which is kept on the phone: a link is what lets someone join.
 */
export function useSentInvitations(id: string | undefined) {
  return useQuery({
    queryKey: ['household-invitations', id],
    queryFn: () => api<WireSentInvitation[]>(`/api/households/${id}/invitations`),
    enabled: !!id,
  });
}

/** The households and their invitations, and the account (Premium cover and the default household follow membership). */
const refreshHouseholds = (queryClient: QueryClient) =>
  Promise.all(['households', 'household-invitations', 'me'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));

/**
 * After joining or leaving: what's shared with the household comes into view or goes, so the
 * receipts, bills and plan refresh as well.
 */
export const refreshAfterMembership = (queryClient: QueryClient) =>
  Promise.all([refreshHouseholds(queryClient), invalidateReceiptQueries(queryClient), invalidateFinanceQueries(queryClient)]);

export function useCreateHousehold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<WireHousehold>('/api/households', { method: 'POST', json: { name } }),
    onSuccess: () => refreshHouseholds(queryClient),
  });
}

export function useRenameHousehold(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api(`/api/households/${id}`, { method: 'PATCH', json: { name } }),
    onSuccess: () => refreshHouseholds(queryClient),
  });
}

export function useDeleteHousehold(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api(`/api/households/${id}`, { method: 'DELETE' }),
    // Not its own detail: refetching that would be refused.
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['households', id] });
      return refreshAfterMembership(queryClient);
    },
  });
}

export function useLeaveHousehold(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: true; deletedHousehold: boolean }>(`/api/households/${id}/leave`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['households', id] });
      return refreshAfterMembership(queryClient);
    },
  });
}

export function useTransferOwnership(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api(`/api/households/${id}/transfer-ownership`, { method: 'POST', json: { userId } }),
    onSuccess: () => refreshHouseholds(queryClient),
  });
}

export function useRemoveMember(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api(`/api/households/${id}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => refreshHouseholds(queryClient),
  });
}

/** Make an invitation; its link is shared from the phone (there is no email sending). */
export function useInvite(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => api<WireCreatedInvitation>(`/api/households/${id}/invitations`, { method: 'POST', json: { email } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['household-invitations', id] }),
  });
}

export function useRevokeInvitation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => api(`/api/households/${id}/invitations/${invitationId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['household-invitations', id] }),
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type WireInvitePreview, type WireReceivedInvitation } from '@shared/api/households';
import { api } from '../api/client';
import { refreshAfterMembership } from './useHouseholds';

/** Invitations sent to the signed-in person's address, still open (the website's notifications). */
export function useReceivedInvitations(enabled = true) {
  return useQuery({
    queryKey: ['invitations'],
    queryFn: () => api<WireReceivedInvitation[]>('/api/invitations'),
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useRespondToInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'accept' | 'decline' }) =>
      api<{ householdId?: string }>(`/api/invitations/${id}`, { method: 'PATCH', json: { action } }),
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: ['invitations'] }), refreshAfterMembership(queryClient)]),
  });
}

/** What an invitation link shows; holding the link is enough, so it works signed out too. */
export function useInvitePreview(token: string | undefined) {
  return useQuery({
    queryKey: ['invite', token],
    queryFn: () => api<WireInvitePreview>(`/api/invitations/token/${token}`),
    enabled: !!token,
    retry: false,
  });
}

export function useRespondToInvite(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: 'accept' | 'decline') =>
      api<{ householdId: string; alreadyMember?: boolean }>(`/api/invitations/token/${token}`, { method: 'POST', json: { action } }),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['invite', token] }),
      queryClient.invalidateQueries({ queryKey: ['invitations'] }),
      refreshAfterMembership(queryClient),
    ]),
  });
}

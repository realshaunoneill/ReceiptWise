import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useInvitations() {
  return useQuery({
    queryKey: ['invitations'],
    queryFn: async () => {
      const response = await fetch('/api/invitations');
      if (!response.ok) {
        throw new Error('Failed to fetch invitations');
      }
      return response.json();
    },
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invitationId, action }: { invitationId: string; action: 'accept' | 'decline' }) => {
      const response = await fetch(`/api/invitations/${invitationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process invitation');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.invalidateQueries({ queryKey: ['households'] });
    },
  });
}

export function useSendInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ householdId, email }: { householdId: string; email: string }) => {
      const response = await fetch(`/api/households/${householdId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send invitation');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household-invitations'] });
    },
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ householdId, invitationId }: { householdId: string; invitationId: string }) => {
      const response = await fetch(`/api/households/${householdId}/invitations/${invitationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to revoke invitation');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household-invitations'] });
    },
  });
}

export function useHouseholdInvitations(householdId: string) {
  return useQuery({
    queryKey: ['household-invitations', householdId],
    queryFn: async () => {
      const response = await fetch(`/api/households/${householdId}/invitations`);
      if (!response.ok) {
        throw new Error('Failed to fetch household invitations');
      }
      return response.json();
    },
    enabled: !!householdId,
  });
}

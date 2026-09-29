'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { clearPendingInvite, rememberPendingInvite } from '@/lib/utils/pending-invite';

/** Signed-out visitors: remember the link so /redirect can bring them back after sign-up. */
export function RememberInvite({ token }: { token: string }) {
  useEffect(() => {
    rememberPendingInvite(token);
  }, [token]);
  return null;
}

export function InviteActions({ token, householdName }: { token: string; householdName: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<'accept' | 'decline' | null>(null);

  useEffect(() => {
    // They made it back here signed in; /redirect no longer needs to remember the link.
    clearPendingInvite();
  }, []);

  const respond = async (action: 'accept' | 'decline') => {
    setPending(action);
    try {
      const response = await fetch(`/api/invitations/token/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || 'Something went wrong. Please try again.');
      }

      queryClient.invalidateQueries({ queryKey: ['households'] });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });

      if (action === 'accept') {
        toast.success(body.alreadyMember ? `You're already in ${householdName}` : `You've joined ${householdName}`);
        router.push('/receipts');
      } else {
        toast.success('Invitation declined');
        router.push('/dashboard');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button className="flex-1" onClick={() => respond('accept')} disabled={pending !== null}>
        {pending === 'accept' && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
        Join household
      </Button>
      <Button variant="outline" className="flex-1" onClick={() => respond('decline')} disabled={pending !== null}>
        {pending === 'decline' && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
        Decline
      </Button>
    </div>
  );
}

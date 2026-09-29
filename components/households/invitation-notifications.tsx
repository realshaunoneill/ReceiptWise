'use client';

import { useState } from 'react';
import { Bell, Check, X, Users, Inbox, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useInvitations, useAcceptInvitation } from '@/lib/hooks/use-invitations';
import { toast } from 'sonner';
import type { HouseholdInvitation } from '@/lib/db/schema';

type InvitationWithHouseholdName = HouseholdInvitation & {
  householdName: string;
  invitedByEmail: string | null;
};

export function InvitationNotifications() {
  const { data: invitations = [], isLoading } = useInvitations();
  const acceptInvitation = useAcceptInvitation();
  const [isOpen, setIsOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleInvitationAction = async (
    invitationId: string,
    action: 'accept' | 'decline',
    householdName: string,
  ) => {
    setProcessingId(invitationId);
    try {
      await acceptInvitation.mutateAsync({ invitationId, action });

      if (action === 'accept') {
        toast.success(`Joined "${householdName}"!`, {
          description: 'You can now view shared receipts.',
        });
      } else {
        toast.success('Invitation declined');
      }

      // Close if this was the last invitation
      if (invitations.length <= 1) {
        setIsOpen(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to process invitation');
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) return null;

  const pendingCount = invitations.length;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-5 w-5" />
          {pendingCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full px-1.5 text-xs bg-primary text-primary-foreground animate-in zoom-in-50"
            >
              {pendingCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="px-3 py-2.5 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
        </div>
        {pendingCount === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Inbox className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">All caught up!</p>
            <p className="text-xs text-muted-foreground mt-1">
              No pending invitations
            </p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {invitations.map((invitation: InvitationWithHouseholdName, index: number) => {
              const isProcessing = processingId === invitation.id;
              return (
                <div
                  key={invitation.id}
                  className={`p-3 space-y-3 ${index !== invitations.length - 1 ? 'border-b' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-linear-to-br from-primary/20 to-primary/5 shrink-0">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">
                        You&apos;re invited to join
                      </p>
                      <p className="text-sm font-semibold text-primary truncate">
                        {invitation.householdName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {invitation.invitedByEmail ? `From ${invitation.invitedByEmail} · ` : ''}
                        {new Date(invitation.createdAt).toLocaleDateString('en-IE', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        handleInvitationAction(
                          invitation.id,
                          'accept',
                          invitation.householdName,
                        )
                      }
                      disabled={isProcessing}
                      className="flex-1 h-8"
                    >
                      {isProcessing ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Accept
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleInvitationAction(
                          invitation.id,
                          'decline',
                          invitation.householdName,
                        )
                      }
                      disabled={isProcessing}
                      className="flex-1 h-8"
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Decline
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

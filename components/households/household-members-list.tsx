'use client';

import { useState } from 'react';
import { Crown, User, MoreVertical, Trash2, Mail, Users, Clock, Copy, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SubscriptionUpsell } from '@/components/subscriptions/subscription-upsell';
import { InviteMemberDialog } from '@/components/households/invite-member-dialog';
import { copyInviteLink } from '@/components/households/copy-invite-link';
import { removeMember, transferOwnership } from '@/lib/household-actions';
import { useHouseholdInvitations, useRevokeInvitation } from '@/lib/hooks/use-invitations';
import { toast } from 'sonner';

export interface HouseholdMemberRow {
  userId: string
  email: string
  role: 'owner' | 'member'
  joinedAt: string
}

interface PendingInvitation {
  id: string
  invitedEmail: string
  createdAt: string
  expiresAt: string
  inviteUrl?: string
}

interface HouseholdMembersListProps {
  householdId: string
  members: HouseholdMemberRow[]
  currentUserId: string
  isCurrentUserOwner: boolean
  isSubscribed?: boolean
  onUpdate: () => void
}

export function HouseholdMembersList({
  householdId,
  members,
  currentUserId,
  isCurrentUserOwner,
  isSubscribed = false,
  onUpdate,
}: HouseholdMembersListProps) {
  const [loadingMemberId, setLoadingMemberId] = useState<string>();
  const { data: invitations = [] } = useHouseholdInvitations(householdId);
  const revokeInvitation = useRevokeInvitation();

  const handleRemove = async (member: HouseholdMemberRow) => {
    if (!confirm(`Remove ${member.email} from the household? Their receipts stay theirs and leave this household's view.`)) return;

    setLoadingMemberId(member.userId);
    const result = await removeMember({ householdId, userId: member.userId });
    setLoadingMemberId(undefined);

    if (result.ok) {
      toast.success(`Removed ${member.email}`);
      onUpdate();
    } else {
      toast.error(result.error);
    }
  };

  const handleTransfer = async (member: HouseholdMemberRow) => {
    if (!confirm(`Make ${member.email} the owner? You'll stay in the household as a member, and they'll be the one who can invite, remove and delete.`)) return;

    setLoadingMemberId(member.userId);
    const result = await transferOwnership({ householdId, userId: member.userId });
    setLoadingMemberId(undefined);

    if (result.ok) {
      toast.success(`${member.email} now owns this household`);
      onUpdate();
    } else {
      toast.error(result.error);
    }
  };

  const handleRevoke = async (invitation: PendingInvitation) => {
    try {
      await revokeInvitation.mutateAsync({ householdId, invitationId: invitation.id });
      toast.success(`Invitation to ${invitation.invitedEmail} withdrawn`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to withdraw invitation');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Members
            </CardTitle>
            <CardDescription className="mt-1">
              {members.length} {members.length === 1 ? 'person' : 'people'} in this household
            </CardDescription>
          </div>
          {isCurrentUserOwner && isSubscribed && (
            <InviteMemberDialog householdId={householdId} triggerVariant="default" />
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Listed "Assign admin roles" and "Manage household permissions"; there are no roles
            beyond owner and member, and no permissions to manage. */}
        {!isSubscribed && isCurrentUserOwner && (
          <div className="mb-4">
            <SubscriptionUpsell
              title="Inviting needs Premium"
              description="With Premium, as the owner you can:"
              features={[
                'Invite people with a link',
                'Remove members',
                'Hand ownership to someone else',
              ]}
            />
          </div>
        )}
        <div className="space-y-2">
          {members.map((member) => {
            const isCurrentUser = member.userId === currentUserId;
            // Removing and handing over ownership are never paywalled: a lapsed owner must
            // still be able to wind a household down.
            const canManage = isCurrentUserOwner && !isCurrentUser;
            const isOwner = member.role === 'owner';

            return (
              <div
                key={`member-${member.userId}`}
                className="flex items-center justify-between rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground truncate">
                        {member.email.split('@')[0]}
                      </p>
                      {isCurrentUser && (
                        <Badge variant="outline" className="text-xs shrink-0">You</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={isOwner ? 'default' : 'secondary'}
                    className={isOwner ? 'bg-primary/10 text-primary hover:bg-primary/20' : ''}
                  >
                    {isOwner ? (
                      <>
                        <Crown className="mr-1 h-3 w-3" aria-hidden="true" />
                        Owner
                      </>
                    ) : (
                      'Member'
                    )}
                  </Badge>

                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={loadingMemberId === member.userId}
                          aria-label={`Manage ${member.email}`}
                        >
                          <MoreVertical className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleTransfer(member)}>
                          <Crown className="mr-2 h-4 w-4" aria-hidden="true" />
                          Make owner
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRemove(member)} className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                          Remove from household
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}

          {/* Pending invitations — only unexpired, still-pending ones come back from the API */}
          {invitations.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" aria-hidden="true" />
                Waiting to join ({invitations.length})
              </h4>
              <div className="space-y-2">
                {invitations.map((invitation: PendingInvitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-dashed bg-muted/30 p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 shrink-0 rounded-full bg-muted flex items-center justify-center">
                        <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{invitation.invitedEmail}</p>
                        <p className="text-xs text-muted-foreground">
                          Link expires {new Date(invitation.expiresAt).toLocaleDateString('en-IE', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    {isCurrentUserOwner && (
                      <div className="flex shrink-0 items-center gap-1">
                        {invitation.inviteUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyInviteLink(invitation.inviteUrl!)}
                          >
                            <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                            Copy link
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleRevoke(invitation)}
                          disabled={revokeInvitation.isPending}
                          aria-label={`Withdraw invitation to ${invitation.invitedEmail}`}
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

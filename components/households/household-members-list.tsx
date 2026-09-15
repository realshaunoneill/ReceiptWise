'use client';

import { useState } from 'react';
import { Crown, User, MoreVertical, Trash2, UserPlus, Mail, Users, Clock, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { SubscriptionUpsell } from '@/components/subscriptions/subscription-upsell';
import { removeMember } from '@/lib/household-actions';
import { useSendInvitation, useHouseholdInvitations } from '@/lib/hooks/use-invitations';
import { toast } from 'sonner';
import type { HouseholdInvitation } from '@/lib/db/schema';

interface Member {
  id: string
  user_id: string
  full_name: string
  email: string
  avatar_url?: string
  role: 'admin' | 'member'
  joined_at: string
}

interface HouseholdMembersListProps {
  householdId: string
  members: Member[]
  currentUserId: string
  isCurrentUserAdmin: boolean
  isSubscribed?: boolean
  onUpdate: () => void
}

export function HouseholdMembersList({
  householdId,
  members,
  currentUserId,
  isCurrentUserAdmin,
  isSubscribed = false,
  onUpdate,
}: HouseholdMembersListProps) {
  const [loadingMemberId, setLoadingMemberId] = useState<string>();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const sendInvitation = useSendInvitation();
  const { data: invitations = [] } = useHouseholdInvitations(householdId);

  const handleRemove = async (userId: string) => {
    if (!confirm('Remove this member from the household?')) return;

    setLoadingMemberId(userId);
    try {
      await removeMember({ householdId, userId });
      onUpdate();
    } catch {
      alert('Failed to remove member');
    } finally {
      setLoadingMemberId(undefined);
    }
  };

  const handleSendInvitation = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      await sendInvitation.mutateAsync({
        householdId,
        email: inviteEmail.trim(),
      });

      toast.success('Invitation sent successfully!');
      setInviteEmail('');
      setInviteDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send invitation');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              Members
            </CardTitle>
            <CardDescription className="mt-1">
              {members.length} {members.length === 1 ? 'person' : 'people'} in this household
            </CardDescription>
          </div>
          {isCurrentUserAdmin && isSubscribed && (
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <DialogTitle className="text-center">Invite New Member</DialogTitle>
                  <DialogDescription className="text-center">
                    They&apos;ll receive a notification to accept the invitation.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <label className="text-sm font-medium">Email Address</label>
                    <Input
                      type="email"
                      placeholder="Enter email address"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="mt-2"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSendInvitation();
                        }
                      }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSendInvitation}
                      disabled={sendInvitation.isPending}
                      className="flex-1"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Send Invitation
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setInviteDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {!isSubscribed && isCurrentUserAdmin && (
          <div className="mb-4">
            <SubscriptionUpsell
              title="Member Management Locked"
              description="Upgrade to Premium to unlock full member management:"
              features={[
                'Invite unlimited members',
                'Assign admin roles',
                'Remove members',
                'Manage household permissions',
              ]}
            />
          </div>
        )}
        <div className="space-y-2">
          {members.map((member) => {
            const isCurrentUser = member.user_id === currentUserId;
            const canManage = isCurrentUserAdmin && !isCurrentUser && isSubscribed;

            return (
              <div
                key={`member-${member.user_id}`}
                className="flex items-center justify-between rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url || '/placeholder.svg'}
                        alt={member.full_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground truncate">
                        {member.full_name}
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
                    variant={member.role === 'admin' ? 'default' : 'secondary'}
                    className={member.role === 'admin' ? 'bg-primary/10 text-primary hover:bg-primary/20' : ''}
                  >
                    {member.role === 'admin' ? (
                      <>
                        <Crown className="mr-1 h-3 w-3" />
                        Admin
                      </>
                    ) : (
                      <>
                        <Shield className="mr-1 h-3 w-3" />
                        Member
                      </>
                    )}
                  </Badge>

                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={loadingMemberId === member.user_id}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleRemove(member.user_id)} className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove Member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}

          {/* Pending Invitations */}
          {invitations.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending Invitations ({invitations.length})
              </h4>
              <div className="space-y-2">
                {invitations.map((invitation: HouseholdInvitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between rounded-lg border border-dashed bg-muted/30 p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 shrink-0 rounded-full bg-muted flex items-center justify-center">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{invitation.invitedEmail}</p>
                        <p className="text-xs text-muted-foreground">
                          Invited {new Date(invitation.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 border-primary/30 text-primary">
                      Pending
                    </Badge>
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

'use client';

import { Users, Crown, MoreVertical, Trash2, LogOut, UserPlus, Receipt, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { InviteMemberDialog } from '@/components/households/invite-member-dialog';
import { SubscriptionUpsell } from '@/components/subscriptions/subscription-upsell';
import type { Household } from '@/lib/types';
import { leaveHousehold, deleteHousehold } from '@/lib/household-actions';
import { toast } from 'sonner';

interface HouseholdCardProps {
  household: Household & {
    memberCount: number
    isAdmin: boolean
  }
  currentUserId: string
  isSubscribed?: boolean
  onUpdate: () => void
}

export function HouseholdCard({ household, currentUserId, isSubscribed = false, onUpdate }: HouseholdCardProps) {
  const handleLeave = async () => {
    if (!confirm('Are you sure you want to leave this household?')) return;

    try {
      await leaveHousehold({ householdId: household.id, userId: currentUserId });
      toast.success(`Left "${household.name}"`);
      onUpdate();
    } catch (_error) {
      toast.error('Failed to leave household');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this household? This action cannot be undone.')) return;

    try {
      await deleteHousehold(household.id);
      toast.success(`"${household.name}" deleted`);
      onUpdate();
    } catch (_error) {
      toast.error('Failed to delete household');
    }
  };

  // Format date
  const createdDate = household.created_at
    ? new Date(household.created_at).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground truncate">{household.name}</h3>
                {household.isAdmin && (
                  <Badge variant="outline" className="shrink-0 gap-1 border-primary/30 bg-primary/10 text-primary">
                    <Crown className="h-3 w-3" />
                    Admin
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {household.memberCount} {household.memberCount === 1 ? 'member' : 'members'}
                </span>
                {createdDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {createdDate}
                  </span>
                )}
              </div>
            </div>
          </div>

          {isSubscribed && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {household.isAdmin && (
                  <>
                    <DropdownMenuItem className="text-muted-foreground" disabled>
                      <Receipt className="mr-2 h-4 w-4" />
                      View Shared Receipts
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {household.isAdmin ? (
                  <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Household
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={handleLeave}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Leave Household
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isSubscribed ? (
          household.isAdmin ? (
            <div className="flex items-center gap-2">
              <InviteMemberDialog householdId={household.id} onMemberInvited={onUpdate} />
              <p className="text-xs text-muted-foreground">Invite family or roommates</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Only admins can invite new members
              </p>
            </div>
          )
        ) : (
          <SubscriptionUpsell
            title="Household Management"
            description="Upgrade to Premium to manage your household:"
            features={[
              'Invite and manage members',
              'Share receipts automatically',
              'Track shared expenses',
              'Assign household roles',
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}

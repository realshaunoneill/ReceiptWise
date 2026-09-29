'use client';

import { Users, Crown, MoreVertical, Trash2, LogOut, UserPlus, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { InviteMemberDialog } from '@/components/households/invite-member-dialog';
import { SubscriptionUpsell } from '@/components/subscriptions/subscription-upsell';
import { leaveHousehold, deleteHousehold } from '@/lib/household-actions';
import { toast } from 'sonner';

export interface HouseholdSummary {
  id: string
  name: string
  // The API returns camelCase; this read `created_at`, so the date never rendered.
  createdAt?: string | Date
  memberCount: number
  isAdmin: boolean
}

interface HouseholdCardProps {
  household: HouseholdSummary
  isSubscribed?: boolean
  onUpdate: () => void
}

export function HouseholdCard({ household, isSubscribed = false, onUpdate }: HouseholdCardProps) {
  const isOwner = household.isAdmin;
  const isSoleMember = household.memberCount <= 1;

  const handleLeave = async () => {
    const message = isOwner
      ? `You're the only one in "${household.name}", so leaving deletes it. Your receipts stay in your personal view. Continue?`
      : `Leave "${household.name}"? Receipts you added go back to your personal view.`;
    if (!confirm(message)) return;

    const result = await leaveHousehold({ householdId: household.id });
    if (result.ok) {
      toast.success(`Left "${household.name}"`);
      onUpdate();
    } else {
      toast.error(result.error);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${household.name}"? Everyone is removed from it. Each person's receipts stay in their own personal view — nothing is deleted except the household.`)) return;

    const result = await deleteHousehold(household.id);
    if (result.ok) {
      toast.success(`"${household.name}" deleted`);
      onUpdate();
    } else {
      toast.error(result.error);
    }
  };

  const createdDate = household.createdAt
    ? new Date(household.createdAt).toLocaleDateString('en-IE', {
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Users className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground truncate">{household.name}</h3>
                {isOwner && (
                  <Badge variant="outline" className="shrink-0 gap-1 border-primary/30 bg-primary/10 text-primary">
                    <Crown className="h-3 w-3" aria-hidden="true" />
                    Owner
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" aria-hidden="true" />
                  {household.memberCount} {household.memberCount === 1 ? 'member' : 'members'}
                </span>
                {createdDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" aria-hidden="true" />
                    {createdDate}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Not paywalled: leaving or deleting a household must work after Premium lapses.
              Held a permanently-disabled "View Shared Receipts" item, now removed. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Manage ${household.name}`}>
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(!isOwner || isSoleMember) && (
                <DropdownMenuItem onClick={handleLeave}>
                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                  Leave household
                </DropdownMenuItem>
              )}
              {isOwner && (
                <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Delete household
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isSubscribed ? (
          isOwner ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <InviteMemberDialog householdId={household.id} onMemberInvited={onUpdate} />
                <p className="text-xs text-muted-foreground">Invite family or housemates with a link</p>
              </div>
              {!isSoleMember && (
                <p className="text-xs text-muted-foreground">
                  To leave, first make someone else the owner from the Members list.
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
              <UserPlus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                Only the owner can invite people
              </p>
            </div>
          )
        ) : (
          <SubscriptionUpsell
            title="Household tools need Premium"
            description="With Premium you can:"
            features={[
              'Invite people with a link',
              'Add receipts to the household',
              'See every line item on shared receipts',
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}

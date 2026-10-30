'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFeature, useUser } from '@/lib/hooks/use-user';
import { CreateHouseholdDialog } from '@/components/households/create-household-dialog';
import { HouseholdList } from '@/components/households/household-list';
import { HouseholdMembersList } from '@/components/households/household-members-list';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useHouseholds } from '@/lib/hooks/use-households';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HouseholdReceipts } from '@/components/households/household-receipts';
import { DefaultHouseholdCard } from '@/components/households/default-household-card';
import { Users, Home, Share2, Shield, Crown, Check, UserPlus, ArrowRight } from 'lucide-react';
import type { HouseholdWithMembers } from '@/lib/types/api-responses';
import type { HouseholdMemberRow } from '@/components/households/household-members-list';
import type { HouseholdSummary } from '@/components/households/household-card';
import { useTrialDays } from '@/lib/hooks/use-trial-days';

export default function SharingPage() {
  const trialDays = useTrialDays();
  const router = useRouter();
  const { user, isSubscribed, entitlements, isLoading: userLoading } = useUser();
  const billsEnabled = useFeature('bills');
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string>();
  const queryClient = useQueryClient();

  // Get households
  const { data: households = [], isLoading: householdsLoading } = useHouseholds();

  const handleHouseholdCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['households'] });
  };

  // Get members for selected household
  const { data: members = [], isLoading: membersLoading } = useQuery<HouseholdMemberRow[]>({
    queryKey: ['household-members', selectedHouseholdId],
    queryFn: async () => {
      if (!selectedHouseholdId) return [];

      const response = await fetch(`/api/households/${selectedHouseholdId}/members`);
      if (!response.ok) throw new Error('Failed to fetch members');

      // The API returns camelCase { userId, email, role, joinedAt }. This used to map
      // `member.user_id`, which is always undefined — so the owner was never recognised as
      // the owner, and Invite / Remove never rendered for anyone.
      return response.json();
    },
    enabled: !!selectedHouseholdId,
  });

  // Select first household by default
  useEffect(() => {
    if (households.length > 0 && !selectedHouseholdId) {
      setSelectedHouseholdId(households[0].id);
    }
  }, [households, selectedHouseholdId]);

  const selectedHousehold = households.find((h: HouseholdWithMembers) => h.id === selectedHouseholdId);
  const currentUserId = user?.id;
  const isCurrentUserOwner = Boolean(
    selectedHousehold && user && members.find((m) => m.userId === user.id)?.role === 'owner',
  );

  const refreshHouseholds = () => {
    queryClient.invalidateQueries({ queryKey: ['households'] });
    queryClient.invalidateQueries({ queryKey: ['household-members'] });
  };

  // Show skeleton loading state
  if (userLoading) {
    return (
      <main className="container mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Skeleton className="h-8 sm:h-9 w-48" />
            <Skeleton className="h-4 w-80 mt-1 sm:mt-2" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-6 w-40" />
            </div>
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-20" />
                  <Skeleton className="h-9 w-20" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3].map((j) => (
                    <Skeleton key={j} className="h-10 w-32 rounded-lg" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    );
  }

  // Show paywall for non-subscribed users
  if (!isSubscribed) {
    return (
      <main className="container mx-auto max-w-7xl space-y-6 p-4 sm:p-6" aria-labelledby="sharing-title">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 id="sharing-title" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Households</h1>
              <p className="mt-1 text-sm text-muted-foreground sm:mt-2">
                Households, and who is in them.
              </p>
            </div>
          </div>

          {/* Joining someone's household doesn't need Premium, so a non-subscriber can be in one,
              and must always be able to see which, and leave. This came after the whole sales
              pitch, under "Households are part of Premium", which read as if they weren't in one. */}
          {households.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-foreground">Households you&apos;re in</CardTitle>
                <CardDescription>
                  You can see their shared receipts on the Receipts page.
                  {billsEnabled && (entitlements?.householdIds.length ?? 0) > 0
                    ? ' Their shared bills and plan are included, but the Premium there already covers six people, so adding receipts of your own needs Premium.'
                    : ' Adding receipts of your own needs Premium: when someone in a household has it, it covers up to six people.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <HouseholdList
                  households={households as HouseholdSummary[]}
                  isSubscribed={false}
                  onUpdate={refreshHouseholds}
                />
              </CardContent>
            </Card>
          )}

          {/* Same paywall shape as /insights and /subscriptions: a centred
              medallion, a four-tile grid of two-word features, a bordered list, a
              centred CTA. All three now use the left-aligned, plain-spoken version
              so the app does not sell itself in a different voice on each page. */}
          <Card className="border-primary/30">
            <CardHeader className="pb-4">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-2xl text-foreground">
                  {households.length > 0 ? 'Your own households are part of Premium' : 'Households are part of Premium'}
                </CardTitle>
                {trialDays > 0 && (
                  <Badge variant="secondary">{trialDays}-day trial</Badge>
                )}
              </div>
              <CardDescription className="max-w-xl text-base">
                A household is a shared receipt pile. Everyone in it sees the same receipts;
                each person who adds receipts needs their own Premium.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    icon: Home,
                    title: 'One per group',
                    body: 'The flat, the family, the couple — keep them separate.',
                  },
                  {
                    icon: UserPlus,
                    title: 'Invite with a link',
                    body: 'Send them a link; they join with a free account.',
                  },
                  {
                    icon: Share2,
                    title: 'Shared as it arrives',
                    body: 'A receipt added on a phone shows up for everyone.',
                  },
                  {
                    icon: Shield,
                    title: 'One owner',
                    body: 'The owner invites and removes. Anyone can leave.',
                  },
                ].map(({ icon: Icon, title, body }) => (
                  <div key={title}>
                    <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                    <h3 className="mt-3 font-semibold text-foreground">{title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                  </div>
                ))}
              </div>

              {/* Benefits List */}
              <div className="rounded-lg border bg-muted/30 p-6">
                <h3 className="mb-4 font-semibold text-foreground">Also included</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    'Unlimited households and members',
                    'Per-household spending views',
                    'Filter any view to one household',
                    'Unlimited receipts and scanning',
                    billsEnabled ? 'Bills, subscriptions and a monthly plan' : 'Subscription tracking',
                    'Export as CSV, JSON or HTML',
                  ].map((feature) => (
                    <div key={feature} className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="space-y-3 border-t pt-6">
                <Button onClick={() => router.push('/upgrade')} size="lg" className="gap-2">
                  <Crown className="h-4 w-4" aria-hidden="true" />
                  {trialDays > 0 ? `Start the ${trialDays}-day trial` : 'See Premium'}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <p className="text-sm text-muted-foreground">
                  {trialDays > 0
                    ? `Cancel any time in the ${trialDays} days and you are not charged.`
                    : 'Cancel any time.'}
                </p>
              </div>
            </CardContent>
          </Card>
        </main>
    );
  }

  return (
    <main className="container mx-auto max-w-7xl space-y-6 p-4 sm:p-6" aria-labelledby="sharing-main-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 id="sharing-main-title" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Households</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:mt-2">
              {billsEnabled
                ? 'Share receipts, bills and the plan with family or housemates.'
                : 'Share receipts with family or housemates.'}
            </p>
          </div>
          {/* A household picker sat here too, beside the list below that already selects one; on a
              phone the pair pushed "Create household" off the screen. Not while there are none:
              the empty state below has the one button. */}
          {households.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <CreateHouseholdDialog
                onHouseholdCreated={handleHouseholdCreated}
              />
            </div>
          )}
        </div>

        {householdsLoading ? (
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-48 w-full" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        ) : households.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="relative mb-6">
              <div className="rounded-full bg-linear-to-br from-primary/20 to-primary/5 p-8">
                <Home className="h-12 w-12 text-primary" />
              </div>
              <div className="absolute -bottom-1 -right-1 rounded-full bg-background p-1">
                <div className="rounded-full bg-primary/10 p-1.5">
                  <Users className="h-4 w-4 text-primary" />
                </div>
              </div>
            </div>
            <h2 className="text-2xl font-semibold mb-2 text-foreground">Create your first household</h2>
            <p className="text-muted-foreground mb-8 max-w-md">
              {billsEnabled
                ? 'Make a household to share receipts, bills and the plan with a partner or housemates. Invite them with a link.'
                : 'Make a household to share receipts with a partner or housemates. Invite them with a link.'}
            </p>
            <CreateHouseholdDialog
              onHouseholdCreated={handleHouseholdCreated}
            />
          </div>
        ) : (
          <div className="space-y-8">
            {/* min-w-0: a grid item won't shrink below its content otherwise, and the invite link
                in the household card pushed the page 6px wider than a phone. */}
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="min-w-0 space-y-4">
                <h2 className="text-xl font-semibold text-foreground">Your households</h2>
                <HouseholdList
                  households={households}
                  isSubscribed={isSubscribed}
                  onUpdate={refreshHouseholds}
                  onSelect={(household) => setSelectedHouseholdId(household.id)}
                  selectedId={selectedHouseholdId}
                />
                <DefaultHouseholdCard households={households} />
              </div>

              <div className="min-w-0 space-y-4">
                {/* No "Members" heading here: the members card has that title itself. */}
                {selectedHousehold ? (
                  <>
                    {membersLoading ? (
                      <Skeleton className="h-64 w-full" />
                    ) : (
                      <HouseholdMembersList
                        householdId={selectedHousehold.id}
                        members={members}
                        currentUserId={currentUserId!}
                        isCurrentUserOwner={isCurrentUserOwner}
                        isSubscribed={isSubscribed}
                        onUpdate={refreshHouseholds}
                      />
                    )}
                  </>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-muted-foreground/20 p-8 text-center">
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Select a household</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Choose a household to view and manage its members
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Household Receipts */}
            {selectedHousehold && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">
                  {selectedHousehold.name}: shared receipts
                </h2>
                <HouseholdReceipts householdId={selectedHousehold.id} />
              </div>
            )}
          </div>
        )}
      </main>
  );
}

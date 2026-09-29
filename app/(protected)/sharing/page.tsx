'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/use-user';
import { CreateHouseholdDialog } from '@/components/households/create-household-dialog';
import { HouseholdList } from '@/components/households/household-list';
import { HouseholdSelector } from '@/components/households/household-selector';
import { HouseholdMembersList } from '@/components/households/household-members-list';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useHouseholds } from '@/lib/hooks/use-households';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HouseholdReceipts } from '@/components/households/household-receipts';
import { Users, Home, Share2, Receipt, Shield, Crown, Check, UserPlus, ArrowRight } from 'lucide-react';
import type { HouseholdWithMembers } from '@/lib/types/api-responses';
import type { HouseholdMemberRow } from '@/components/households/household-members-list';
import type { HouseholdSummary } from '@/components/households/household-card';
import { useTrialDays } from '@/lib/hooks/use-trial-days';

export default function SharingPage() {
  const trialDays = useTrialDays();
  const router = useRouter();
  const { user, isSubscribed, isLoading: userLoading } = useUser();
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
      <main className="container mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
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
      <main className="container mx-auto max-w-6xl space-y-6 p-4 sm:p-6" aria-labelledby="sharing-title">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 id="sharing-title" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Sharing</h1>
              <p className="mt-1 text-sm text-muted-foreground sm:mt-2">
                Households, and who is in them.
              </p>
            </div>
          </div>

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
                <CardTitle className="text-2xl text-foreground">Households are part of Premium</CardTitle>
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
                    'Subscription tracking',
                    'CSV and JSON export',
                  ].map((feature) => (
                    <div key={feature} className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Joining someone's household doesn't need Premium, so a non-subscriber can be
                  in one — and must always be able to see which, and leave. */}
              {households.length > 0 && (
                <div className="space-y-3 border-t pt-6">
                  <h3 className="font-semibold text-foreground">Households you&apos;re in</h3>
                  <p className="text-sm text-muted-foreground">
                    You can see these households&apos; receipts on the Receipts page. Adding
                    receipts and the line-item detail need Premium.
                  </p>
                  <HouseholdList
                    households={households as HouseholdSummary[]}
                    isSubscribed={false}
                    onUpdate={refreshHouseholds}
                  />
                </div>
              )}

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
    <main className="container mx-auto max-w-6xl space-y-6 p-4 sm:p-6" aria-labelledby="sharing-main-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 id="sharing-main-title" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Sharing</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:mt-2">
              Manage households and share receipts with family or roommates
            </p>
          </div>
          <div className="flex items-center gap-4">
            {households.length > 0 && (
              <HouseholdSelector
                households={households}
                selectedHouseholdId={selectedHouseholdId}
                onSelect={setSelectedHouseholdId}
              />
            )}
            <CreateHouseholdDialog
              onHouseholdCreated={handleHouseholdCreated}
            />
          </div>
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
            <h3 className="text-2xl font-semibold mb-2 text-foreground">Create Your First Household</h3>
            <p className="text-muted-foreground mb-8 max-w-md">
              Households let you share receipts and track expenses with family, partners, or roommates.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 max-w-lg">
              <div className="flex flex-col items-center p-4 rounded-lg bg-muted/50">
                <Share2 className="h-5 w-5 text-primary mb-2" />
                <p className="text-xs text-muted-foreground text-center">Share receipts instantly</p>
              </div>
              <div className="flex flex-col items-center p-4 rounded-lg bg-muted/50">
                <Receipt className="h-5 w-5 text-primary mb-2" />
                <p className="text-xs text-muted-foreground text-center">Track shared expenses</p>
              </div>
              <div className="flex flex-col items-center p-4 rounded-lg bg-muted/50">
                <Shield className="h-5 w-5 text-primary mb-2" />
                <p className="text-xs text-muted-foreground text-center">Invite with a link</p>
              </div>
            </div>
            <CreateHouseholdDialog
              onHouseholdCreated={handleHouseholdCreated}
            />
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">Your Households</h2>
                <HouseholdList
                  households={households}
                  isSubscribed={isSubscribed}
                  onUpdate={refreshHouseholds}
                  onSelect={(household) => setSelectedHouseholdId(household.id)}
                  selectedId={selectedHouseholdId}
                />
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">Members</h2>
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
                  {selectedHousehold.name} Receipts
                </h2>
                <HouseholdReceipts householdId={selectedHousehold.id} />
              </div>
            )}
          </div>
        )}
      </main>
  );
}

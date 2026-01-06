'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/use-user';
import { Navigation } from '@/components/layout/navigation';
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
import { Users, Home, Share2, Receipt, Shield, Crown, Check, UserPlus, Loader2, ArrowRight } from 'lucide-react';
import type { HouseholdWithMembers, MemberWithUser } from '@/lib/types/api-responses';

const trialDays = process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS ? parseInt(process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS) : 0;

export default function SharingPage() {
  const { user, isSubscribed, isLoading: userLoading } = useUser();
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string>();
  const queryClient = useQueryClient();
  const router = useRouter();

  const handleUpgradeClick = () => {
    router.push('/upgrade');
  };

  // Get households
  const { data: households = [], isLoading: householdsLoading } = useHouseholds();

  const handleHouseholdCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['households'] });
  };

  // Get members for selected household
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['household-members', selectedHouseholdId],
    queryFn: async () => {
      if (!selectedHouseholdId) return [];

      const response = await fetch(`/api/households/${selectedHouseholdId}/members`);
      if (!response.ok) throw new Error('Failed to fetch members');

      const data = await response.json();
      return data.map((member: MemberWithUser) => ({
        id: member.user_id,
        user_id: member.user_id,
        full_name: member.email.split('@')[0],
        email: member.email,
        role: member.role === 'owner' ? 'admin' : 'member',
        joined_at: member.joined_at,
      }));
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
  const isCurrentUserAdmin = selectedHousehold && user ?
    members.find((m: { user_id: string; role: string }) => m.user_id === user.id)?.role === 'admin' : false;

  // Show loading state
  if (userLoading) {
    return (
      <>
        <Navigation />
        <main className="container mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
          <div className="flex h-[400px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
      </>
    );
  }

  // Show paywall for non-subscribed users
  if (!isSubscribed) {
    return (
      <>
        <Navigation />
        <main className="container mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Sharing</h1>
              <p className="mt-1 text-sm text-muted-foreground sm:mt-2">
                Share receipts and expenses with family or roommates
              </p>
            </div>
          </div>

          <Card className="border-2 border-primary/20 bg-linear-to-br from-primary/5 via-transparent to-primary/5">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <CardTitle className="text-2xl text-foreground">Unlock Household Sharing</CardTitle>
                {trialDays > 0 && (
                  <Badge variant="default" className="text-xs">
                    {trialDays}-day free trial
                  </Badge>
                )}
              </div>
              <CardDescription className="text-base max-w-lg mx-auto">
                Create households to share receipts and track expenses together with family, partners, or roommates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Features Grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col items-center text-center p-4 rounded-lg bg-muted/50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 mb-3">
                    <Home className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1 text-foreground">Create Households</h3>
                  <p className="text-sm text-muted-foreground">
                    Organize by family or group
                  </p>
                </div>
                <div className="flex flex-col items-center text-center p-4 rounded-lg bg-muted/50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 mb-3">
                    <UserPlus className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1 text-foreground">Invite Members</h3>
                  <p className="text-sm text-muted-foreground">
                    Add family & roommates
                  </p>
                </div>
                <div className="flex flex-col items-center text-center p-4 rounded-lg bg-muted/50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 mb-3">
                    <Share2 className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1 text-foreground">Share Receipts</h3>
                  <p className="text-sm text-muted-foreground">
                    Collaborate on expenses
                  </p>
                </div>
                <div className="flex flex-col items-center text-center p-4 rounded-lg bg-muted/50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 mb-3">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1 text-foreground">Manage Access</h3>
                  <p className="text-sm text-muted-foreground">
                    Control permissions
                  </p>
                </div>
              </div>

              {/* Benefits List */}
              <div className="rounded-lg border bg-card p-6">
                <h3 className="font-semibold mb-4 text-foreground">What's included with Premium:</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    'Unlimited household creation',
                    'Invite unlimited members',
                    'Share receipts instantly',
                    'Track shared expenses together',
                    'Admin & member role management',
                    'Household-specific insights',
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="text-center space-y-4 pt-4 border-t">
                <Button
                  onClick={handleUpgradeClick}
                  size="lg"
                  className="gap-2 text-base h-12 px-8"
                >
                  <Crown className="h-5 w-5" />
                  {trialDays > 0 ? `Start ${trialDays}-Day Free Trial` : 'Upgrade to Premium'}
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <p className="text-sm text-muted-foreground">
                  {trialDays > 0
                    ? `Try free for ${trialDays} days. Cancel anytime, no questions asked.`
                    : 'Cancel anytime. No long-term contracts.'}
                </p>
              </div>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Navigation />
      <main className="container mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Sharing</h1>
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
                <p className="text-xs text-muted-foreground text-center">Manage permissions</p>
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
                  currentUserId={currentUserId!}
                  isSubscribed={isSubscribed}
                  onUpdate={() => {
                    queryClient.invalidateQueries({ queryKey: ['households'] });
                  }}
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
                        isCurrentUserAdmin={isCurrentUserAdmin}
                        isSubscribed={isSubscribed}
                        onUpdate={() => {
                          queryClient.invalidateQueries({ queryKey: ['household-members', selectedHouseholdId] });
                        }}
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
    </>
  );
}

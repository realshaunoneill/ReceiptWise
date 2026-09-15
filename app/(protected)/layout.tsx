'use client';

import type React from 'react';
import { useUser } from '@clerk/nextjs';
import { useUser as useUserData } from '@/lib/hooks/use-user';
import { OnboardingProvider } from '@/components/onboarding/onboarding-provider';
import { OnboardingTour } from '@/components/onboarding/onboarding-tour';
import { useOnboarding } from '@/components/onboarding/onboarding-provider';
import { Navigation } from '@/components/layout/navigation';
import { ShieldX, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useClerk } from '@clerk/nextjs';

function BlockedUserPage({ reason }: { reason?: string }) {
  const { signOut } = useClerk();

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Account Suspended</h1>
        <p className="text-muted-foreground mb-4">
          Your account has been suspended and you cannot access the application.
        </p>
        {reason && (
          <div className="mb-6 rounded-lg bg-muted p-4 text-left">
            <p className="text-sm font-medium text-foreground mb-1">Reason:</p>
            <p className="text-sm text-muted-foreground">{reason}</p>
          </div>
        )}
        <p className="text-sm text-muted-foreground mb-6">
          If you believe this is a mistake, please contact our support team.
        </p>
        <div className="flex flex-col gap-3">
          <Button asChild>
            {/* Was receiptwise.app; the product's domain is receiptwise.io, so a
                suspended user's only route back to a human went nowhere. */}
            <a href="mailto:support@receiptwise.io?subject=Account%20suspended">
              <Mail className="mr-2 h-4 w-4" />
              Contact Support
            </a>
          </Button>
          <Button variant="outline" onClick={() => signOut()}>
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProtectedContent({ children }: { children: React.ReactNode }) {
  const { showOnboarding, completeOnboarding, skipOnboarding } = useOnboarding();

  return (
    <>
      <Navigation />
      {children}
      <OnboardingTour
        open={showOnboarding}
        onComplete={completeOnboarding}
        onSkip={skipOnboarding}
      />
    </>
  );
}

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded: clerkLoaded, isSignedIn } = useUser();
  const { isLoading: userDataLoading, isBlocked, blockedReason } = useUserData();

  // Show loading state while authentication is being checked
  if (!clerkLoaded || userDataLoading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Navigation Skeleton */}
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
          <div className="container flex h-14 items-center justify-between">
            <div className="flex items-center gap-6">
              <Skeleton className="h-8 w-32" />
              <div className="hidden md:flex items-center gap-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-9 w-9 rounded-full" />
            </div>
          </div>
        </header>
        {/* Page Content Skeleton */}
        <main className="container mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-9 w-40" />
              <Skeleton className="h-5 w-72" />
            </div>
            <Skeleton className="h-10 w-48" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-lg border bg-card p-6">
                <div className="flex items-center justify-between pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4 rounded-full" />
                </div>
                <Skeleton className="h-8 w-20 mb-1" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-lg border bg-card">
                <div className="p-6 pb-4">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <div className="p-6 pt-0">
                  <Skeleton className="h-[200px] w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // User not signed in (will be redirected by middleware, but show loading)
  if (!isSignedIn) {
    return null;
  }

  // Show blocked user page if account is suspended
  if (isBlocked) {
    return <BlockedUserPage reason={blockedReason} />;
  }

  return (
    <OnboardingProvider>
      <ProtectedContent>{children}</ProtectedContent>
    </OnboardingProvider>
  );
}

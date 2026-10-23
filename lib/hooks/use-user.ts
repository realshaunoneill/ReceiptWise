'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser as useClerkUser } from '@clerk/nextjs';
import type { User } from '@/lib/db/schema';
import type { Feature, FeatureFlags } from '@/lib/features';
import type { FinanceEntitlements } from '@/lib/services/finance-access';

type UserResponse = User & { features?: FeatureFlags; entitlements?: FinanceEntitlements }

interface BlockedUserError {
  isBlocked: true;
  message: string;
  reason?: string;
}

/**
 * Fetch current user from API
 */
async function fetchUser(): Promise<UserResponse> {
  const response = await fetch('/api/users/me');
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));

    // Check if user is blocked (403 status)
    if (response.status === 403 && data.error?.includes('suspended')) {
      const error = new Error(data.error) as Error & { isBlocked?: boolean; blockedReason?: string };
      error.isBlocked = true;
      error.blockedReason = data.blockedReason;
      throw error;
    }

    throw new Error(data.error || 'Failed to fetch user');
  }
  return response.json();
}

/**
 * Update user data
 */
async function updateUser(data: Partial<User>): Promise<UserResponse> {
  const response = await fetch('/api/users/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to update user');
  }
  return response.json();
}

/**
 * Hook to get current user data with subscription status
 */
export function useUser() {
  const { isLoaded: isClerkLoaded, isSignedIn, user: clerkUser } = useClerkUser();

  const {
    data: user,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['user', clerkUser?.id],
    queryFn: fetchUser,
    enabled: isClerkLoaded && isSignedIn && !!clerkUser,
    retry: (failureCount, error) => {
      // Don't retry if user is blocked
      if ((error as Error & { isBlocked?: boolean })?.isBlocked) {
        return false;
      }
      return failureCount < 1;
    },
  });

  // Check if user is blocked
  const typedError = error as (Error & { isBlocked?: boolean; blockedReason?: string }) | null;
  const isBlocked = typedError?.isBlocked === true;
  const blockedReason = typedError?.blockedReason;

  return {
    user,
    isLoading: !isClerkLoaded || isLoading,
    isSignedIn,
    error,
    refetch,
    isSubscribed: user?.subscribed ?? false,
    features: user?.features,
    entitlements: user?.entitlements,
    // Personal Premium, or membership of a household another member pays for: either unlocks
    // the subscriptions/bills pages (shared rows only, in the second case).
    hasFinanceAccess: Boolean(user?.subscribed || (user?.entitlements?.householdIds.length ?? 0) > 0 || user?.entitlements?.personal),
    isBlocked,
    blockedReason,
  };
}

/**
 * Hook to update user data
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUser,
    onSuccess: (data) => {
      // Update the user query cache
      queryClient.setQueryData(['user', data.clerkId], data);
    },
  });
}

/** Whether a server-side feature flag (lib/features.ts) is on for the signed-in user. False while loading. */
export function useFeature(feature: Feature): boolean {
  const { user } = useUser();
  return user?.features?.[feature] ?? false;
}

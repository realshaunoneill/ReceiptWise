'use server';

import { NextResponse } from 'next/server';
import { getAuthenticatedUser, requireNoPendingDeletion, requireSubscription } from '@/lib/auth-helpers';
import { HouseholdError, HouseholdService } from '@/lib/services/household-service';
import type { Household } from '@/lib/db/schema';

/**
 * Server actions return a result object rather than throwing: Next.js replaces a thrown
 * error's message with a generic one in production, so rules like "transfer ownership before
 * leaving" would otherwise reach the user as "Failed".
 */
type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Resolve the caller the same way the API routes do, so blocked accounts are rejected here
 * too. (This previously looked the user up by Clerk id alone, skipping the blocked check.)
 */
async function getCurrentUser() {
  const authResult = await getAuthenticatedUser();
  if (authResult instanceof NextResponse) {
    const body = await authResult.json().catch(() => ({}));
    throw new HouseholdError(body.error || 'Authentication required', 403);
  }
  return authResult.user;
}

async function responseError(response: NextResponse): Promise<string> {
  const body = await response.json().catch(() => ({}));
  return body.error || 'Not allowed';
}

function toFailure(error: unknown): { ok: false; error: string } {
  if (error instanceof HouseholdError) {
    return { ok: false, error: error.message };
  }
  console.error('Household action failed', error);
  return { ok: false, error: 'Something went wrong. Please try again.' };
}

export async function createHousehold(data: { name: string }): Promise<ActionResult<{ household: Household }>> {
  try {
    const user = await getCurrentUser();

    // Same gates as POST /api/households, which this action previously bypassed.
    const subscriptionCheck = await requireSubscription(user);
    if (subscriptionCheck) return { ok: false, error: await responseError(subscriptionCheck) };
    const deletionCheck = requireNoPendingDeletion(user);
    if (deletionCheck) return { ok: false, error: await responseError(deletionCheck) };

    const household = await HouseholdService.createHousehold(user.id, data.name);
    return { ok: true, household };
  } catch (error) {
    return toFailure(error);
  }
}

// Removing, leaving and deleting are deliberately not subscription-gated: someone whose
// Premium has lapsed must still be able to get out of, or wind up, a household.

export async function removeMember(data: { householdId: string; userId: string }): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    await HouseholdService.removeMember(data.householdId, data.userId, user.id);
    return { ok: true };
  } catch (error) {
    return toFailure(error);
  }
}

export async function leaveHousehold(data: { householdId: string }): Promise<ActionResult<{ deletedHousehold: boolean }>> {
  try {
    const user = await getCurrentUser();
    const { deletedHousehold } = await HouseholdService.leaveMember(data.householdId, user.id);
    return { ok: true, deletedHousehold };
  } catch (error) {
    return toFailure(error);
  }
}

export async function transferOwnership(data: { householdId: string; userId: string }): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    await HouseholdService.transferOwnership(data.householdId, data.userId, user.id);
    return { ok: true };
  } catch (error) {
    return toFailure(error);
  }
}

export async function deleteHousehold(householdId: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    await HouseholdService.deleteHousehold(householdId, user.id);
    return { ok: true };
  } catch (error) {
    return toFailure(error);
  }
}

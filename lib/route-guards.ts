import { randomUUID } from 'crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, requireNoPendingDeletion } from '@/lib/auth-helpers';
import { type User } from '@/lib/db/schema';
import { daysBetween, fromUtcDate, isLocalDate, type LocalDate } from '@/lib/dates/local-date';
import { type Feature, isFeatureEnabled } from '@/lib/features';
import { type CorrelationId } from '@/lib/logging';
import {
  type FinanceEntitlements,
  type FinanceScope,
  getFinanceEntitlements,
  hasAnyFinanceAccess,
} from '@/lib/services/finance-access';

export type FinanceRouteContext = {
  user: User;
  correlationId: CorrelationId;
  entitlements: FinanceEntitlements;
};

/**
 * The checks every finance route runs, in order: correlation id, sign-in, the feature flag (if
 * the route is behind one), Premium (yours, or a household's: see lib/services/finance-access.ts),
 * and, for routes that change data, the pending-deletion block.
 *
 * Returns the context, or the error response to send. A route behind a flag that is off answers
 * 404, as if it did not exist.
 */
export async function guardFinanceRoute(
  req: NextRequest,
  options: { mutating: boolean; feature?: Feature },
): Promise<FinanceRouteContext | NextResponse> {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;

  const authResult = await getAuthenticatedUser(correlationId);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  if (options.feature && !isFeatureEnabled(user, options.feature)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const entitlements = await getFinanceEntitlements(user);
  if (!hasAnyFinanceAccess(entitlements)) {
    // Same body as requireSubscription, which the client already handles.
    return NextResponse.json({ error: 'Active subscription required' }, { status: 403 });
  }

  if (options.mutating) {
    const pendingDeletion = requireNoPendingDeletion(user);
    if (pendingDeletion) return pendingDeletion;
  }

  return { user, correlationId, entitlements };
}

/** Standard headers for finance responses: user-specific, never cached. */
export const PRIVATE_NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

/** `?householdId=` selects a household's shared rows; without it, the user's own. */
export function scopeFromSearchParams(params: URLSearchParams): FinanceScope {
  const householdId = params.get('householdId');
  return householdId ? { type: 'household', householdId } : { type: 'mine' };
}

/**
 * The user's calendar day, sent by the client as ?today=YYYY-MM-DD so the plan's "today" is
 * theirs rather than the server's UTC day (users has no time zone). Accepted only within a day
 * of the server's UTC date; anything else falls back to the UTC date.
 */
export function clientToday(param: string | null, now: Date = new Date()): LocalDate {
  const utcToday = fromUtcDate(now);
  if (param && isLocalDate(param) && Math.abs(daysBetween(utcToday, param)) <= 1) return param;
  return utcToday;
}

import { type NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedUser,
  filterReceiptsForSubscription,
  requireHouseholdMembership,
} from '@/lib/auth-helpers';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { getReceipts } from '@/lib/receipt-scanner';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

const MAX_PAGE_SIZE = 100;

/**
 * Parse a positive integer query param, falling back to `fallback` for missing,
 * non-numeric or out-of-range values. Prevents `?limit=999999` and `?page=abc`.
 */
function parsePositiveInt(raw: string | null, fallback: number, max?: number): number {
  const parsed = parseInt(raw || '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return max ? Math.min(parsed, max) : parsed;
}

export async function GET(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const householdId = searchParams.get('householdId');
    const personalOnly = searchParams.get('personalOnly') === 'true';
    const page = parsePositiveInt(searchParams.get('page'), 1);
    const limit = parsePositiveInt(searchParams.get('limit'), 10, MAX_PAGE_SIZE);

    // If householdId is provided, verify the caller is a member of it.
    // Without this the household branch of getReceipts filters on householdId alone,
    // which would return any household's receipts to any authenticated user.
    if (householdId) {
      const membershipCheck = await requireHouseholdMembership(householdId, user.id, correlationId);
      if (membershipCheck) return membershipCheck;
    }

    // Search and filter parameters
    const search = searchParams.get('search') || undefined;
    const category = searchParams.get('category') || undefined;
    const merchant = searchParams.get('merchant') || undefined;
    const minAmount = searchParams.get('minAmount') || undefined;
    const maxAmount = searchParams.get('maxAmount') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const sortBy = searchParams.get('sortBy') || 'date';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const isBusinessExpense = searchParams.get('isBusinessExpense') || undefined;
    const searchAllHouseholds = searchParams.get('searchAllHouseholds') === 'true';

    // Use the helper function to get receipts
    const result = await getReceipts({
      userId: user.id,
      householdId,
      personalOnly,
      page,
      limit,
      search,
      category,
      merchant,
      minAmount,
      maxAmount,
      startDate,
      endDate,
      sortBy,
      sortOrder,
      isBusinessExpense,
      searchAllHouseholds,
    });

    // Filter receipts based on subscription status
    const filteredReceipts = filterReceiptsForSubscription(result.receipts, user.subscribed);

    return NextResponse.json({
      ...result,
      receipts: filteredReceipts,
    }, {
      headers: {
        // Not cached. react-query already caches client-side; an HTTP cache on top meant the
        // refetch after an upload, delete or retry was served the old list for up to 30s.
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    submitLogEvent('receipt', `Error fetching receipts: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json(
      { error: 'Failed to fetch receipts' },
      { status: 500 },
    );
  }
}

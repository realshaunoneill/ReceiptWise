import { type NextRequest, NextResponse } from 'next/server';
import { addressFor } from '@/lib/inbound-email/token';
import { submitLogEvent } from '@/lib/logging';
import { guardFinanceRoute, PRIVATE_NO_STORE } from '@/lib/route-guards';
import { rotateInboundAddress } from '@/lib/services/inbound-address-service';

export const runtime = 'nodejs';

// POST /api/inbound-address/rotate - A new forwarding address; mail to the old one is refused
export async function POST(req: NextRequest) {
  const guard = await guardFinanceRoute(req, { mutating: true, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const address = await rotateInboundAddress(guard.user.id);
  submitLogEvent('inbound-email', 'Forwarding address rotated', guard.correlationId, { userId: guard.user.id });
  return NextResponse.json(
    { address: addressFor(address.token), createdAt: address.createdAt, rotatedAt: address.rotatedAt },
    { headers: PRIVATE_NO_STORE },
  );
}

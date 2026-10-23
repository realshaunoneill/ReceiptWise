import { type NextRequest, NextResponse } from 'next/server';
import { addressFor } from '@/lib/inbound-email/token';
import { guardFinanceRoute, PRIVATE_NO_STORE } from '@/lib/route-guards';
import { getOrCreateInboundAddress } from '@/lib/services/inbound-address-service';

export const runtime = 'nodejs';

// GET /api/inbound-address - Your forwarding address for bills and receipts (made on first use)
export async function GET(req: NextRequest) {
  const guard = await guardFinanceRoute(req, { mutating: false, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const address = await getOrCreateInboundAddress(guard.user.id);
  return NextResponse.json(
    { address: addressFor(address.token), createdAt: address.createdAt, rotatedAt: address.rotatedAt },
    { headers: PRIVATE_NO_STORE },
  );
}

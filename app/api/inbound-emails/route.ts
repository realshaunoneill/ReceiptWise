import { type NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { inboundEmails } from '@/lib/db/schema';
import { guardFinanceRoute, PRIVATE_NO_STORE } from '@/lib/route-guards';

export const runtime = 'nodejs';

// GET /api/inbound-emails - The last 20 forwarded emails and what happened to each (and Gmail's
// forwarding confirmation code, when one arrives)
export async function GET(req: NextRequest) {
  const guard = await guardFinanceRoute(req, { mutating: false, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const rows = await db
    .select({
      id: inboundEmails.id,
      fromAddress: inboundEmails.fromAddress,
      subject: inboundEmails.subject,
      status: inboundEmails.status,
      error: inboundEmails.error,
      partCount: inboundEmails.partCount,
      confirmationCode: inboundEmails.confirmationCode,
      confirmationUrl: inboundEmails.confirmationUrl,
      receivedAt: inboundEmails.receivedAt,
    })
    .from(inboundEmails)
    .where(eq(inboundEmails.userId, guard.user.id))
    .orderBy(desc(inboundEmails.receivedAt))
    .limit(20);
  return NextResponse.json(rows, { headers: PRIVATE_NO_STORE });
}

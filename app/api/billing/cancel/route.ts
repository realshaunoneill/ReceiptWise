import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { cancelPremium, getCancelOptions, syncStripeDataToDatabase } from '@/lib/stripe';
import { premiumSummary } from '@/lib/services/store-premium';
import { confirmationText, type CancelOutcome } from '@/lib/billing/withdrawal';
import { sendServiceEmail, isEmailConfigured } from '@/lib/email/send';
import { submitLogEvent } from '@/lib/logging';

/*
 * The "withdraw from contract here" function (lib/billing/withdrawal.ts has the rules), behind
 * /cancel. GET says what cancelling would do now; POST does it. Only a subscription paid on the
 * website is handled here: the App Store and Google Play have their own cancel buttons, and the
 * page sends people there.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (auth instanceof NextResponse) return auth;
  const { user, correlationId } = auth;

  try {
    const premium = await premiumSummary(user.id);
    const options = user.stripeCustomerId ? await getCancelOptions(user.stripeCustomerId) : { kind: 'none' as const };
    return NextResponse.json({ source: premium.source, options, emailConfigured: isEmailConfigured() });
  } catch (error) {
    submitLogEvent('billing', `Could not read cancel options: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { userId: user.id }, true);
    return NextResponse.json({ error: 'We could not load your subscription. Please try again, or email support@receiptwise.io.' }, { status: 500 });
  }
}

const bodySchema = z.object({ mode: z.enum(['withdraw', 'period_end']) });

export async function POST(request: NextRequest) {
  const receivedAt = new Date().toISOString();
  const auth = await getAuthenticatedUser();
  if (auth instanceof NextResponse) return auth;
  const { user, correlationId } = auth;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Choose how to cancel' }, { status: 400 });
  const { mode } = parsed.data;

  const customerId = user.stripeCustomerId;
  if (!customerId) return NextResponse.json({ error: 'There is no subscription on the website to cancel.' }, { status: 409 });

  try {
    // Decided again here, not taken from the page, so what's done is what's true now.
    const options = await getCancelOptions(customerId);
    let done;
    try {
      done = await cancelPremium(customerId, options, mode, correlationId);
    } catch {
      return NextResponse.json({ error: 'That option is no longer available. Reload the page to see what you can do now.' }, { status: 409 });
    }

    await syncStripeDataToDatabase(customerId, correlationId).catch(() => {
      // The webhook for the cancellation re-syncs too; this only makes Settings right at once.
    });

    const outcome: CancelOutcome = { mode, receivedAt, email: user.email, ...done };
    const text = confirmationText(outcome);
    const emailed = await sendServiceEmail(
      {
        to: user.email,
        subject: mode === 'withdraw' ? 'Your withdrawal from ReceiptWise Premium' : 'Your ReceiptWise Premium is cancelled',
        text,
        idempotencyKey: `cancel-${done.reference}`,
      },
      correlationId,
    );
    submitLogEvent('billing', `Premium ${mode === 'withdraw' ? 'withdrawal' : 'cancellation'} received for user ${user.id} (${options.kind}); email ${emailed}`, correlationId, {
      userId: user.id,
      mode,
      kind: options.kind,
      reference: done.reference,
      refund: done.refund?.status ?? null,
    });

    return NextResponse.json({ outcome, text, emailed: emailed === 'sent' });
  } catch (error) {
    submitLogEvent('billing', `Cancellation failed for user ${user.id}: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { userId: user.id, mode }, true);
    return NextResponse.json({ error: 'We could not cancel just now. Please try again, or email support@receiptwise.io and we will do it for you.' }, { status: 500 });
  }
}

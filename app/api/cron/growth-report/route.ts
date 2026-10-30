import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { isCronAuthorized } from '@/lib/cron-auth';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { gatherGrowthData } from '@/lib/growth/gather';
import { formatGrowthReport, reportWeekEnd } from '@/lib/growth/report';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/cron/growth-report (Mondays 08:20 UTC): last week's accounts, trials, paying
 * households and MRR (lib/growth), posted to Discord. Off until GROWTH_REPORT_DISCORD_WEBHOOK is
 * set. When there are ads, their spend and the kill rule join it (the go-to-market plan, §5).
 */
export async function GET(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  if (!isCronAuthorized(req)) {
    submitLogEvent('cron', 'Unauthorized call to growth-report cron', correlationId, {}, true);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const webhook = process.env.GROWTH_REPORT_DISCORD_WEBHOOK;
  if (!webhook) return NextResponse.json({ skipped: 'GROWTH_REPORT_DISCORD_WEBHOOK is not set' });

  try {
    const data = await gatherGrowthData(reportWeekEnd(new Date()));
    const content = formatGrowthReport(data);
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ReceiptWise', content, allowed_mentions: { parse: [] } }),
    });
    if (!response.ok) throw new Error(`Discord answered ${response.status}`);
    submitLogEvent('cron', 'growth-report posted', correlationId, { accounts: data.accounts.thisWeek, paying: data.premium.stripe + data.premium.store });
    return NextResponse.json({ posted: true });
  } catch (error) {
    submitLogEvent('cron', `growth-report failed: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

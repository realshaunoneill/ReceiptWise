import { describe, expect, it } from 'vitest';
import { formatGrowthReport, reportWeekEnd, type GrowthData } from './report';

const data: GrowthData = {
  from: new Date('2026-10-26T00:00:00Z'),
  to: new Date('2026-11-02T00:00:00Z'),
  accounts: { total: 12, thisWeek: 3, lastWeek: 1, bySource: [{ source: 'chatgpt.com', count: 2 }, { source: 'direct', count: 1 }] },
  activation: { accounts: 4, plan: 3, receiptOrBill: 2 },
  trials: { started: 2, converted: 1, cancelled: 0 },
  premium: { stripe: 2, store: 0, comp: 3, mrrCents: 790 },
  households: { total: 1, covered: 1 },
};

describe('formatGrowthReport', () => {
  it('reads as a short weekly summary', () => {
    expect(formatGrowthReport(data)).toBe([
      '**ReceiptWise, the week to Sun, 1 Nov**',
      'New accounts: **3** (the week before: 1) · 12 in all',
      'Where they came from: chatgpt.com 2 · direct 1',
      'Trials: 2 started · 1 became paid · 0 cancelled',
      'Paying: **2** (website 2, app stores 0) · MRR **€7.90** · given Premium 3',
      "Households: 1 · 1 person covered by someone else's Premium",
      'Of the 4 accounts made in the last 14 days: 3 set up a plan, 2 added a receipt or bill',
    ].join('\n'));
  });

  it('says so when a quiet week has nothing to break down', () => {
    const quiet = formatGrowthReport({ ...data, accounts: { ...data.accounts, thisWeek: 0, bySource: [] }, activation: { accounts: 0, plan: 0, receiptOrBill: 0 }, households: { total: 0, covered: 2 } });
    expect(quiet).toContain('Where they came from: none');
    expect(quiet).toContain('No accounts made in the last 14 days');
    expect(quiet).toContain('2 people covered');
  });
});

describe('reportWeekEnd', () => {
  it('is the latest Monday 00:00 UTC at or before now', () => {
    expect(reportWeekEnd(new Date('2026-11-02T08:20:00Z')).toISOString()).toBe('2026-11-02T00:00:00.000Z');
    expect(reportWeekEnd(new Date('2026-11-01T23:59:00Z')).toISOString()).toBe('2026-10-26T00:00:00.000Z');
  });
});

import { describe, expect, it } from 'vitest';
import { type WireReceipt } from '@shared/api/receipts';
import { groupByDay } from './group';

const receipt = (id: string, day: string | null, amount: string | null, status = 'completed', currency = 'EUR'): WireReceipt => ({
  id, userId: 'u', householdId: null, imageUrl: 'https://x/y.jpg', merchantName: 'Shop', totalAmount: amount, currency,
  transactionDate: day, category: null, paymentMethod: null, location: null, tax: null, serviceCharge: null, subtotal: null,
  receiptNumber: null, processingStatus: status, processingError: null, isReceipt: true, isBusinessExpense: false,
  businessCategory: null, businessNotes: null, source: 'app', createdAt: '2026-10-26T10:00:00Z', updatedAt: '2026-10-26T10:00:00Z',
});

describe('groupByDay', () => {
  it('puts receipts under their day, newest first, with each currency totalled on its own', () => {
    const rows = groupByDay([
      receipt('a', '2026-10-25', '10.00'),
      receipt('b', '2026-10-26', '4.50'),
      receipt('c', '2026-10-25', '2.00', 'completed', 'USD'),
    ], '2026-10-26', 'EUR');
    expect(rows.map((row) => (row.type === 'day' ? row.label : row.key))).toEqual(['Today', 'b', 'Yesterday', 'a', 'c']);
    expect(rows[2]).toMatchObject({ type: 'day', total: '€10.00 + $2.00', count: 2 });
  });
  it("leaves receipts still being read out of the day's total", () => {
    const rows = groupByDay([receipt('a', '2026-10-26', '10.00'), receipt('b', '2026-10-26', null, 'processing')], '2026-10-26', 'EUR');
    expect(rows[0]).toMatchObject({ total: '€10.00', count: 2 });
  });
});

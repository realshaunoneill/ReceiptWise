import { describe, expect, it } from 'vitest';
import { usualItems } from './usual-items';

describe('usualItems', () => {
  const rows = [
    { label: 'Living money', amount: '220.00', date: '2026-10-01' },
    { label: 'living money ', amount: '250.00', date: '2026-09-01' },
    { label: 'Dress', amount: '85.00', date: '2026-10-03' },
    { label: 'Petrol and rolls', amount: '115.00', date: '2026-11-02' },
    { label: 'Trip', amount: '450.00', date: '2026-12-01' },
  ];

  it('offers earlier one-offs, most used first, with the latest amount', () => {
    expect(usualItems(rows, '2026-11-01', [], 10)).toEqual([
      { label: 'Living money', amount: '220.00' },
      { label: 'Dress', amount: '85.00' },
    ]);
  });

  it("leaves out future one-offs and what's already in the period", () => {
    expect(usualItems(rows, '2026-12-01', ['dress'], 10).map((item) => item.label)).toEqual(['Living money', 'Petrol and rolls']);
    expect(usualItems(rows, '2026-12-01', [], 1)).toHaveLength(1);
  });
});

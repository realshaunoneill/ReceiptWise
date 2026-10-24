import { type LocalDate } from '@/lib/dates/local-date';

/** A one-off used in earlier periods, offered as a chip when adding: its label and the amount it was last time. */
export type UsualItem = { label: string; amount: string };

/**
 * "Your usual items": labels of one-offs dated before the period being planned, most used first,
 * then most recent, leaving out what's already in the period. Each comes with its latest amount,
 * so a tap fills both in.
 *
 * Only earlier ones count. Every label ever used, future ones included, used to become a chip, so
 * a one-off typed in for next month ("Trip") was offered back as if it were a regular.
 */
export function usualItems(
  rows: Array<{ label: string; amount: string; date: LocalDate }>,
  before: LocalDate,
  alreadyIn: Iterable<string>,
  limit: number,
): UsualItem[] {
  const skip = new Set([...alreadyIn].map((label) => label.trim().toLowerCase()));
  const byLabel = new Map<string, { label: string; amount: string; date: LocalDate; count: number }>();
  for (const row of rows) {
    if (row.date >= before) continue;
    const key = row.label.trim().toLowerCase();
    if (!key || skip.has(key)) continue;
    const existing = byLabel.get(key);
    if (!existing) {
      byLabel.set(key, { label: row.label.trim(), amount: row.amount, date: row.date, count: 1 });
      continue;
    }
    existing.count += 1;
    if (row.date > existing.date) Object.assign(existing, { label: row.label.trim(), amount: row.amount, date: row.date });
  }
  return [...byLabel.values()]
    .sort((a, b) => b.count - a.count || b.date.localeCompare(a.date) || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map(({ label, amount }) => ({ label, amount }));
}

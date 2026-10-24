import { type PlanLine } from '@/lib/plan/compute-plan';

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/**
 * The plan's caveats as one quiet line: "Includes 2 estimates · 1 USD item not counted". The plan
 * worked these out all along, but the page only ever used the missing-income one.
 */
export function planNotes(lines: PlanLine[]): string[] {
  const notes: string[] = [];
  const estimates = lines.filter((line) => line.direction === 'out' && line.counted && line.estimated && line.status !== 'paid').length;
  if (estimates > 0) notes.push(`Includes ${plural(estimates, 'estimate')}`);
  const overdue = lines.filter((line) => line.status === 'overdue').length;
  if (overdue > 0) notes.push(`${overdue} overdue`);
  const otherCurrency = new Map<string, number>();
  for (const line of lines) {
    if (line.notCountedReason === 'other_currency') otherCurrency.set(line.currency, (otherCurrency.get(line.currency) ?? 0) + 1);
  }
  for (const [currency, count] of otherCurrency) notes.push(`${plural(count, `${currency} item`)} not counted`);
  return notes;
}

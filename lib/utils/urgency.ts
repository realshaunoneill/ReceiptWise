/**
 * How close a payment is, expressed once.
 *
 * Three components each carried their own version of this scale, written
 * directly as Tailwind literals and disagreeing about the boundaries:
 *
 *   upcoming-subscription-card  0 → red, 1 → orange, ≤3 → yellow, else blue
 *   next-subscription-card      ≤2 → red, ≤7 → blue, else nothing
 *   subscription-insights       ≤2 → red, else blue
 *
 * So the same subscription could be red on one card and blue on the card beside
 * it. Two other problems were shared: four gradations is more precision than the
 * information supports — "due in three days" and "due in two days" do not warrant
 * different colours — and the final step used blue to mean "nothing to worry
 * about", which reads as a status rather than as the absence of one.
 *
 * Three levels, on the tokens: due now, due soon, and everything else in plain
 * muted text.
 */

export type Urgency = 'due' | 'soon' | 'later';

/** `daysUntil` may be negative for an overdue payment. */
export function getUrgency(daysUntil: number): Urgency {
  if (daysUntil <= 0) return 'due';
  if (daysUntil <= 3) return 'soon';
  return 'later';
}

const TEXT: Record<Urgency, string> = {
  due: 'text-destructive',
  soon: 'text-warning',
  later: 'text-muted-foreground',
};

const SURFACE: Record<Urgency, string> = {
  due: 'border-destructive/40 bg-destructive/5',
  soon: 'border-warning/40 bg-warning/5',
  later: '',
};

const TINT: Record<Urgency, string> = {
  due: 'bg-destructive/10',
  soon: 'bg-warning/10',
  later: 'bg-muted',
};

export function urgencyTextClass(daysUntil: number): string {
  return TEXT[getUrgency(daysUntil)];
}

/** Border + background for a whole card. Empty for `later`, deliberately. */
export function urgencySurfaceClass(daysUntil: number): string {
  return SURFACE[getUrgency(daysUntil)];
}

/** Background for an icon well. */
export function urgencyTintClass(daysUntil: number): string {
  return TINT[getUrgency(daysUntil)];
}

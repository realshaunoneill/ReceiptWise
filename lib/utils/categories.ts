import {
  Armchair,
  Bus,
  Car,
  Clapperboard,
  Coffee,
  CookingPot,
  CreditCard,
  Cross,
  Laptop,
  Lightbulb,
  Pill,
  Plane,
  ShoppingBag,
  ShoppingCart,
  Shirt,
  type LucideIcon,
} from 'lucide-react';

/**
 * The one place a spending category is described.
 *
 * Previously `receipt-list.tsx` and `receipt-timeline.tsx` each carried their own
 * colour map and they had drifted apart: the timeline knew about `gas` and
 * `coffee`, the list did not, so the same receipt showed a green badge in one
 * view and a grey "other" badge in the other. The list also looked its colours
 * up with the raw category string while the timeline lower-cased first, so a
 * capitalised value from the scanner only matched in one of the two.
 *
 * The keys below are exactly the values the extraction prompt in `lib/openai.ts`
 * is allowed to return. Adding a category means adding it there and here.
 */

export type CategoryTone =
  | 'food'
  | 'transport'
  | 'shopping'
  | 'health'
  | 'bills'
  | 'leisure'
  | 'neutral';

export interface CategoryMeta {
  /** Human label, sentence case. */
  label: string;
  icon: LucideIcon;
  tone: CategoryTone;
}

export const CATEGORIES: Record<string, CategoryMeta> = {
  groceries: { label: 'Groceries', icon: ShoppingCart, tone: 'food' },
  dining: { label: 'Dining', icon: CookingPot, tone: 'food' },
  coffee: { label: 'Coffee', icon: Coffee, tone: 'food' },
  transportation: { label: 'Transport', icon: Bus, tone: 'transport' },
  gas: { label: 'Fuel', icon: Car, tone: 'transport' },
  travel: { label: 'Travel', icon: Plane, tone: 'transport' },
  shopping: { label: 'Shopping', icon: ShoppingBag, tone: 'shopping' },
  clothing: { label: 'Clothing', icon: Shirt, tone: 'shopping' },
  electronics: { label: 'Electronics', icon: Laptop, tone: 'shopping' },
  home: { label: 'Home', icon: Armchair, tone: 'shopping' },
  healthcare: { label: 'Healthcare', icon: Cross, tone: 'health' },
  pharmacy: { label: 'Pharmacy', icon: Pill, tone: 'health' },
  utilities: { label: 'Utilities', icon: Lightbulb, tone: 'bills' },
  entertainment: { label: 'Entertainment', icon: Clapperboard, tone: 'leisure' },
  other: { label: 'Other', icon: CreditCard, tone: 'neutral' },
};

const FALLBACK: CategoryMeta = CATEGORIES.other;

/**
 * Tailwind classes per tone. Written out rather than interpolated so Tailwind's
 * scanner can see them.
 */
const TONE_CLASSES: Record<CategoryTone, string> = {
  food: 'text-category-food bg-category-food/10 border-category-food/20',
  transport: 'text-category-transport bg-category-transport/10 border-category-transport/20',
  shopping: 'text-category-shopping bg-category-shopping/10 border-category-shopping/20',
  health: 'text-category-health bg-category-health/10 border-category-health/20',
  bills: 'text-category-bills bg-category-bills/10 border-category-bills/20',
  leisure: 'text-category-leisure bg-category-leisure/10 border-category-leisure/20',
  neutral: 'text-category-neutral bg-category-neutral/10 border-category-neutral/20',
};

const TONE_TEXT_CLASSES: Record<CategoryTone, string> = {
  food: 'text-category-food',
  transport: 'text-category-transport',
  shopping: 'text-category-shopping',
  health: 'text-category-health',
  bills: 'text-category-bills',
  leisure: 'text-category-leisure',
  neutral: 'text-category-neutral',
};

/** Look a category up, tolerating casing and unknown values. */
export function getCategory(category?: string | null): CategoryMeta {
  if (!category) return FALLBACK;
  return CATEGORIES[category.trim().toLowerCase()] ?? FALLBACK;
}

/** Badge classes (text + tint + border) for a category. */
export function categoryBadgeClasses(category?: string | null): string {
  return TONE_CLASSES[getCategory(category).tone];
}

/** Foreground-only classes, for icons sitting on their own. */
export function categoryTextClasses(category?: string | null): string {
  return TONE_TEXT_CLASSES[getCategory(category).tone];
}

/**
 * Options for the receipts filter.
 *
 * The filter used to offer "Restaurant" and "Retail", which the scanner never
 * produces — picking either returned zero receipts every time — while giving no
 * way to filter the categories it does produce (dining, coffee, fuel, pharmacy,
 * travel and the rest). Deriving the list from `CATEGORIES` means the filter and
 * the extraction vocabulary cannot drift apart again.
 */
export const CATEGORY_FILTER_OPTIONS: Array<{ value: string; label: string }> =
  Object.entries(CATEGORIES)
    .filter(([value]) => value !== 'other')
    .map(([value, meta]) => ({ value, label: meta.label }))
    .sort((a, b) => a.label.localeCompare(b.label))
    .concat([{ value: 'other', label: CATEGORIES.other.label }]);

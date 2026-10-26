/**
 * The one place a spending category is described, for the website and the app.
 *
 * Previously `receipt-list.tsx` and `receipt-timeline.tsx` each carried their own
 * colour map and they had drifted apart: the timeline knew about `gas` and
 * `coffee`, the list did not, so the same receipt showed a green badge in one
 * view and a grey "other" badge in the other. The list also looked its colours
 * up with the raw category string while the timeline lower-cased first, so a
 * capitalised value from the scanner only matched in one of the two.
 *
 * The keys below are exactly the values the extraction prompt in `lib/receipt-ai.ts`
 * is allowed to return. Adding a category means adding it there and here.
 *
 * Icons are named, not imported: the website draws them with lucide-react
 * (lib/utils/categories.ts) and the app with lucide-react-native, from the same names.
 */

export type CategoryTone =
  | 'food'
  | 'transport'
  | 'shopping'
  | 'health'
  | 'bills'
  | 'leisure'
  | 'neutral';

/** Lucide icon names, the same in lucide-react and lucide-react-native. */
export type CategoryIconName =
  | 'ShoppingCart' | 'CookingPot' | 'Coffee' | 'Bus' | 'Car' | 'Plane' | 'ShoppingBag' | 'Shirt'
  | 'Laptop' | 'Armchair' | 'Cross' | 'Pill' | 'Lightbulb' | 'Clapperboard' | 'CreditCard';

export interface CategoryInfo {
  /** Human label, sentence case. */
  label: string;
  iconName: CategoryIconName;
  tone: CategoryTone;
}

export const CATEGORY_INFO: Record<string, CategoryInfo> = {
  groceries: { label: 'Groceries', iconName: 'ShoppingCart', tone: 'food' },
  dining: { label: 'Dining', iconName: 'CookingPot', tone: 'food' },
  coffee: { label: 'Coffee', iconName: 'Coffee', tone: 'food' },
  transportation: { label: 'Transport', iconName: 'Bus', tone: 'transport' },
  gas: { label: 'Fuel', iconName: 'Car', tone: 'transport' },
  travel: { label: 'Travel', iconName: 'Plane', tone: 'transport' },
  shopping: { label: 'Shopping', iconName: 'ShoppingBag', tone: 'shopping' },
  clothing: { label: 'Clothing', iconName: 'Shirt', tone: 'shopping' },
  electronics: { label: 'Electronics', iconName: 'Laptop', tone: 'shopping' },
  home: { label: 'Home', iconName: 'Armchair', tone: 'shopping' },
  healthcare: { label: 'Healthcare', iconName: 'Cross', tone: 'health' },
  pharmacy: { label: 'Pharmacy', iconName: 'Pill', tone: 'health' },
  utilities: { label: 'Utilities', iconName: 'Lightbulb', tone: 'bills' },
  entertainment: { label: 'Entertainment', iconName: 'Clapperboard', tone: 'leisure' },
  other: { label: 'Other', iconName: 'CreditCard', tone: 'neutral' },
};

/** Look a category up, tolerating casing and unknown values. */
export function getCategoryInfo(category?: string | null): CategoryInfo {
  if (!category) return CATEGORY_INFO.other;
  return CATEGORY_INFO[category.trim().toLowerCase()] ?? CATEGORY_INFO.other;
}

/**
 * Options for the receipts filter.
 *
 * The filter used to offer "Restaurant" and "Retail", which the scanner never
 * produces — picking either returned zero receipts every time — while giving no
 * way to filter the categories it does produce (dining, coffee, fuel, pharmacy,
 * travel and the rest). Deriving the list from `CATEGORY_INFO` means the filter and
 * the extraction vocabulary cannot drift apart again.
 */
export const CATEGORY_FILTER_OPTIONS: Array<{ value: string; label: string }> =
  Object.entries(CATEGORY_INFO)
    .filter(([value]) => value !== 'other')
    .map(([value, meta]) => ({ value, label: meta.label }))
    .sort((a, b) => a.label.localeCompare(b.label))
    .concat([{ value: 'other', label: CATEGORY_INFO.other.label }]);

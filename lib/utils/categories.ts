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
import { CATEGORY_INFO, type CategoryIconName, type CategoryTone } from '@/shared/receipts/categories';

/**
 * Spending categories on the website: the shared description (shared/receipts/categories.ts,
 * which the app uses too) with lucide-react icons and Tailwind classes.
 */

export { CATEGORY_FILTER_OPTIONS, type CategoryTone } from '@/shared/receipts/categories';

const ICONS: Record<CategoryIconName, LucideIcon> = {
  Armchair, Bus, Car, Clapperboard, Coffee, CookingPot, CreditCard, Cross, Laptop, Lightbulb, Pill, Plane,
  ShoppingBag, ShoppingCart, Shirt,
};

export interface CategoryMeta {
  /** Human label, sentence case. */
  label: string;
  icon: LucideIcon;
  tone: CategoryTone;
}

export const CATEGORIES: Record<string, CategoryMeta> = Object.fromEntries(
  Object.entries(CATEGORY_INFO).map(([key, info]) => [key, { label: info.label, icon: ICONS[info.iconName], tone: info.tone }]),
);

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

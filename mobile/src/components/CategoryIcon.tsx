import React from 'react';
import {
  Armchair, Bus, Car, Clapperboard, Coffee, CookingPot, CreditCard, Cross, Laptop, Lightbulb, Pill, Plane, ShoppingBag, ShoppingCart, Shirt,
  type LucideIcon,
} from 'lucide-react-native';
import { getCategoryInfo, type CategoryIconName } from '@shared/receipts/categories';
import { useTheme } from '../contexts/ThemeContext';

/** The same icons the website uses for each category (shared/receipts/categories.ts), from lucide-react-native. */
const ICONS: Record<CategoryIconName, LucideIcon> = {
  Armchair, Bus, Car, Clapperboard, Coffee, CookingPot, CreditCard, Cross, Laptop, Lightbulb, Pill, Plane, ShoppingBag, ShoppingCart, Shirt,
};

export function CategoryIcon({ category, size = 20 }: { category: string | null | undefined; size?: number }) {
  const { colors } = useTheme();
  const info = getCategoryInfo(category);
  const Icon = ICONS[info.iconName];
  return <Icon size={size} color={colors.category[info.tone]} strokeWidth={2} />;
}

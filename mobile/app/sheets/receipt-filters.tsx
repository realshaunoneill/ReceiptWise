import React, { useState } from 'react';
import { useNavigation } from 'expo-router';
import { CATEGORY_FILTER_OPTIONS } from '@shared/receipts/categories';
import { useHouseholds } from '../../src/hooks/useHouseholds';
import { setReceiptFilters, SORT_ORDERS, useReceiptFilters, type ReceiptFilterState } from '../../src/receipts/filters';
import Button, { success } from '../../src/ui/Button';
import { Field, Segmented } from '../../src/ui/Controls';
import { DateField, MoneyField, PickerField } from '../../src/ui/Form';
import SheetScreen from '../../src/ui/Sheet';
import Text from '../../src/ui/Text';

const ALL = 'all';
type SortField = keyof typeof SORT_ORDERS;

/** Narrow the receipts list (the website's Filters sheet): whose, category, shop, amount, dates, business, and the order. */
export default function ReceiptFiltersSheet() {
  const navigation = useNavigation();
  const filters = useReceiptFilters();
  const households = useHouseholds();
  const [draft, setDraft] = useState<ReceiptFilterState>(filters);
  const set = (change: Partial<ReceiptFilterState>) => setDraft((current) => ({ ...current, ...change }));
  const sortBy: SortField = draft.sortBy ?? 'date';
  const sortOrder = draft.sortOrder ?? SORT_ORDERS[sortBy].default;

  const apply = () => {
    // Empty fields are dropped, so they don't count as filters.
    const clean = Object.fromEntries(Object.entries(draft).filter(([, value]) => typeof value === 'string' && value.trim() !== '')) as ReceiptFilterState;
    setReceiptFilters(clean);
    success();
    navigation.goBack();
  };

  return (
    <SheetScreen title="Filters" action={{ label: 'Show', onPress: apply }}>
      {(households.data?.length ?? 0) > 0 && (
        <PickerField
          label="Show"
          value={draft.householdId ?? ALL}
          options={[{ value: ALL, label: 'My receipts' }, ...(households.data ?? []).map((household) => ({ value: household.id, label: household.name }))]}
          onChange={(value) => set({ householdId: value === ALL ? undefined : value })}
          hint={draft.householdId ? "Everything shared with the household, whoever added it." : 'Everything you added, shared or not.'}
        />
      )}
      <PickerField
        label="Category"
        value={draft.category ?? ALL}
        options={[{ value: ALL, label: 'Any category' }, ...CATEGORY_FILTER_OPTIONS]}
        onChange={(value) => set({ category: value === ALL ? undefined : value })}
      />
      <Field label="Shop" value={draft.merchant ?? ''} onChangeText={(merchant) => set({ merchant })} placeholder="Any shop" autoCapitalize="words" />
      <MoneyField label="At least" value={draft.minAmount ?? ''} onChangeText={(minAmount) => set({ minAmount })} placeholder="Any amount" />
      <MoneyField label="At most" value={draft.maxAmount ?? ''} onChangeText={(maxAmount) => set({ maxAmount })} placeholder="Any amount" />
      <DateField label="From" value={draft.startDate ?? null} onChange={(day) => set({ startDate: day ?? undefined })} optional />
      <DateField label="To" value={draft.endDate ?? null} onChange={(day) => set({ endDate: day ?? undefined })} optional />
      <PickerField
        label="Business expenses"
        value={draft.isBusinessExpense ?? ALL}
        options={[{ value: ALL, label: 'Business and personal' }, { value: 'true', label: 'Business only' }, { value: 'false', label: 'Personal only' }]}
        onChange={(value) => set({ isBusinessExpense: value === ALL ? undefined : value as 'true' | 'false' })}
      />
      <Text variant="label">Order</Text>
      <Segmented<SortField>
        accessibilityLabel="Sort by"
        value={sortBy}
        onChange={(field) => set({ sortBy: field, sortOrder: SORT_ORDERS[field].default })}
        options={[{ value: 'date', label: 'Date' }, { value: 'amount', label: 'Amount' }, { value: 'merchant', label: 'Shop' }]}
      />
      <Segmented<'asc' | 'desc'>
        accessibilityLabel="Direction"
        value={sortOrder}
        onChange={(order) => set({ sortOrder: order })}
        options={(SORT_ORDERS[sortBy].default === 'asc' ? (['asc', 'desc'] as const) : (['desc', 'asc'] as const)).map((order) => ({ value: order, label: SORT_ORDERS[sortBy][order] }))}
      />
      <Button label="Clear filters" variant="secondary" onPress={() => setDraft({ householdId: draft.householdId })} />
    </SheetScreen>
  );
}

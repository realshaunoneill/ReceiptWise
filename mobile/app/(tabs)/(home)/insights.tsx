import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronDown, Search } from 'lucide-react-native';
import { choose } from '../../../src/confirm';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { useHouseholds } from '../../../src/hooks/useHouseholds';
import { useMe } from '../../../src/hooks/useMe';
import BillsInsights from '../../../src/insights/BillsInsights';
import SummaryCard from '../../../src/insights/SummaryCard';
import TopItems from '../../../src/insights/TopItems';
import { GUTTER, radius, space } from '../../../src/theme';
import Button, { selectionTick } from '../../../src/ui/Button';
import { Field, Segmented } from '../../../src/ui/Controls';
import { Notice } from '../../../src/ui/Feedback';
import { Section } from '../../../src/ui/Section';
import TabScreen from '../../../src/ui/TabScreen';
import Text from '../../../src/ui/Text';

type Tab = 'overview' | 'items' | 'bills';

/**
 * What you spend on, what you buy most, and what the bills cost (the website's Insights): a written
 * summary and the top items, any item's history, and the regular payments. For your receipts or a
 * household's; the insights routes take a household or nothing.
 */
export default function Insights() {
  const me = useMe();
  const [tab, setTab] = useState<Tab>('overview');
  const [householdId, setHouseholdId] = useState<string | undefined>();
  const billsEnabled = me.data?.features.bills !== false;
  const currency = me.data?.currency ?? 'EUR';

  if (me.data && !me.data.subscribed) {
    return (
      <TabScreen>
        <Section>
          <Notice tone="neutral" title="Insights are part of Premium">
            Once there are receipts to read, this breaks down where the money went and what you buy most often: a written summary of a period, the trend, the categories, and every time you bought a thing and what it cost.
          </Notice>
        </Section>
      </TabScreen>
    );
  }

  return (
    <TabScreen>
      <View style={{ marginHorizontal: GUTTER, marginBottom: space.lg, gap: space.md }}>
        <HouseholdChoice value={householdId} onChange={setHouseholdId} />
        <Segmented<Tab>
          accessibilityLabel="Show"
          value={tab}
          onChange={setTab}
          options={[{ value: 'overview', label: 'Overview' }, { value: 'items', label: 'Items' }, { value: 'bills', label: billsEnabled ? 'Bills' : 'Subscriptions' }]}
        />
      </View>
      {tab === 'overview' && (
        <>
          <Section>
            <SummaryCard householdId={householdId} />
          </Section>
          <TopItems householdId={householdId} />
        </>
      )}
      {tab === 'items' && <ItemSearch householdId={householdId} />}
      {/* Bills aren't split by household here, as on the website. */}
      {tab === 'bills' && <BillsInsights currency={currency} billsEnabled={billsEnabled} />}
    </TabScreen>
  );
}

/** "My receipts" or a household you're in (any: the insights don't need its Premium to read). */
function HouseholdChoice({ value, onChange }: { value?: string; onChange: (householdId: string | undefined) => void }) {
  const { colors } = useTheme();
  const households = useHouseholds();
  if (!households.data?.length) return null;
  const options = [{ id: undefined as string | undefined, name: 'My receipts' }, ...households.data.map((household) => ({ id: household.id as string | undefined, name: household.name }))];
  const current = options.find((option) => option.id === value) ?? options[0];
  return (
    <Pressable
      onPress={async () => {
        const index = await choose('Show insights for', options.map((option) => ({ label: option.id === current.id ? `${option.name} ✓` : option.name })));
        if (index !== null && options[index].id !== current.id) {
          selectionTick();
          onChange(options[index].id);
        }
      }}
      accessibilityRole="button"
      accessibilityLabel={`Insights for ${current.name}. Change`}
      hitSlop={6}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: pressed ? colors.cardPressed : colors.card, borderWidth: 1, borderColor: colors.border })}
    >
      <Text variant="footnote" weight="medium">{current.name}</Text>
      <ChevronDown size={15} color={colors.textMuted} />
    </Pressable>
  );
}

/** Any item by name: every time it was bought over the past year, and what it cost. */
function ItemSearch({ householdId }: { householdId?: string }) {
  const router = useRouter();
  const [term, setTerm] = useState('');
  const search = () => {
    const name = term.trim();
    if (name) router.push({ pathname: '/items/[name]', params: { name, ...(householdId ? { householdId } : {}) } });
  };
  return (
    <Section title="Item history" footer="Every time you bought it over the past year: where, how often and what it cost.">
      <View style={{ gap: space.md }}>
        <Field label="Item" value={term} onChangeText={setTerm} placeholder="Coffee, milk, bread…" returnKeyType="search" onSubmitEditing={search} autoCorrect={false} />
        <Button label="Look it up" icon={Search} disabled={!term.trim()} onPress={search} />
      </View>
    </Section>
  );
}

import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import ScopePicker from '../../../src/components/ScopePicker';
import { useMe } from '../../../src/hooks/useMe';
import { useTopItems } from '../../../src/hooks/useInsights';
import SummaryCard from '../../../src/insights/SummaryCard';
import TopItems from '../../../src/insights/TopItems';
import { useScope } from '../../../src/scope';
import { GUTTER, space } from '../../../src/theme';
import Button from '../../../src/ui/Button';
import { Field, Segmented } from '../../../src/ui/Controls';
import { Notice } from '../../../src/ui/Feedback';
import { Chips } from '../../../src/ui/Form';
import { Section } from '../../../src/ui/Section';
import TabScreen from '../../../src/ui/TabScreen';

type Tab = 'overview' | 'items';
const PERIODS = ['1', '3', '6', '12'] as const;
type Months = typeof PERIODS[number];

/**
 * What you spend on and what you buy most (the website's Insights): a written summary and the top
 * items for one period, and any item's history. For whoever Home shows ("Just me" or a household):
 * it had its own "My receipts" picker, and a Bills segment that repeated the Bills tab.
 */
export default function Insights() {
  const me = useMe();
  const [tab, setTab] = useState<Tab>('overview');
  // One period for the Overview: the summary and the top items each had their own, set differently.
  const [months, setMonths] = useState<Months>('3');
  const { householdId } = useScope();

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
        <ScopePicker />
        <Segmented<Tab>
          accessibilityLabel="Show"
          value={tab}
          onChange={setTab}
          options={[{ value: 'overview', label: 'Overview' }, { value: 'items', label: 'Items' }]}
        />
        {tab === 'overview' && (
          <Segmented<Months>
            accessibilityLabel="Period"
            value={months}
            onChange={setMonths}
            options={PERIODS.map((value) => ({ value, label: value === '1' ? 'Last month' : `${value} months` }))}
          />
        )}
      </View>
      {tab === 'overview' && (
        <>
          <Section>
            <SummaryCard householdId={householdId} months={Number(months)} />
          </Section>
          <TopItems householdId={householdId} months={Number(months)} />
        </>
      )}
      {tab === 'items' && <ItemSearch householdId={householdId} />}
    </TabScreen>
  );
}

/**
 * Any item by name: every time it was bought over the past year, and what it cost. The items
 * bought most are underneath, one tap each: it was a bare search box with nothing to start from.
 */
function ItemSearch({ householdId }: { householdId?: string }) {
  const router = useRouter();
  const [term, setTerm] = useState('');
  const top = useTopItems(householdId, 12, 'frequency');
  // The same thing bought in two currencies is two rows there; one chip is enough.
  const mostBought = [...new Set((top.data?.topItems ?? []).map((item) => item.name))].slice(0, 12);
  const open = (name: string) => router.push({ pathname: '/items/[name]', params: { name, ...(householdId ? { householdId } : {}) } });
  const search = () => {
    const name = term.trim();
    if (name) open(name);
  };
  return (
    <Section title="Item history" footer="Every time you bought it over the past year: where, how often and what it cost.">
      <View style={{ gap: space.md }}>
        <Field label="Item" value={term} onChangeText={setTerm} placeholder="Coffee, milk, bread…" returnKeyType="search" onSubmitEditing={search} autoCorrect={false} />
        <Button label="Look it up" icon={Search} disabled={!term.trim()} onPress={search} />
        <Chips label="Your most bought" items={mostBought.map((name) => ({ key: name, label: name, hint: `See ${name}'s history` }))} onPick={open} />
      </View>
    </Section>
  );
}

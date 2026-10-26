import React from 'react';
import { useRouter } from 'expo-router';
import { formatTotals, totalsByCurrency } from '@shared/currency-totals';
import { daysBetween, localToday } from '@shared/dates/local-date';
import { getUrgency } from '@shared/urgency';
import { billDay, dueLabel, type ListedBill } from '../bills/summary';
import Amount from '../ui/Amount';
import Row from '../ui/Row';
import { List, Section } from '../ui/Section';
import Text from '../ui/Text';

/**
 * Bills and subscriptions due in the next `days` (the website's UpcomingPayments), soonest first,
 * with their total per currency. Nothing at all when none are due.
 */
export default function UpcomingPayments({ bills, currency, days = 7 }: { bills: ListedBill[]; currency: string; days?: number }) {
  const router = useRouter();
  const today = localToday();
  const due = bills
    .filter((bill) => bill.status === 'active' && !!bill.nextBillingDate)
    .map((bill) => ({ bill, day: billDay(bill.nextBillingDate), until: daysBetween(today, billDay(bill.nextBillingDate)) }))
    .filter(({ until }) => until >= 0 && until <= days)
    .sort((a, b) => a.until - b.until);
  if (due.length === 0) return null;
  const total = formatTotals(totalsByCurrency(due.map(({ bill }) => ({ amount: Number(bill.amount), currency: bill.currency })), currency), currency);

  return (
    <Section
      title="Upcoming payments"
      accessory={<Text variant="callout" ink="muted" tabular>{total}</Text>}
      footer={`Next ${days} days · ${due.length === 1 ? '1 payment' : `${due.length} payments`}`}
    >
      <List>
        {due.map(({ bill, day, until }) => {
          // Due today in red, within three days in amber (shared/urgency.ts), as on the website.
          const urgency = getUrgency(until);
          const ink = urgency === 'due' ? 'bad' : urgency === 'soon' ? 'warn' : undefined;
          return (
            <Row
              key={bill.id}
              label={bill.name}
              detail={dueLabel(day, today)}
              value={<Amount value={Number(bill.amount)} currency={bill.currency} ink={ink} />}
              onPress={() => router.push({ pathname: '/bills/[id]', params: { id: bill.id } })}
            />
          );
        })}
      </List>
    </Section>
  );
}

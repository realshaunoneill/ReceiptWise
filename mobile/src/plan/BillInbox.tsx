import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import { type WireInboxDocument } from '@shared/api/bills';
import { type WirePlan } from '@shared/api/plan';
import { formatCents } from '@shared/currency';
import { toCents } from '@shared/money';
import { useTheme } from '../contexts/ThemeContext';
import { openPrivateFile } from '../files';
import { type ApplyBillAction, useApplyBill, useBillInbox, useDeleteBillDocument, useRetryBillDocument } from '../hooks/useBills';
import { space } from '../theme';
import Button, { success } from '../ui/Button';
import { Pill } from '../ui/Feedback';
import { List, Section } from '../ui/Section';
import Text from '../ui/Text';
import { shortDay } from './days';

const money = (amount: string | null, currency: string | null, fallback: string) => {
  const cents = toCents(amount);
  return cents === null ? null : formatCents(cents, currency ?? fallback);
};

/**
 * Bills to file (it was "Bill inbox", easily taken for the Bills tab): bills brought in by a scan
 * here, the website or email. Each is read, then filed against the
 * bill it belongs to, which sets that month's amount and due date. One from a provider filed
 * before goes straight in and shows here as done for a few days.
 */
export default function BillInbox({ plan, householdId }: { plan: WirePlan; householdId?: string }) {
  const router = useRouter();
  const inbox = useBillInbox(householdId);
  const documents = inbox.data ?? [];
  const add = () => router.push({ pathname: '/capture', params: { mode: 'bill' } });

  // Nothing to file: one row at the bottom of the plan instead (app/(tabs)/plan/index.tsx).
  if (documents.length === 0) return null;

  const findOriginal = (id: string) => documents.find((other) => other.id === id);
  return (
    <Section title="Bills to file" accessory={<Button label="Add" variant="plain" size="sm" onPress={add} />}>
      <List>
        {documents.map((document) => (
          <InboxItem key={document.id} document={document} plan={plan} duplicateOf={document.duplicateOfId ? describe(findOriginal(document.duplicateOfId)) : null} />
        ))}
      </List>
    </Section>
  );
}

/** "the Electric Ireland bill of 3 Oct": what a possible duplicate repeats. */
function describe(original: WireInboxDocument | undefined): string {
  if (!original) return 'a bill already brought in';
  const day = original.issueDate ?? original.dueDate;
  const name = original.provider ? `the ${original.provider} bill` : original.fileName ?? 'a bill';
  return day ? `${name} of ${shortDay(day)}` : name;
}

function InboxItem({ document, plan, duplicateOf }: { document: WireInboxDocument; plan: WirePlan; duplicateOf: string | null }) {
  const { colors } = useTheme();
  const apply = useApplyBill();
  const retry = useRetryBillDocument();
  const remove = useDeleteBillDocument();
  const name = document.provider || document.fileName || 'Bill';
  const amount = money(document.amountDue, document.currency, plan.currency);
  const minimum = money(document.minimumPayment, document.currency, plan.currency);
  const due = document.dueDate ? shortDay(document.dueDate) : null;
  const file = () => void openPrivateFile(`/api/bills/documents/${document.id}/file`, document.fileName ?? name);
  const act = (action: ApplyBillAction) => apply.mutate({ id: document.id, action }, { onSuccess: success });
  const error = apply.error?.message ?? retry.error?.message;
  const box = { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm };

  if (document.processingStatus === 'pending' || document.processingStatus === 'processing') {
    return (
      <View style={[box, { flexDirection: 'row', alignItems: 'center', gap: space.md }]} accessibilityLiveRegion="polite">
        <ActivityIndicator color={colors.textMuted} />
        <Text variant="callout" style={{ flex: 1 }} numberOfLines={1}>{`Reading ${document.fileName ?? 'your bill'}…`}</Text>
      </View>
    );
  }

  if (document.processingStatus === 'failed') {
    return (
      <View style={box}>
        <Text variant="callout" weight="medium">{document.fileName ?? 'Bill'}</Text>
        <Text variant="footnote" ink="bad">{document.processingError ?? "Couldn't read it."}</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="Read it again" size="sm" variant="secondary" loading={retry.isPending} onPress={() => retry.mutate(document.id)} />
          <Button label="Remove" size="sm" variant="plain" onPress={() => remove.mutate(document.id)} />
        </View>
      </View>
    );
  }

  if (document.reviewStatus === 'applied') {
    return (
      <View style={[box, { flexDirection: 'row', alignItems: 'center', gap: space.md }]}>
        <CheckCircle2 size={18} color={colors.good} />
        <Text variant="callout" style={{ flex: 1 }} tabular>
          <Text variant="callout" weight="medium">{name}</Text>
          {`${amount ? ` · ${amount}` : ''}${due ? ` due ${due}` : ''}`}
          <Text variant="callout" ink="muted"> · filed automatically</Text>
        </Text>
        <Button label="View" size="sm" variant="plain" onPress={file} />
      </View>
    );
  }

  if (document.reviewStatus === 'needs_document' || document.reviewStatus === 'not_a_bill') {
    return (
      <View style={box}>
        <Text variant="callout" weight="medium">{name}</Text>
        <Text variant="footnote" ink="muted">
          {document.reviewStatus === 'needs_document' ? 'This only says the bill is ready online. Download the bill itself and bring that in.' : "This doesn't look like a bill."}
        </Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="Dismiss" size="sm" variant="secondary" loading={apply.isPending} onPress={() => act({ action: 'dismiss' })} />
          <Button label="View" size="sm" variant="plain" onPress={file} />
        </View>
      </View>
    );
  }

  // Waiting to be filed.
  const isCard = document.documentType === 'credit_card_statement';
  const best = document.suggestions[0];
  return (
    <View style={box}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="callout" weight="medium">{name}</Text>
          <Text variant="footnote" ink="muted" tabular>
            {[amount ?? 'No amount found', due && `due ${due}`, document.periodStart && document.periodEnd && `for ${shortDay(document.periodStart)} – ${shortDay(document.periodEnd)}`].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Button label="View" size="sm" variant="plain" onPress={file} />
      </View>
      {(isCard || !!document.isDirectDebit || !!duplicateOf) && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
          {isCard && <Pill label="Card statement" tone="neutral" />}
          {!!document.isDirectDebit && <Pill label="Direct debit" tone="neutral" />}
          {!!duplicateOf && <Pill label={`Possible duplicate of ${duplicateOf}`} tone="warn" />}
        </View>
      )}
      <View style={{ gap: space.sm }}>
        {document.suggestions.map((suggestion) => (
          <Button key={suggestion.id} label={`File as ${suggestion.name}`} size="sm" disabled={apply.isPending || !amount} onPress={() => act({ action: 'match', subscriptionId: suggestion.id })} />
        ))}
        {isCard && !!minimum && !!best && (
          <Button label={`Pay the minimum (${minimum})`} size="sm" variant="secondary" disabled={apply.isPending} onPress={() => act({ action: 'match', subscriptionId: best.id, amount: 'minimum' })} />
        )}
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Button label="New regular bill" size="sm" variant={document.suggestions.length ? 'secondary' : 'primary'} disabled={apply.isPending || !amount} onPress={() => act({ action: 'new_bill' })} />
          <Button label="Just this once" size="sm" variant="secondary" disabled={apply.isPending || !amount} onPress={() => act({ action: 'one_off' })} />
          <Button label="Dismiss" size="sm" variant="plain" disabled={apply.isPending} onPress={() => act({ action: 'dismiss' })} />
        </View>
      </View>
      {!!error && <Text variant="footnote" ink="bad">{error}</Text>}
    </View>
  );
}

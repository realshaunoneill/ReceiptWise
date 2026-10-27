import React, { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ban, Check, ExternalLink, FileText, Pause, Play, Trash2 } from 'lucide-react-native';
import { type WireBillDetail, type WireFiledBill, type WirePayment } from '@shared/api/bills';
import { formatCurrency } from '@shared/currency';
import { formatLocalDate, localToday } from '@shared/dates/local-date';
import { frequencyName, itemNoun, paymentMethodLabel, paymentStatusLabel, statusLabel } from '@shared/labels/subscriptions';
import { fromCents, toCents } from '@shared/money';
import { frequencyLabel, isAutoPaid } from '@shared/schedule/billing-schedule';
import { billDay, paymentDay } from '../../../src/bills/summary';
import { confirm } from '../../../src/confirm';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { openPrivateFile } from '../../../src/files';
import { useBill, useDeleteBill, useUnlinkPayment, useUpdateBill, useUpdatePayment, type PaymentChange } from '../../../src/hooks/useBills';
import { useHouseholds } from '../../../src/hooks/useHouseholds';
import { useMe } from '../../../src/hooks/useMe';
import { useAccounts } from '../../../src/hooks/usePlan';
import { GUTTER, radius, space, type Tone } from '../../../src/theme';
import { selectionTick, success } from '../../../src/ui/Button';
import { LoadError, Notice, Pill, Skeleton } from '../../../src/ui/Feedback';
import Row from '../../../src/ui/Row';
import { List, Section } from '../../../src/ui/Section';
import TabScreen from '../../../src/ui/TabScreen';
import Text, { FONT } from '../../../src/ui/Text';

const DAY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
const showDay = (day: string) => formatLocalDate(day, DAY, 'en-IE');
const shortDay = (day: string) => formatLocalDate(day, { day: 'numeric', month: 'short' }, 'en-IE');

const PAID_VIA_LABEL: Record<string, string> = { assumed: 'Assumed paid', manual: 'Marked paid', receipt: 'Paid · receipt' };

/** A filed bill's type, from its name: the file route serves it as what it is, but the share sheet needs telling. */
/** What a filed bill is called when it's opened (openPrivateFile takes its type from the response). */
const fileName = (bill: WireFiledBill) => bill.fileName ?? `${bill.provider ?? 'Bill'} bill`;

/**
 * One bill or subscription, everything the website's detail shows: what it is and how it's paid,
 * its dates, every recent payment with what can be done to it (mark paid, skip, link a receipt,
 * change the amount), and the bills filed against it. A household member who didn't add it can
 * mark payments, not change it.
 */
export default function BillScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const me = useMe();
  const query = useBill(id);
  const households = useHouseholds();
  const accounts = useAccounts();
  const update = useUpdateBill(id);
  const remove = useDeleteBill();
  const bill = query.data;

  if (!bill) {
    return (
      <TabScreen>
        {query.isError ? <LoadError message={query.error.message} onRetry={() => void query.refetch()} /> : (
          <View style={{ marginHorizontal: GUTTER, gap: space.lg }}>
            <Skeleton width="60%" height={28} />
            <Skeleton height={160} round={radius.lg} />
            <Skeleton height={220} round={radius.lg} />
          </View>
        )}
      </TabScreen>
    );
  }

  const billsOn = !!me.data?.features.bills;
  const noun = itemNoun(bill.kind, billsOn);
  const variable = bill.amountType === 'variable';
  const amount = Number(bill.amount);
  const household = bill.householdId ? households.data?.find((h) => h.id === bill.householdId) : null;
  const account = bill.paidFromAccountId ? accounts.data?.find((a) => a.id === bill.paidFromAccountId)?.name ?? 'Another account' : 'Main account';
  const schedule = bill.billingFrequency !== 'custom' && bill.billingFrequency !== 'once';

  const toggleStatus = () => {
    const next = bill.status === 'active' ? 'paused' : 'active';
    update.mutate({ status: next }, { onSuccess: success });
  };

  const cancel = async () => {
    if (!(await confirm(`Cancel ${bill.name}?`, "It ends today, so nothing more is expected after this. Its payment history is kept, and you can resume it from the Cancelled tab.", `Cancel ${noun}`))) return;
    // The server ends it today when no end date is given.
    update.mutate({ status: 'cancelled' }, { onSuccess: success });
  };

  const del = async () => {
    if (!(await confirm(`Delete ${bill.name}?`, 'This removes it and all its payment records, and cannot be undone.', 'Delete'))) return;
    remove.mutate(bill.id, { onSuccess: () => navigation.goBack() });
  };

  const website = bill.website ? (/^https?:\/\//i.test(bill.website) ? bill.website : `https://${bill.website}`) : null;

  return (
    <>
      <Stack.Screen
        options={{
          title: bill.name,
          headerRight: bill.canEdit
            ? () => (
              <Pressable onPress={() => router.push({ pathname: '/sheets/bill-edit', params: { id: bill.id } })} hitSlop={12} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}>
                <Text variant="body" ink="accent">Edit</Text>
              </Pressable>
            )
            : undefined,
        }}
      />
      <TabScreen onRefresh={() => query.refetch()}>
        <View style={{ marginHorizontal: GUTTER + space.xs, marginBottom: space.xl, gap: space.sm }}>
          <Text variant="title" accessibilityRole="header">{bill.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' }}>
            <Text variant="largeTitle" tabular>{`${variable ? '~' : ''}${Number.isNaN(amount) ? bill.amount : formatCurrency(amount, bill.currency)}`}</Text>
            <Text variant="callout" ink="secondary">{frequencyLabel(bill.billingFrequency, bill.customFrequencyDays)}</Text>
          </View>
          {!!bill.description && <Text variant="callout" ink="secondary">{bill.description}</Text>}
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            <Pill label={statusLabel(bill.status)} tone={bill.status === 'active' ? 'good' : 'neutral'} />
            {billsOn && <Pill label={bill.kind === 'bill' ? 'Bill' : 'Subscription'} tone="neutral" />}
            {!!bill.isBusinessExpense && <Pill label="Business" tone="neutral" />}
            {!!household && <Pill label={`Shared with ${household.name}`} tone="neutral" />}
          </View>
        </View>

        {update.isError && (
          <Section>
            <Notice tone="bad" title="That didn't save">{update.error.message}</Notice>
          </Section>
        )}

        <Section title="Details">
          <List>
            {billsOn && <Row label="Type" value={`${bill.kind === 'bill' ? 'Bill' : 'Subscription'} · ${variable ? 'amount changes' : 'fixed amount'}`} />}
            <Row label="How often" value={frequencyName(bill.billingFrequency, bill.customFrequencyDays)} />
            {schedule && <Row label="Day of the month" value={String(bill.billingDay)} />}
            {billsOn && <Row label="How it's paid" value={paymentMethodLabel(bill.paymentMethod)} />}
            {billsOn && <Row label="Paid from" value={account} />}
            <Row label="Shared with" value={bill.householdId ? household?.name ?? 'A household' : 'Just you'} />
            {!!bill.category && <Row label="Category" value={bill.category} />}
          </List>
        </Section>

        <Section title="Dates">
          <List>
            <Row label="Started" value={showDay(billDay(bill.startDate))} />
            {!!bill.nextBillingDate && bill.status === 'active' && <Row label="Next due" value={showDay(billDay(bill.nextBillingDate))} />}
            {!!bill.lastPaymentDate && <Row label="Last paid" value={showDay(billDay(bill.lastPaymentDate))} />}
            {!!bill.endDate && <Row label="Ends" value={showDay(billDay(bill.endDate))} />}
          </List>
        </Section>

        {bill.payments.length > 0 && <Payments bill={bill} />}

        {bill.bills.length > 0 && (
          <Section title="Filed bills">
            <List>
              {bill.bills.map((filed) => (
                <FiledBillRow key={filed.id} filed={filed} currency={bill.currency} />
              ))}
            </List>
          </Section>
        )}

        {(!!website || !!bill.notes) && (
          <Section title="More">
            <List>
              {!!website && <Row icon={ExternalLink} label="Website" detail={bill.website ?? undefined} onPress={() => void WebBrowser.openBrowserAsync(website)} />}
              {!!bill.notes && (
                <View style={{ padding: space.lg, gap: space.xs }}>
                  <Text variant="footnote" ink="muted">Notes</Text>
                  <Text variant="callout" selectable>{bill.notes}</Text>
                </View>
              )}
            </List>
          </Section>
        )}

        {bill.canEdit ? (
          <Section>
            <List>
              <Row icon={bill.status === 'active' ? Pause : Play} label={bill.status === 'active' ? 'Pause' : 'Resume'} accent onPress={toggleStatus} />
              {bill.status !== 'cancelled' && <Row icon={Ban} label={`Cancel ${noun}`} destructive onPress={() => void cancel()} />}
              <Row icon={Trash2} label="Delete" destructive onPress={() => void del()} />
            </List>
          </Section>
        ) : (
          <Text variant="footnote" ink="muted" align="center" style={{ marginHorizontal: GUTTER + space.xl }}>
            Someone else in the household added this, so only they can change it. You can mark its payments.
          </Text>
        )}
      </TabScreen>
    </>
  );
}

/**
 * The recent payments, newest first. Tap one to open what can be done to it, under it (a menu
 * here would need more buttons than an Android alert holds); while a change saves it shows as
 * made, and a failure puts it back.
 */
function Payments({ bill }: { bill: WireBillDetail }) {
  const router = useRouter();
  const update = useUpdatePayment();
  const unlink = useUnlinkPayment();
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const today = localToday();
  const error = update.error?.message ?? unlink.error?.message;

  const actionsFor = (payment: WirePayment): Action[] => {
    const filed = bill.bills.find((b) => b.paymentId === payment.id);
    const unsettled = payment.status === 'pending' || payment.status === 'missed';
    const actions: Action[] = [];
    const change = (data: PaymentChange) => {
      selectionTick();
      setOpen(null);
      update.mutate({ paymentId: payment.id, data });
    };
    if (unsettled) {
      actions.push({ label: 'Mark paid', primary: true, run: () => change({ status: 'paid', actualDate: today }) });
      actions.push({ label: 'Skip this time', run: () => change({ status: 'skipped' }) });
    }
    if ((payment.status === 'paid' && !payment.receiptId) || payment.status === 'skipped') {
      // An assumed direct debit that didn't go out (it bounced) becomes missed, set by hand, which
      // the daily job leaves alone; back to pending it would be assumed paid again.
      actions.push(payment.paidVia === 'assumed'
        ? { label: "It didn't go out", run: () => change({ status: 'missed' }) }
        : { label: payment.status === 'skipped' ? "Don't skip" : 'Mark not paid', run: () => change({ status: 'pending' }) });
    }
    if (payment.status !== 'skipped' && payment.status !== 'cancelled' && !(payment.status === 'paid' && payment.receiptId)) {
      actions.push({ label: 'Change the amount', run: () => { setOpen(null); setEditing(payment.id); } });
    }
    if (!payment.receiptId && payment.status !== 'skipped' && payment.status !== 'cancelled') {
      actions.push({ label: 'Link a receipt', run: () => router.push({ pathname: '/sheets/bill-link-receipt', params: { billId: bill.id, paymentId: payment.id } }) });
    }
    if (payment.receiptId) {
      const receiptId = payment.receiptId;
      actions.push({ label: 'View the receipt', run: () => router.push(`/receipts/${receiptId}`) });
      actions.push({ label: 'Unlink the receipt', destructive: true, run: () => { setOpen(null); unlink.mutate(payment.id); } });
    }
    if (filed) {
      actions.push({ label: 'View the bill', run: () => void openPrivateFile(`/api/bills/documents/${filed.id}/file`, fileName(filed)) });
    }
    return actions;
  };

  return (
    <Section title="Payments" footer="Tap a payment to mark it paid, skip it, change its amount or link the receipt that paid it.">
      {!!error && <Notice tone="bad" title="That didn't save" style={{ marginBottom: space.md }}>{error}</Notice>}
      <List>
        {bill.payments.map((payment) => {
          // While it saves, show the change as made.
          const saving = update.isPending && update.variables?.paymentId === payment.id ? update.variables.data : undefined;
          const unlinking = unlink.isPending && unlink.variables === payment.id;
          const shown: WirePayment = {
            ...payment,
            ...(saving?.status ? { status: saving.status, paidVia: saving.status === 'paid' ? 'manual' : null } : {}),
            ...(saving?.expectedAmount ? { expectedAmount: saving.expectedAmount } : {}),
            ...(saving?.actualAmount ? { actualAmount: saving.actualAmount } : {}),
            ...(unlinking ? { receiptId: null, status: 'pending', paidVia: null } : {}),
          };
          if (editing === payment.id) {
            return (
              <AmountEditor
                key={payment.id}
                payment={shown}
                currency={bill.currency}
                onCancel={() => setEditing(null)}
                onSave={(value) => {
                  setEditing(null);
                  update.mutate({ paymentId: payment.id, data: shown.status === 'paid' ? { actualAmount: value } : { expectedAmount: value } }, { onSuccess: success });
                }}
              />
            );
          }
          const expanded = open === payment.id && !saving && !unlinking;
          return (
            <View key={payment.id}>
              <PaymentRow
                payment={shown}
                bill={bill}
                today={today}
                busy={!!saving || unlinking}
                expanded={expanded}
                filed={bill.bills.some((b) => b.paymentId === payment.id)}
                onPress={() => {
                  selectionTick();
                  setOpen(expanded ? null : payment.id);
                }}
              />
              {expanded && <Actions actions={actionsFor(payment)} />}
            </View>
          );
        })}
      </List>
    </Section>
  );
}

type Action = { label: string; run: () => void; primary?: boolean; destructive?: boolean };

/** What can be done to one payment, as buttons under it. */
function Actions({ actions }: { actions: Action[] }) {
  const { colors } = useTheme();
  if (actions.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.md }}>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          onPress={action.run}
          accessibilityRole="button"
          style={({ pressed }) => ({
            minHeight: 36, paddingHorizontal: 14, borderRadius: radius.lg, justifyContent: 'center',
            backgroundColor: action.primary ? colors.accent : action.destructive ? colors.badSoft : colors.field,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Text variant="footnote" weight="semibold" style={{ color: action.primary ? colors.onAccent : action.destructive ? colors.bad : colors.text }}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function PaymentRow({ payment, bill, today, busy, expanded, filed, onPress }: {
  payment: WirePayment;
  bill: WireBillDetail;
  today: string;
  busy: boolean;
  expanded: boolean;
  filed: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const day = paymentDay(payment);
  const paid = payment.status === 'paid';
  const value = paid && payment.actualAmount ? payment.actualAmount : payment.expectedAmount;
  const estimate = !paid && bill.amountType === 'variable' && payment.amountSource === 'estimate';
  const cents = toCents(value);
  const amount = cents === null ? value : `${estimate ? '~' : ''}${formatCurrency(cents / 100, bill.currency)}`;
  // Past its day and paid by hand: nobody has said it went out (automatic payments are assumed paid).
  const overdue = payment.status === 'pending' && day < today && !isAutoPaid(bill.paymentMethod);
  const label = paid ? (payment.receiptId ? PAID_VIA_LABEL.receipt : (payment.paidVia && PAID_VIA_LABEL[payment.paidVia]) || 'Paid') : overdue ? 'Overdue' : paymentStatusLabel(payment.status);
  const tone: Tone = paid ? 'good' : payment.status === 'missed' || overdue ? 'bad' : 'neutral';

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={`${showDay(day)}, ${amount}, ${label}`}
      accessibilityHint={expanded ? 'Hides what can be done with this payment' : 'Shows what can be done with this payment'}
      aria-expanded={expanded}
      aria-busy={busy}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 56, backgroundColor: pressed ? colors.cardPressed : 'transparent' })}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="callout" weight="medium">{`${shortDay(day)}${day.slice(0, 4) !== today.slice(0, 4) ? ` ${day.slice(0, 4)}` : ''}`}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, alignItems: 'center' }}>
          <Pill label={label} tone={tone} />
          {filed && <FileText size={14} color={colors.textMuted} accessibilityLabel="A bill is filed for it" />}
        </View>
      </View>
      {busy ? <ActivityIndicator color={colors.textMuted} /> : (
        <Text
          variant="callout"
          weight="semibold"
          ink={estimate || payment.status === 'skipped' ? 'muted' : 'primary'}
          tabular
          style={payment.status === 'skipped' ? { textDecorationLine: 'line-through' } : undefined}
        >
          {amount}
        </Text>
      )}
    </Pressable>
  );
}

/** This payment's amount only: what's expected, or what was paid once it's paid. */
function AmountEditor({ payment, currency, onSave, onCancel }: { payment: WirePayment; currency: string; onSave: (amount: string) => void; onCancel: () => void }) {
  const { colors } = useTheme();
  const paid = payment.status === 'paid';
  const start = toCents(paid && payment.actualAmount ? payment.actualAmount : payment.expectedAmount);
  const [value, setValue] = useState(start === null ? '' : fromCents(start));
  const cents = toCents(value);
  const valid = cents !== null && cents >= 0;
  const save = () => {
    if (!valid) return;
    if (cents === start) onCancel();
    else onSave(fromCents(cents));
  };
  return (
    <View style={{ padding: space.lg, gap: space.sm }}>
      <Text variant="footnote" ink="muted">{`${paid ? 'Paid' : 'Expected'} on ${showDay(paymentDay(payment))}, this time only`}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <TextInput
          value={value}
          onChangeText={setValue}
          autoFocus
          keyboardType="decimal-pad"
          inputMode="decimal"
          returnKeyType="done"
          onSubmitEditing={save}
          selectTextOnFocus
          accessibilityLabel={`Amount, ${currency}`}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accent}
          style={{ flex: 1, backgroundColor: colors.field, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 11, fontFamily: FONT.medium, fontSize: 17, color: colors.text, fontVariant: ['tabular-nums'], borderWidth: valid || !value ? 0 : 1.5, borderColor: colors.bad }}
        />
        <Pressable onPress={onCancel} hitSlop={6} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm }}>
          <Text variant="body" ink="secondary">Cancel</Text>
        </Pressable>
        <Pressable
          onPress={save}
          disabled={!valid}
          accessibilityRole="button"
          accessibilityLabel="Save the amount"
          aria-disabled={!valid}
          style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, opacity: !valid ? 0.4 : pressed ? 0.75 : 1 })}
        >
          <Check size={20} color={colors.onAccent} strokeWidth={2.5} />
        </Pressable>
      </View>
    </View>
  );
}

function FiledBillRow({ filed, currency }: { filed: WireFiledBill; currency: string }) {
  const [opening, setOpening] = useState(false);
  const [failed, setFailed] = useState(false);
  const cents = toCents(filed.amountDue);
  const when = filed.periodStart && filed.periodEnd
    ? `For ${shortDay(filed.periodStart)} – ${shortDay(filed.periodEnd)}`
    : filed.issueDate ? `Issued ${showDay(filed.issueDate)}` : 'Bill';
  const open = async () => {
    setOpening(true);
    setFailed(false);
    try {
      await openPrivateFile(`/api/bills/documents/${filed.id}/file`, fileName(filed));
    } catch {
      setFailed(true);
    } finally {
      setOpening(false);
    }
  };
  return (
    <Row
      icon={FileText}
      label={filed.provider ?? filed.fileName ?? 'Bill'}
      detail={failed ? "Couldn't open it. Try again." : [when, filed.dueDate ? `due ${showDay(filed.dueDate)}` : null].filter(Boolean).join(' · ')}
      value={opening ? <ActivityIndicator /> : cents !== null ? formatCurrency(cents / 100, filed.currency ?? currency) : undefined}
      onPress={() => void open()}
      accessibilityHint="Opens the bill"
    />
  );
}


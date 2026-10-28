'use client';

import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAccounts } from '@/lib/hooks/use-plan';
import type { HouseholdWithMembers } from '@/lib/types/api-responses';
import { ESSENTIAL_COPY } from '@/shared/labels/plan';
import { categoryOptions } from './labels';

export type BillFieldValues = {
  kind: 'subscription' | 'bill';
  amountType: 'fixed' | 'variable';
  /** '' = not said */
  paymentMethod: '' | 'direct_debit' | 'standing_order' | 'card' | 'manual';
  /** The account it comes out of, for the plan's "left until payday"; null = the main account. */
  paidFromAccountId: string | null;
};

// Essential by default: most things added are bills, and one wrongly left a subscription drops
// out of the plan's "after bills".
export const DEFAULT_BILL_FIELDS: BillFieldValues = { kind: 'bill', amountType: 'fixed', paymentMethod: '', paidFromAccountId: null };

const MAIN_ACCOUNT = 'main';

/**
 * What the plan needs to know about a recurring payment: whether it's a bill, whether the amount
 * changes each time (then the amount is the usual one, and each month can be set), how it is
 * paid (direct debits, standing orders and card payments are assumed paid once collected;
 * anything you pay yourself shows as overdue if you don't), and which account it comes out of.
 */
export function BillFields({ value, onChange }: { value: BillFieldValues; onChange: (value: BillFieldValues) => void }) {
  const id = useId();
  const { data: accounts } = useAccounts();
  const liveAccounts = (accounts ?? []).filter((account) => !account.archivedAt);
  // An account that's gone from the list (archived, or someone else's) is kept, not cleared on save.
  const unknownAccount = value.paidFromAccountId && !liveAccounts.some((account) => account.id === value.paidFromAccountId);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-kind`} className="flex min-h-11 cursor-pointer items-center gap-2">
            <Switch
              id={`${id}-kind`}
              checked={value.kind === 'bill'}
              onCheckedChange={(essential) => onChange({ ...value, kind: essential ? 'bill' : 'subscription' })}
            />
            {ESSENTIAL_COPY.label}
          </Label>
          <p className="text-xs text-muted-foreground">{value.kind === 'bill' ? ESSENTIAL_COPY.on : ESSENTIAL_COPY.off}</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-method`}>How it&apos;s paid</Label>
          <Select
            value={value.paymentMethod || 'unset'}
            onValueChange={(method) => onChange({ ...value, paymentMethod: method === 'unset' ? '' : method as BillFieldValues['paymentMethod'] })}
          >
            <SelectTrigger id={`${id}-method`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">Not sure</SelectItem>
              <SelectItem value="direct_debit">Direct debit</SelectItem>
              <SelectItem value="standing_order">Standing order</SelectItem>
              <SelectItem value="card">On my card</SelectItem>
              <SelectItem value="manual">I pay it myself</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {(liveAccounts.length > 0 || unknownAccount) && (
        <div className="grid gap-2">
          <Label htmlFor={`${id}-account`}>Paid from</Label>
          <Select
            value={value.paidFromAccountId ?? MAIN_ACCOUNT}
            onValueChange={(accountId) => onChange({ ...value, paidFromAccountId: accountId === MAIN_ACCOUNT ? null : accountId })}
          >
            <SelectTrigger id={`${id}-account`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={MAIN_ACCOUNT}>Main account</SelectItem>
              {liveAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
              ))}
              {unknownAccount && <SelectItem value={value.paidFromAccountId!}>Another account</SelectItem>}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">The plan takes it off this account&apos;s balance in &ldquo;Left until payday&rdquo;.</p>
        </div>
      )}
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor={`${id}-amount-type`} className="text-base">The amount changes</Label>
          <p className="text-sm text-muted-foreground">Electricity, a credit card: enter the usual amount, and set each month&apos;s in the plan.</p>
        </div>
        <Switch
          id={`${id}-amount-type`}
          checked={value.amountType === 'variable'}
          onCheckedChange={(checked) => onChange({ ...value, amountType: checked ? 'variable' : 'fixed' })}
        />
      </div>
    </div>
  );
}

const PERSONAL = 'personal';

/**
 * Who sees it: just you, or a household (whose members can see it and mark it paid). Shared by
 * the add and edit dialogs. Edit had no way to share or unshare, and Add had no way back to
 * personal once a household was picked.
 */
export function HouseholdShareField({
  value,
  onChange,
  households,
}: {
  /** null = just you */
  value: string | null;
  onChange: (householdId: string | null) => void;
  households: HouseholdWithMembers[] | undefined;
}) {
  const id = useId();
  if (!households || households.length === 0) return null;
  // A household the user has since left still shows, so saving doesn't silently unshare it.
  const unknown = value && !households.some((household) => household.id === value);

  return (
    <div className="grid gap-2">
      <Label htmlFor={`${id}-household`}>Shared with</Label>
      <Select value={value ?? PERSONAL} onValueChange={(next) => onChange(next === PERSONAL ? null : next)}>
        <SelectTrigger id={`${id}-household`}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={PERSONAL}>Just me</SelectItem>
          {households.map((household) => (
            <SelectItem key={household.id} value={household.id}>{household.name}</SelectItem>
          ))}
          {unknown && <SelectItem value={value}>Another household</SelectItem>}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">Everyone in a household can see it and mark it paid.</p>
    </div>
  );
}

/** The one category list for bills and subscriptions, keeping a value that isn't in it. */
export function CategoryField({ value, onChange }: { value: string; onChange: (category: string) => void }) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <Label htmlFor={`${id}-category`}>Category</Label>
      {/* '' shows the placeholder (Radix Select's way to have nothing chosen). */}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={`${id}-category`}>
          <SelectValue placeholder="Choose a category (optional)" />
        </SelectTrigger>
        <SelectContent>
          {categoryOptions(value).map((group) => (
            <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.categories.map((category) => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

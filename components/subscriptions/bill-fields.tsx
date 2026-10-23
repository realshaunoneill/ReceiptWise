'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export type BillFieldValues = {
  kind: 'subscription' | 'bill';
  amountType: 'fixed' | 'variable';
  /** '' = not said */
  paymentMethod: '' | 'direct_debit' | 'standing_order' | 'card' | 'manual';
};

export const DEFAULT_BILL_FIELDS: BillFieldValues = { kind: 'subscription', amountType: 'fixed', paymentMethod: '' };

/**
 * What the plan needs to know about a recurring payment: whether it's a bill, whether the amount
 * changes each time (then the amount is the usual one, and each month can be set), and how it is
 * paid (direct debits and standing orders are assumed paid once collected; anything you pay
 * yourself shows as overdue if you don't).
 */
export function BillFields({ value, onChange }: { value: BillFieldValues; onChange: (value: BillFieldValues) => void }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Type</Label>
          <Select value={value.kind} onValueChange={(kind) => onChange({ ...value, kind: kind as BillFieldValues['kind'] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="subscription">Subscription</SelectItem>
              <SelectItem value="bill">Bill</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>How it&apos;s paid</Label>
          <Select
            value={value.paymentMethod || 'unset'}
            onValueChange={(method) => onChange({ ...value, paymentMethod: method === 'unset' ? '' : method as BillFieldValues['paymentMethod'] })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
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
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="amountType" className="text-base">The amount changes</Label>
          <p className="text-sm text-muted-foreground">Electricity, a credit card: enter the usual amount, and set each month&apos;s in the plan.</p>
        </div>
        <Switch
          id="amountType"
          checked={value.amountType === 'variable'}
          onCheckedChange={(checked) => onChange({ ...value, amountType: checked ? 'variable' : 'fixed' })}
        />
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useUpdateSubscription } from '@/hooks/use-subscriptions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { type Subscription } from '@/lib/db/schema';
import { fromUtcDate } from '@/lib/dates/local-date';
import { toCents } from '@/lib/money';
import { type BillingFrequency } from '@/lib/schedule/billing-schedule';
import { SUPPORTED_CURRENCIES } from '@/lib/utils/currency';
import { useFeature } from '@/lib/hooks/use-user';
import { BillFields, type BillFieldValues } from './bill-fields';

type EditSubscriptionDialogProps = {
  subscription: Subscription;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type FormData = {
  name: string;
  description: string;
  category: string;
  amount: string;
  currency: string;
  billingFrequency: BillingFrequency;
  billingDay: string;
  customFrequencyDays: string;
  startDate: string;
  website: string;
  notes: string;
  isBusinessExpense: boolean;
};

const categories = [
  'Streaming',
  'Software',
  'Utilities',
  'Insurance',
  'Fitness',
  'Food & Meal Kits',
  'News & Magazines',
  'Cloud Storage',
  'Music',
  'Gaming',
  'Education',
  'Healthcare',
  'Other',
];

function billFieldsOf(subscription: Subscription): BillFieldValues {
  return {
    kind: subscription.kind === 'bill' ? 'bill' : 'subscription',
    amountType: subscription.amountType === 'variable' ? 'variable' : 'fixed',
    paymentMethod: (subscription.paymentMethod ?? '') as BillFieldValues['paymentMethod'],
  };
}

function formValues(subscription: Subscription): FormData {
  return {
    name: subscription.name,
    description: subscription.description || '',
    category: subscription.category || '',
    amount: subscription.amount,
    currency: subscription.currency,
    billingFrequency: subscription.billingFrequency as BillingFrequency,
    billingDay: subscription.billingDay.toString(),
    customFrequencyDays: subscription.customFrequencyDays?.toString() || '',
    startDate: fromUtcDate(new Date(subscription.startDate)),
    website: subscription.website || '',
    notes: subscription.notes || '',
    isBusinessExpense: subscription.isBusinessExpense || false,
  };
}

export function EditSubscriptionDialog({
  subscription,
  open,
  onOpenChange,
}: EditSubscriptionDialogProps) {
  const { mutate: updateSubscription, isPending } = useUpdateSubscription(subscription.id);
  const billsEnabled = useFeature('bills');
  const [billFields, setBillFields] = useState<BillFieldValues>(billFieldsOf(subscription));

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: formValues(subscription),
  });

  const billingFrequency = watch('billingFrequency');
  const isBusinessExpense = watch('isBusinessExpense');

  // Reset form when subscription changes
  useEffect(() => {
    reset(formValues(subscription));
    setBillFields(billFieldsOf(subscription));
  }, [subscription, reset]);

  const onSubmit = (data: FormData) => {
    // Send only what changed. Sending every field made the server treat any edit, a rename
    // included, as a billing change and rebuild the payment history.
    const before = formValues(subscription);
    const changes: Parameters<typeof updateSubscription>[0] = {};
    if (data.name !== before.name) changes.name = data.name;
    if (data.description !== before.description) changes.description = data.description || null;
    if (data.category !== before.category) changes.category = data.category || null;
    if (toCents(data.amount) !== toCents(before.amount)) changes.amount = data.amount;
    if (data.currency !== before.currency) changes.currency = data.currency;
    if (data.billingFrequency !== before.billingFrequency) changes.billingFrequency = data.billingFrequency;
    if (data.billingDay !== before.billingDay) changes.billingDay = parseInt(data.billingDay);
    if (data.billingFrequency === 'custom' && data.customFrequencyDays !== before.customFrequencyDays) {
      changes.customFrequencyDays = parseInt(data.customFrequencyDays);
    }
    if (data.startDate !== before.startDate) changes.startDate = data.startDate;
    if (data.website !== before.website) changes.website = data.website || null;
    if (data.notes !== before.notes) changes.notes = data.notes || null;
    if (data.isBusinessExpense !== before.isBusinessExpense) changes.isBusinessExpense = data.isBusinessExpense;
    if (billsEnabled) {
      const beforeBill = billFieldsOf(subscription);
      if (billFields.kind !== beforeBill.kind) changes.kind = billFields.kind;
      if (billFields.amountType !== beforeBill.amountType) changes.amountType = billFields.amountType;
      if (billFields.paymentMethod !== beforeBill.paymentMethod) changes.paymentMethod = billFields.paymentMethod || null;
    }

    if (Object.keys(changes).length === 0) {
      onOpenChange(false);
      return;
    }

    updateSubscription(
      changes,
      {
        onSuccess: () => {
          toast.success(`${data.name} has been updated successfully`);
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error('Failed to update subscription', {
            description: error.message,
          });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Subscription</DialogTitle>
          <DialogDescription>
            Update the subscription details below
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Subscription Name *</Label>
              <Input
                id="name"
                placeholder="Netflix, Spotify, etc."
                {...register('name', { required: 'Name is required' })}
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional description"
                {...register('description')}
              />
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={watch('category')}
                onValueChange={(value) => setValue('category', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Financial Details */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="9.99"
                  {...register('amount', {
                    required: 'Amount is required',
                    min: { value: 0.01, message: 'Amount must be greater than 0' },
                  })}
                />
                {errors.amount && (
                  <p className="text-sm text-destructive mt-1">{errors.amount.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="currency">Currency *</Label>
                <Select
                  value={watch('currency')}
                  onValueChange={(value) => setValue('currency', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.code} ({currency.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="billingFrequency">Billing Frequency *</Label>
                <Select
                  value={watch('billingFrequency')}
                  onValueChange={(value) => setValue('billingFrequency', value as BillingFrequency)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="six_monthly">Every 6 months</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="billingDay">Billing Day *</Label>
                <Input
                  id="billingDay"
                  type="number"
                  min="1"
                  max="31"
                  placeholder="15"
                  {...register('billingDay', {
                    required: 'Billing day is required',
                    min: { value: 1, message: 'Day must be between 1-31' },
                    max: { value: 31, message: 'Day must be between 1-31' },
                  })}
                />
                {errors.billingDay && (
                  <p className="text-sm text-destructive mt-1">{errors.billingDay.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                {...register('startDate', { required: 'Start date is required' })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Changing the start date or schedule rebuilds the expected payments that are still open.
              </p>
              {errors.startDate && (
                <p className="text-sm text-destructive mt-1">{errors.startDate.message}</p>
              )}
            </div>

            {billingFrequency === 'custom' && (
              <div>
                <Label htmlFor="customFrequencyDays">Custom Frequency (Days) *</Label>
                <Input
                  id="customFrequencyDays"
                  type="number"
                  min="1"
                  placeholder="30"
                  {...register('customFrequencyDays', {
                    required: billingFrequency === 'custom' ? 'Custom frequency is required' : false,
                    min: { value: 1, message: 'Must be at least 1 day' },
                  })}
                />
                {errors.customFrequencyDays && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.customFrequencyDays.message}
                  </p>
                )}
              </div>
            )}
          </div>

          {billsEnabled && <BillFields value={billFields} onChange={setBillFields} />}

          {/* Additional Details */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://example.com"
                {...register('website')}
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes"
                {...register('notes')}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isBusinessExpense"
                checked={isBusinessExpense}
                onCheckedChange={(checked) => setValue('isBusinessExpense', checked)}
              />
              <Label htmlFor="isBusinessExpense" className="cursor-pointer">
                Business Expense
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Updating...' : 'Update Subscription'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

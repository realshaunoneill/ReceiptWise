'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, CreditCard, Calendar, Tag, Settings } from 'lucide-react';
import { useCreateSubscription } from '@/hooks/use-subscriptions';
import { useHouseholds } from '@/lib/hooks/use-households';
import type { HouseholdWithMembers } from '@/lib/types/api-responses';
import { useCurrency } from '@/lib/hooks/use-currency';
import { localToday } from '@/lib/dates/local-date';
import { type BillingFrequency } from '@/lib/schedule/billing-schedule';
import { SUPPORTED_CURRENCIES } from '@/lib/utils/currency';
import { useFeature } from '@/lib/hooks/use-user';
import { BillFields, type BillFieldValues, CategoryField, DEFAULT_BILL_FIELDS, HouseholdShareField } from './bill-fields';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Separator } from '@/components/ui/separator';

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
  householdId: string;
  isBusinessExpense: boolean;
  website: string;
  notes: string;
};

type CreateSubscriptionDialogProps = {
  /** The button's words; "Add bill or subscription" (or "Add subscription" without bills) when left out. */
  label?: string;
  /** The button's style, e.g. 'outline' beside other outline buttons; the primary style when left out. */
  variant?: React.ComponentProps<typeof Button>['variant'];
  className?: string;
};

export function CreateSubscriptionDialog({ label, variant, className }: CreateSubscriptionDialogProps = {}) {
  const [open, setOpen] = useState(false);
  const { data: households } = useHouseholds();
  const { mutate: createSubscription, isPending } = useCreateSubscription();
  const { currency: userCurrency } = useCurrency();
  const billsEnabled = useFeature('bills');
  const [billFields, setBillFields] = useState<BillFieldValues>(DEFAULT_BILL_FIELDS);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      currency: userCurrency,
      billingFrequency: 'monthly',
      billingDay: '1',
      // The local day, not toISOString's UTC one, which is yesterday or tomorrow near midnight.
      startDate: localToday(),
      isBusinessExpense: false,
    },
  });

  const billingFrequency = watch('billingFrequency');
  const currency = watch('currency');
  // With bills on, the dialog adds either kind, so its wording doesn't say "subscription".
  const noun = billsEnabled ? (billFields.kind === 'bill' ? 'bill' : 'subscription') : 'subscription';

  // The user's currency loads after the form mounts; default to it until they pick another.
  useEffect(() => {
    if (open) setValue('currency', userCurrency);
  }, [open, userCurrency, setValue]);

  const onSubmit = (data: FormData) => {
    const amount = parseFloat(data.amount);
    const billingDay = parseInt(data.billingDay);
    const customFrequencyDays = data.customFrequencyDays
      ? parseInt(data.customFrequencyDays)
      : undefined;

    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount greater than 0');
      return;
    }

    if (billingDay < 1 || billingDay > 31) {
      toast.error('Pick a day of the month from 1 to 31');
      return;
    }

    if (
      data.billingFrequency === 'custom' &&
      (!customFrequencyDays || customFrequencyDays < 1)
    ) {
      toast.error('Please enter a valid number of days');
      return;
    }

    createSubscription(
      {
        name: data.name,
        description: data.description || undefined,
        category: data.category || undefined,
        amount,
        currency: data.currency,
        billingFrequency: data.billingFrequency,
        billingDay,
        customFrequencyDays,
        startDate: data.startDate,
        householdId: data.householdId || null,
        isBusinessExpense: data.isBusinessExpense,
        website: data.website || undefined,
        notes: data.notes || undefined,
        ...(billsEnabled ? {
          kind: billFields.kind,
          amountType: billFields.amountType,
          paymentMethod: billFields.paymentMethod || null,
          paidFromAccountId: billFields.paidFromAccountId,
        } : {}),
      },
      {
        onSuccess: () => {
          toast.success(billsEnabled ? `Added ${data.name}` : `${data.name} has been added to your subscriptions`);
          setOpen(false);
          reset();
          setBillFields(DEFAULT_BILL_FIELDS);
        },
        onError: (error) => {
          toast.error(`Failed to add the ${noun}`, { description: error.message });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} className={className}>
          <Plus className="w-4 h-4 mr-2" />
          {label ?? (billsEnabled ? 'Add bill or subscription' : 'Add subscription')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{billsEnabled ? 'Add a bill or subscription' : 'Add a subscription'}</DialogTitle>
          <DialogDescription>
            Anything that comes round again: rent, electricity, your phone, Netflix.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Step 1: Basic Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Tag className="w-4 h-4" />
              <span>Basic information</span>
            </div>
            <Separator />

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-base">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder={billsEnabled ? 'e.g. Rent, Electricity, Netflix' : 'e.g. Netflix, Spotify, Adobe Creative Cloud'}
                  className="text-base"
                  {...register('name', { required: true })}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">Name is required</p>
                )}
              </div>

              <CategoryField value={watch('category') ?? ''} onChange={(value) => setValue('category', value)} />
            </div>
          </div>

          {/* Step 2: Pricing */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <CreditCard className="w-4 h-4" />
              <span>How much, how often</span>
            </div>
            <Separator />

            <div className="grid gap-4">
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="amount" className="text-base">
                    Amount <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="9.99"
                    className="text-lg font-semibold"
                    {...register('amount', { required: true })}
                  />
                  {errors.amount && (
                    <p className="text-sm text-destructive">Amount is required</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    onValueChange={(value) => setValue('currency', value)}
                    value={currency}
                  >
                    <SelectTrigger id="currency" className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_CURRENCIES.map((option) => (
                        <SelectItem key={option.code} value={option.code}>
                          {option.symbol} {option.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="billingFrequency" className="text-base">
                  How often are you charged? <span className="text-destructive">*</span>
                </Label>
                <Select
                  onValueChange={(value) =>
                    setValue('billingFrequency', value as FormData['billingFrequency'])
                  }
                  value={billingFrequency}
                >
                  <SelectTrigger id="billingFrequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="bimonthly">Every 2 months</SelectItem>
                    <SelectItem value="quarterly">Every 3 months</SelectItem>
                    <SelectItem value="six_monthly">Every 6 months</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="custom">Every so many days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {billingFrequency === 'custom' && (
                <div className="grid gap-2">
                  <Label htmlFor="customFrequencyDays" className="text-base">
                    Every how many days? <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="customFrequencyDays"
                    type="number"
                    min="1"
                    placeholder="e.g., 30 for every 30 days"
                    {...register('customFrequencyDays')}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Billing Schedule */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Calendar className="w-4 h-4" />
              <span>When it&apos;s due</span>
            </div>
            <Separator />

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="billingDay" className="text-base">
                  What day of the month? <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="billingDay"
                  type="number"
                  min="1"
                  max="31"
                  placeholder="e.g., 1 for the 1st of each month"
                  {...register('billingDay', { required: true })}
                />
                <p className="text-xs text-muted-foreground">
                  A day from 1 to 31
                </p>
                {errors.billingDay && (
                  <p className="text-sm text-destructive">
                    Pick a day from 1 to 31
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="startDate" className="text-base">
                  {billsEnabled ? 'Starting from' : 'When did you start?'} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  {...register('startDate', { required: true })}
                />
                {errors.startDate && (
                  <p className="text-sm text-destructive">Start date is required</p>
                )}
              </div>
            </div>
          </div>

          {/* Keyed to the dialog opening, so a fresh form follows Essential again. */}
          {billsEnabled && <BillFields key={String(open)} value={billFields} onChange={setBillFields} followKind />}

          {/* Step 4: Additional Details (Collapsible/Optional) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Settings className="w-4 h-4" />
              <span>More details (optional)</span>
            </div>
            <Separator />

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="e.g., Premium plan, Family account"
                  {...register('description')}
                />
              </div>

              <HouseholdShareField
                value={watch('householdId') || null}
                onChange={(householdId) => setValue('householdId', householdId ?? '')}
                households={households as HouseholdWithMembers[] | undefined}
              />

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="isBusinessExpense" className="text-base">Business expense</Label>
                  <p className="text-sm text-muted-foreground">
                    Tax-deductible business expense
                  </p>
                </div>
                <Switch
                  id="isBusinessExpense"
                  checked={watch('isBusinessExpense')}
                  onCheckedChange={(checked) =>
                    setValue('isBusinessExpense', checked)
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  placeholder="https://example.com"
                  {...register('website')}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional information..."
                  rows={2}
                  {...register('notes')}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Adding…' : `Add ${noun}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

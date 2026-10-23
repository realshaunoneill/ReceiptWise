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
import { BillFields, type BillFieldValues, DEFAULT_BILL_FIELDS } from './bill-fields';
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

const categories = [
  'Streaming',
  'Software',
  'Utilities',
  'Insurance',
  'Cloud Services',
  'Music',
  'Gaming',
  'News',
  'Education',
  'Fitness',
  'Storage',
  'Other',
];

export function CreateSubscriptionDialog() {
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
      toast.error('Billing day must be between 1 and 31');
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
        householdId: data.householdId || undefined,
        isBusinessExpense: data.isBusinessExpense,
        website: data.website || undefined,
        notes: data.notes || undefined,
        ...(billsEnabled ? {
          kind: billFields.kind,
          amountType: billFields.amountType,
          paymentMethod: billFields.paymentMethod || null,
        } : {}),
      },
      {
        onSuccess: () => {
          toast.success(`${data.name} has been added to your subscriptions`);
          setOpen(false);
          reset();
          setBillFields(DEFAULT_BILL_FIELDS);
        },
        onError: (error) => {
          toast.error('Failed to create subscription', { description: error.message });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Subscription
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Subscription</DialogTitle>
          <DialogDescription>
            Track your recurring expenses in just a few simple steps
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Step 1: Basic Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Tag className="w-4 h-4" />
              <span>Basic Information</span>
            </div>
            <Separator />

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-base">
                  Subscription Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="e.g., Netflix, Spotify, Adobe Creative Cloud"
                  className="text-base"
                  {...register('name', { required: true })}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">Name is required</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  onValueChange={(value) => setValue('category', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a category (optional)" />
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
          </div>

          {/* Step 2: Pricing */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <CreditCard className="w-4 h-4" />
              <span>Pricing Details</span>
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
                    <SelectTrigger className="w-[100px]">
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
                  defaultValue="monthly"
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="bimonthly">Every 2 months</SelectItem>
                    <SelectItem value="quarterly">Every 3 months (Quarterly)</SelectItem>
                    <SelectItem value="six_monthly">Every 6 months</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="custom">Custom frequency</SelectItem>
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
              <span>Billing Schedule</span>
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
                  Enter a number between 1-31
                </p>
                {errors.billingDay && (
                  <p className="text-sm text-destructive">
                    Billing day is required (1-31)
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="startDate" className="text-base">
                  When did you start? <span className="text-destructive">*</span>
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

          {billsEnabled && <BillFields value={billFields} onChange={setBillFields} />}

          {/* Step 4: Additional Details (Collapsible/Optional) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Settings className="w-4 h-4" />
              <span>Additional Details (Optional)</span>
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

              {households && households.length > 0 && (
                <div className="grid gap-2">
                  <Label htmlFor="householdId">Household</Label>
                  <Select
                    onValueChange={(value) => setValue('householdId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Personal subscription" />
                    </SelectTrigger>
                    <SelectContent>
                      {households.map((household: HouseholdWithMembers) => (
                        <SelectItem key={household.id} value={household.id}>
                          {household.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="isBusinessExpense" className="text-base">Business Expense</Label>
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
              {isPending ? 'Creating...' : 'Create Subscription'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

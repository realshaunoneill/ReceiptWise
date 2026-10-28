'use client';

// Coins, not DollarSign: this product prices and defaults to euro.
import { AlertCircle, Calendar, Coins, CircleDashed } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/lib/hooks/use-currency';
import { type CurrencyTotal, formatTotals } from '@/lib/utils/currency-totals';

type SubscriptionStatsProps = {
  /** One total per currency: amounts in different currencies are never added together. */
  monthlyTotals: CurrencyTotal[];
  yearlyTotals: CurrencyTotal[];
  /** Overdue payments: past their date and not marked paid (direct debits, standing orders and card payments never count). */
  missingPayments: number;
  onMissingPaymentsClick?: () => void;
};

type StatCardProps = {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  alert?: boolean;
  onClick?: () => void;
};

/*
 * The four tiles each took an `iconColor` — blue, green, purple, orange — for
 * four figures about one subscription list. The only tile whose colour carried
 * information was the last one, where amber means "some payments are past their
 * date and not marked paid", and that is now driven by `alert` rather than by a
 * hardcoded hue passed in alongside it. It was labelled "Missing receipts", but a
 * payment doesn't need a receipt: it counts until it is marked paid.
 */
function StatCard({ label, value, icon, alert, onClick }: StatCardProps) {
  const CardWrapper = onClick ? 'button' : 'div';

  return (
    <Card className={cn(
      'transition-colors',
      alert && 'border-warning/50',
      onClick && 'cursor-pointer hover:border-primary',
    )}>
      <CardContent className="p-4 sm:p-6">
        <CardWrapper
          onClick={onClick}
          className={cn(
            'w-full text-left',
            onClick && 'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg',
          )}
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <div className="flex items-baseline gap-2">
                <p className="amount text-2xl font-semibold tracking-tight sm:text-3xl">{value}</p>
                {alert && <AlertCircle className="h-5 w-5 text-warning" aria-hidden="true" />}
              </div>
            </div>
            <div className={cn(
              'hidden rounded-xl bg-muted p-3 sm:block',
              alert ? 'text-warning' : 'text-muted-foreground',
            )}>
              {icon}
            </div>
          </div>
        </CardWrapper>
      </CardContent>
    </Card>
  );
}

export function SubscriptionStats({
  monthlyTotals,
  yearlyTotals,
  missingPayments,
  onMissingPaymentsClick,
}: SubscriptionStatsProps) {
  const { currency } = useCurrency();

  // What they come to, side by side, and the overdue ones only when there are some. A count of
  // the active ones was a fourth tile, saying what the list below already shows.
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:gap-4', missingPayments > 0 && 'lg:grid-cols-3')}>
      <StatCard
        label="Monthly cost"
        value={formatTotals(monthlyTotals, currency)}
        icon={<Calendar className="h-5 w-5" />}
      />

      <StatCard
        label="Yearly cost"
        value={formatTotals(yearlyTotals, currency)}
        icon={<Coins className="h-5 w-5" />}
      />

      {missingPayments > 0 && (
        <StatCard
          label="Overdue"
          value={missingPayments}
          icon={<CircleDashed className="h-5 w-5" />}
          alert
          onClick={onMissingPaymentsClick}
        />
      )}
    </div>
  );
}

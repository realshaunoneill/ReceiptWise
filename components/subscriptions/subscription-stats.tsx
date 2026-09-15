'use client';

// Coins, not DollarSign: this product prices and defaults to euro.
import { AlertCircle, TrendingUp, Calendar, Coins, Receipt } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/lib/hooks/use-currency';

type SubscriptionStatsProps = {
  activeCount: number;
  monthlyTotal: number;
  yearlyTotal: number;
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
 * information was the last one, where amber means "some payments have no receipt
 * attached", and that is now driven by `alert` rather than by a hardcoded hue
 * passed in alongside it.
 */
function StatCard({ label, value, icon, alert, onClick }: StatCardProps) {
  const CardWrapper = onClick ? 'button' : 'div';

  return (
    <Card className={cn(
      'transition-colors',
      alert && 'border-warning/50',
      onClick && 'cursor-pointer hover:border-primary',
    )}>
      <CardContent className="p-6">
        <CardWrapper
          onClick={onClick}
          className={cn(
            'w-full text-left',
            onClick && 'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg',
          )}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <div className="flex items-baseline gap-2">
                <p className="amount text-3xl font-semibold tracking-tight">{value}</p>
                {alert && <AlertCircle className="h-5 w-5 text-warning" aria-hidden="true" />}
              </div>
            </div>
            <div className={cn(
              'rounded-xl bg-muted p-3',
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
  activeCount,
  monthlyTotal,
  yearlyTotal,
  missingPayments,
  onMissingPaymentsClick,
}: SubscriptionStatsProps) {
  const { format: formatCurrency } = useCurrency();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Active Subscriptions"
        value={activeCount}
        icon={<TrendingUp className="h-5 w-5" />}
      />

      <StatCard
        label="Monthly Cost"
        value={formatCurrency(monthlyTotal)}
        icon={<Calendar className="h-5 w-5" />}
      />

      <StatCard
        label="Yearly Cost"
        value={formatCurrency(yearlyTotal)}
        icon={<Coins className="h-5 w-5" />}
      />

      <StatCard
        label="Missing Receipts"
        value={missingPayments}
        icon={<Receipt className="h-5 w-5" />}
        alert={missingPayments > 0}
        onClick={missingPayments > 0 ? onMissingPaymentsClick : undefined}
      />
    </div>
  );
}

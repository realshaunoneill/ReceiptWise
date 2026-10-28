'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useSpendingTrends } from '@/lib/hooks/use-spending-trends';
import { useCurrency } from '@/lib/hooks/use-currency';

interface SpendingChartProps {
  period: 'week' | 'month' | 'year'
  householdId?: string
  personalOnly?: boolean
}

// Custom tooltip component that properly uses theme colors
interface TooltipPayload {
  value?: number;
  dataKey?: string;
  name?: string;
  color?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  formatCurrency?: (amount: number) => string;
}

function CustomTooltip({ active, payload, label, formatCurrency }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-popover p-3 shadow-lg">
        <p className="mb-1 font-semibold text-foreground">{label}</p>
        <p className="text-sm text-foreground">
          <span className="font-medium">Amount:</span> {formatCurrency ? formatCurrency(payload[0].value || 0) : payload[0].value?.toFixed(2)}
        </p>
      </div>
    );
  }
  return null;
}

export function SpendingChart({ period, householdId, personalOnly = false }: SpendingChartProps) {
  const { data: trendsData, isLoading, error } = useSpendingTrends(householdId, period, personalOnly);
  const { format: formatCurrency } = useCurrency();
  const [colors, setColors] = useState({
    primary: '#10b981',
    border: '#e5e7eb',
    muted: '#f3f4f6',
    mutedForeground: '#6b7280',
  });

  useEffect(() => {
    // Get computed CSS variables after component mounts
    const root = document.documentElement;
    const styles = getComputedStyle(root);

    setColors({
      primary: styles.getPropertyValue('--color-primary').trim() || '#10b981',
      border: styles.getPropertyValue('--color-border').trim() || '#e5e7eb',
      muted: styles.getPropertyValue('--color-muted').trim() || '#f3f4f6',
      mutedForeground: styles.getPropertyValue('--color-muted-foreground').trim() || '#6b7280',
    });
  }, []);

  const periodLabels = {
    week: 'past 7 days',
    month: 'this month',
    year: 'this year',
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>Spending trends</CardTitle>
          <CardDescription>Your spending patterns over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="mt-4 text-sm text-muted-foreground">Loading trends...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>Spending trends</CardTitle>
          <CardDescription>Your spending patterns over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-destructive">Failed to load spending trends</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Nothing in the period: no chart of empty bars. The summary beside it says so, and when the
  // last receipt was; this card used to say "No spending data. Upload some receipts" as well.
  if (!trendsData || trendsData.totalSpent === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>Spending trends</CardTitle>
        <CardDescription>Your spending patterns for {periodLabels[period]}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={trendsData.chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={colors.border}
              opacity={0.5}
            />
            <XAxis
              dataKey="name"
              tick={{ fill: colors.mutedForeground, fontSize: 12 }}
              stroke={colors.border}
              tickLine={{ stroke: colors.border }}
            />
            <YAxis
              tick={{ fill: colors.mutedForeground, fontSize: 12 }}
              stroke={colors.border}
              tickLine={{ stroke: colors.border }}
            />
            <Tooltip content={<CustomTooltip formatCurrency={formatCurrency} />} cursor={false} />
            <Bar
              dataKey="amount"
              fill={colors.primary}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

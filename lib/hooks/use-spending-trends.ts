import { useMemo } from 'react';
import { useReceiptStats } from './use-dashboard-stats';

interface SpendingTrendsData {
  chartData: Array<{
    name: string
    amount: number
    date: string
  }>
  totalSpent: number
  change: number
  spendingByCategory: Array<{
    category: string
    amount: number
    percentage: number
  }>
}

/** Start of the current period and of the one before it, which "change" compares against. */
function periodBounds(period: 'week' | 'month' | 'year', now: Date) {
  let startDate: Date;
  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case 'month':
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const previousPeriodStart = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
  return { startDate, previousPeriodStart };
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function useSpendingTrends(householdId?: string, period: 'week' | 'month' | 'year' = 'month', personalOnly: boolean = false) {
  // Per-receipt points from the server, back to the start of the previous period. This used to
  // ask /api/receipts for 1000 receipts and silently get 100 (the route's page cap), and it
  // counted pending, failed and not-a-receipt uploads.
  const from = useMemo(() => toIsoDate(periodBounds(period, new Date()).previousPeriodStart), [period]);
  const { data: stats, isLoading, error } = useReceiptStats(householdId, personalOnly, from);

  const trendsData = useMemo((): SpendingTrendsData | undefined => {
      if (!stats) return undefined;
      const receipts = (stats.points ?? []).map((p) => ({
        transactionDate: p.date,
        createdAt: p.date,
        totalAmount: String(p.amount),
        category: p.category,
      }));
      if (receipts.length === 0) {
        return {
          chartData: [],
          totalSpent: 0,
          change: 0,
          spendingByCategory: [],
        };
      }

      const now = new Date();
      let startDate: Date;
      let groupBy: 'day' | 'week' | 'month';
      let dateFormat: (date: Date) => string;

      // Determine date range and grouping based on period
      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          groupBy = 'day';
          dateFormat = (date) => date.toLocaleDateString('en-US', { weekday: 'short' });
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          groupBy = 'week';
          dateFormat = (date) => `Week ${Math.ceil(date.getDate() / 7)}`;
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          groupBy = 'month';
          dateFormat = (date) => date.toLocaleDateString('en-US', { month: 'short' });
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          groupBy = 'week';
          dateFormat = (date) => `Week ${Math.ceil(date.getDate() / 7)}`;
      }

      // Filter receipts within the period
      const periodReceipts = receipts.filter((receipt) => {
        const receiptDate = new Date(receipt.transactionDate || receipt.createdAt);
        return receiptDate >= startDate && receiptDate <= now;
      });

      // Group receipts by time period
      const groupedData: Record<string, { amount: number; date: Date }> = {};

      periodReceipts.forEach((receipt) => {
        const receiptDate = new Date(receipt.transactionDate || receipt.createdAt);
        let groupKey: string;

        switch (groupBy) {
          case 'day':
            groupKey = receiptDate.toDateString();
            break;
          case 'week':
            const weekStart = new Date(receiptDate);
            weekStart.setDate(receiptDate.getDate() - receiptDate.getDay());
            groupKey = weekStart.toDateString();
            break;
          case 'month':
            groupKey = `${receiptDate.getFullYear()}-${receiptDate.getMonth()}`;
            break;
          default:
            groupKey = receiptDate.toDateString();
        }

        if (!groupedData[groupKey]) {
          groupedData[groupKey] = { amount: 0, date: receiptDate };
        }
        groupedData[groupKey].amount += parseFloat(receipt.totalAmount || '0');
      });

      // Convert to chart data format
      const chartData = Object.entries(groupedData)
        .map(([key, data]) => ({
          name: dateFormat(data.date),
          amount: data.amount,
          date: key,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Fill in missing periods with zero values
      const filledChartData = [];
      const currentDate = new Date(startDate);

      while (currentDate <= now) {
        const key = groupBy === 'day'
          ? currentDate.toDateString()
          : groupBy === 'week'
            ? (() => {
                const weekStart = new Date(currentDate);
                weekStart.setDate(currentDate.getDate() - currentDate.getDay());
                return weekStart.toDateString();
              })()
            : `${currentDate.getFullYear()}-${currentDate.getMonth()}`;

        const existingData = chartData.find(d => d.date === key);
        filledChartData.push({
          name: dateFormat(currentDate),
          amount: existingData?.amount || 0,
          date: key,
        });

        // Increment date based on grouping
        switch (groupBy) {
          case 'day':
            currentDate.setDate(currentDate.getDate() + 1);
            break;
          case 'week':
            currentDate.setDate(currentDate.getDate() + 7);
            break;
          case 'month':
            currentDate.setMonth(currentDate.getMonth() + 1);
            break;
        }
      }

      // Calculate total spent in current period
      const totalSpent = periodReceipts.reduce((sum: number, receipt) => {
        return sum + (parseFloat(receipt.totalAmount || '0'));
      }, 0);

      // Calculate change from previous period (simplified - just compare with previous period's total)
      const previousPeriodStart = new Date(startDate);
      const periodLength = now.getTime() - startDate.getTime();
      previousPeriodStart.setTime(startDate.getTime() - periodLength);

      const previousPeriodReceipts = receipts.filter((receipt) => {
        const receiptDate = new Date(receipt.transactionDate || receipt.createdAt);
        return receiptDate >= previousPeriodStart && receiptDate < startDate;
      });

      const previousTotal = previousPeriodReceipts.reduce((sum: number, receipt) => {
        return sum + (parseFloat(receipt.totalAmount || '0'));
      }, 0);

      const change = previousTotal > 0
        ? ((totalSpent - previousTotal) / previousTotal) * 100
        : 0;

      // Calculate spending by category for current period
      const categoryTotals: Record<string, number> = {};
      periodReceipts.forEach((receipt) => {
        const category = receipt.category || 'Other';
        categoryTotals[category] = (categoryTotals[category] || 0) + (parseFloat(receipt.totalAmount || '0'));
      });

      const spendingByCategory = Object.entries(categoryTotals)
        .map(([category, amount]) => ({
          category,
          amount,
          percentage: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      return {
        chartData: filledChartData,
        totalSpent,
        change: Math.round(change * 100) / 100, // Round to 2 decimal places
        spendingByCategory,
      };
  }, [stats, period]);

  return {
    data: trendsData,
    isLoading,
    error,
  };
}

import { useQuery } from '@tanstack/react-query';
import { DEFAULT_CURRENCY } from '@/lib/utils/currency';

interface TopItem {
  name: string;
  count: number;
  totalSpent: number;
  totalQuantity: number;
  averagePrice: number;
  merchants: string[];
  currency?: string;
  lastPurchased?: string;
  category?: string | null;
  merchantCount?: number;
  merchantBreakdown?: MerchantTotals[];
}

interface MerchantTotals {
  merchant: string;
  count: number;
  total: number;
}

export interface RecentPurchase {
  date: string;
  merchant: string;
  quantity: string;
  price: string;
  receiptId: string;
  imageUrl?: string;
  currency?: string;
  itemCount?: number;
  items?: Array<{
    name: string;
    quantity: string;
    price: string;
  }>;
}

export interface ItemAnalysis {
  itemName: string;
  searchPeriod: {
    startDate: string;
    endDate: string;
    months: number;
  };
  summary: {
    totalPurchases: number;
    totalSpent: number;
    totalQuantity: number;
    averagePrice: number;
    averageQuantity: number;
    currency: string;
  };
  topMerchants: Array<{
    merchant: string;
    count: number;
    total: number;
    average: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    count: number;
    total: number;
    average: number;
  }>;
  recentPurchases: RecentPurchase[];
  itemVariants?: Array<{
    name: string;
    count: number;
    totalSpent: number;
    averagePrice: number;
    merchants: string[];
  }>;
}

interface UseItemAnalysisOptions {
  itemName: string;
  householdId?: string;
  months?: number;
  enabled?: boolean;
  userCurrency?: string;
}

/**
 * Purchases and spend per merchant across every matched item variant, most purchases first.
 *
 * Was the merchant names alone with `count: 0, total: 0`, so every row of "Top merchants" read
 * "0 purchases · EUR 0.00".
 */
export function topMerchantsFor(items: Pick<TopItem, 'merchantBreakdown'>[]): ItemAnalysis['topMerchants'] {
  const byMerchant = new Map<string, { count: number; total: number }>();
  for (const item of items) {
    for (const { merchant, count, total } of item.merchantBreakdown ?? []) {
      const entry = byMerchant.get(merchant) ?? { count: 0, total: 0 };
      entry.count += count;
      entry.total += total;
      byMerchant.set(merchant, entry);
    }
  }
  return Array.from(byMerchant, ([merchant, { count, total }]) => ({
    merchant,
    count,
    total: parseFloat(total.toFixed(2)),
    average: count > 0 ? parseFloat((total / count).toFixed(2)) : 0,
  })).sort((a, b) => b.count - a.count || b.total - a.total);
}

async function analyzeItem(
  itemName: string,
  options?: {
    householdId?: string;
    months?: number;
    userCurrency?: string;
  },
): Promise<ItemAnalysis> {
      // Fetch top items and purchase history in parallel
      const topItemsParams = new URLSearchParams({
        limit: '200',
        sortBy: 'frequency',
        ...(options?.householdId && { householdId: options.householdId }),
        ...(options?.months && { months: options.months.toString() }),
      });

      const historyParams = new URLSearchParams({
        itemName,
        limit: '10',
        ...(options?.householdId && { householdId: options.householdId }),
        ...(options?.months && { months: options.months.toString() }),
      });

      const [topItemsResponse, historyResponse] = await Promise.all([
        fetch(`/api/receipts/items/top?${topItemsParams}`),
        fetch(`/api/receipts/items/history?${historyParams}`),
      ]);

      if (!topItemsResponse.ok) {
        const errorText = await topItemsResponse.text().catch(() => 'Unknown error');
        console.error('[ItemAnalysis] Top items API error:', topItemsResponse.status, errorText);
        throw new Error(`Failed to analyze item (${topItemsResponse.status})`);
      }

      const data = await topItemsResponse.json();

      // Parse purchase history (optional - don't fail if it errors)
      let purchaseHistory: RecentPurchase[] = [];
      if (historyResponse.ok) {
        try {
          const historyData = await historyResponse.json();
          purchaseHistory = (historyData.purchases || []).map((p: {
            receiptId: string;
            merchant: string;
            date: string;
            imageUrl?: string;
            currency?: string;
            quantity: string;
            price: string;
            itemCount?: number;
            items?: Array<{ name: string; quantity: string; price: string }>;
          }) => ({
            receiptId: p.receiptId,
            merchant: p.merchant,
            date: p.date,
            imageUrl: p.imageUrl,
            currency: p.currency,
            quantity: p.quantity,
            price: p.price,
            itemCount: p.itemCount,
            items: p.items,
          }));
        } catch (e) {
          console.error('[ItemAnalysis] Failed to parse purchase history:', e);
        }
      }

      // Validate response structure
      if (!data || !Array.isArray(data.topItems)) {
        console.error('[ItemAnalysis] Invalid API response structure:', data);
        throw new Error('Invalid response from server');
      }

      if (data.topItems.length === 0) {
        throw new Error('No purchase data found for analysis');
      }

      // Find all related items (case-insensitive, partial match)
      const normalizedSearchName = itemName.toLowerCase().trim();

      // Try exact match first
      let matchedItems = data.topItems.filter((item: TopItem) => {
        return item.name.toLowerCase().trim() === normalizedSearchName;
      });

      // If no exact match, try partial matching with all words
      if (matchedItems.length === 0) {
        const searchTerms = normalizedSearchName.split(/\s+/).filter(w => w.length > 0);

        matchedItems = data.topItems.filter((item: TopItem) => {
          const itemNameLower = item.name.toLowerCase().trim();
          // Match if item contains all search words or search term contains the item name
          return searchTerms.every(term => itemNameLower.includes(term)) ||
                 itemNameLower.includes(normalizedSearchName) ||
                 normalizedSearchName.includes(itemNameLower);
        });
      }

      if (matchedItems.length === 0) {
        throw new Error(`No data found for "${itemName}"`);
      }

      // Aggregate all matched items
      let totalPurchases = 0;
      let totalSpent = 0;
      let totalQuantity = 0;
      const itemVariants: Array<{
        name: string;
        count: number;
        totalSpent: number;
        averagePrice: number;
        merchants: string[];
      }> = [];

      matchedItems.forEach((item: TopItem) => {
        totalPurchases += item.count;
        totalSpent += item.totalSpent;
        totalQuantity += item.totalQuantity;

        itemVariants.push({
          name: item.name,
          count: item.count,
          totalSpent: item.totalSpent,
          averagePrice: item.averagePrice,
          merchants: item.merchants || [],
        });
      });

      // Sort variants by frequency
      itemVariants.sort((a, b) => b.count - a.count);

      const averagePrice = totalSpent / totalPurchases;
      const currency = matchedItems[0]?.currency || options?.userCurrency || DEFAULT_CURRENCY;
      const lastPurchased = matchedItems[0]?.lastPurchased || new Date().toISOString().split('T')[0];
      const firstMerchant = matchedItems[0]?.merchants?.[0] || 'Unknown';

      // Transform the data to match the expected ItemAnalysis format
      const transformedData: ItemAnalysis = {
        itemName: matchedItems.length > 1
          ? `${itemName} (${matchedItems.length} variants)`
          : matchedItems[0].name,
        searchPeriod: data.summary.period,
        summary: {
          totalPurchases,
          totalSpent: parseFloat(totalSpent.toFixed(2)),
          totalQuantity: parseFloat(totalQuantity.toFixed(2)),
          averagePrice: parseFloat(averagePrice.toFixed(2)),
          averageQuantity: totalQuantity / totalPurchases,
          currency,
        },
        topMerchants: topMerchantsFor(matchedItems),
        monthlyTrend: [],
        // Use actual purchase history if available, otherwise use synthetic data
        recentPurchases: purchaseHistory.length > 0
          ? purchaseHistory
          : [{
              date: lastPurchased,
              merchant: firstMerchant,
              quantity: totalQuantity.toString(),
              price: totalSpent.toString(),
              receiptId: '',
            }],
        itemVariants,
      };

      return transformedData;
}

export function useItemAnalysis(options: UseItemAnalysisOptions) {
  const { itemName, enabled = true, userCurrency, ...fetchOptions } = options;

  return useQuery({
    queryKey: ['itemAnalysis', itemName, fetchOptions],
    queryFn: () => analyzeItem(itemName, { ...fetchOptions, userCurrency }),
    enabled: enabled && !!itemName,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

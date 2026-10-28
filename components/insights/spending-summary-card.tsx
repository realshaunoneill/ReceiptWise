'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSpendingSummary } from '@/hooks/use-spending-summary';
import { Loader2, FileText, RefreshCw, TrendingUp, ShoppingBag, Store } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils/currency';
import { categoryName } from '@/components/receipts/format';
import { parseSummary, type Inline } from '@/components/insights/summary-markdown';

interface SpendingSummaryCardProps {
  householdId?: string;
  /** The Overview's period (its one picker), in months. */
  months: number;
}

function InlineText({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((part, index) =>
        part.bold ? (
          <strong key={index} className="font-semibold text-foreground">{part.text}</strong>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** The model's Markdown as headings, paragraphs and lists. Never as HTML. */
function SummaryText({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
      {parseSummary(markdown).map((block, index) => {
        if (block.type === 'heading') {
          return (
            <h3 key={index} className="pt-1 text-sm font-semibold text-foreground">
              <InlineText parts={block.content} />
            </h3>
          );
        }
        if (block.type === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';
          return (
            <ListTag key={index} className={`ml-5 space-y-1 ${block.ordered ? 'list-decimal' : 'list-disc'}`}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}><InlineText parts={item} /></li>
              ))}
            </ListTag>
          );
        }
        return (
          <p key={index}><InlineText parts={block.content} /></p>
        );
      })}
    </div>
  );
}

/*
 * The written summary is one OpenAI call per period, so it is only written when asked for.
 *
 * The card used to load on every visit to Insights (`autoLoad`), and then never showed the text
 * it had paid for: `summary.summary` was not rendered anywhere, only the totals around it. The
 * result now stays in React Query's cache for the period, so coming back to the page shows it
 * again without asking (the route also keeps it for 24 hours).
 */
export function SpendingSummaryCard({ householdId, months }: SpendingSummaryCardProps) {
  // The period the reader asked for on this visit. Changing the period does not write a new
  // summary on its own; one already in the cache still shows.
  const periodKey = `${householdId ?? ''}|${months}`;
  const [requestedPeriod, setRequestedPeriod] = useState<string | null>(null);

  const { data: summary, isLoading, error, refetch } = useSpendingSummary({
    householdId,
    months,
    enabled: requestedPeriod === periodKey,
  });

  const statistics = summary?.data?.statistics;
  const currency = statistics?.currency;
  const money = (amount: number) => formatCurrency(amount, currency);

  return (
    <Card>
      <CardHeader>
        <div>
          <div className="min-w-0">
            {/* "AI Spending Insights" promising "personalized insights" — the
                title named the technology and the description promised
                personalisation the feature does not do. It writes a summary of a
                period you choose, so that is what it is called. */}
            <CardTitle role="heading" aria-level={2} className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
              Spending summary
            </CardTitle>
            <CardDescription className="mt-1.5">
              A written read on {months === 1 ? 'the last month' : `the last ${months} months`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground" role="status">
            <Loader2 className="mb-4 h-8 w-8 animate-spin" aria-hidden="true" />
            <p className="text-sm">Reading through your receipts…</p>
          </div>
        )}

        {error && !isLoading && (
          <div className="space-y-3 rounded-lg bg-destructive/10 p-4 text-destructive">
            <p className="text-sm">The summary couldn&apos;t be written just now.</p>
            <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </Button>
          </div>
        )}

        {summary && !isLoading && (
          <div className="space-y-6">
            <SummaryText markdown={summary.summary} />

            {/* The route answers a period with no receipts with the summary text alone. */}
            {statistics && (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-muted/50 p-3 text-center sm:p-4">
                    <div className="amount text-xl font-bold sm:text-2xl">{statistics.totalItems}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Items bought</div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center sm:p-4">
                    <div className="amount text-xl font-bold sm:text-2xl">{money(statistics.totalSpent)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Total spent</div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center sm:p-4">
                    <div className="amount text-xl font-bold sm:text-2xl">{money(statistics.averagePerItem)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Average per item</div>
                  </div>
                </div>
                {/* There's no conversion: the money figures are in one currency only. */}
                {!!statistics.otherCurrencies?.length && (
                  <p className="text-xs text-muted-foreground">
                    Amounts are in {statistics.currency} only; what you bought in {statistics.otherCurrencies.join(' and ')} isn&apos;t in them.
                  </p>
                )}

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                      Top items
                    </h3>
                    <ul className="space-y-2">
                      {summary.data.topItems.slice(0, 5).map((item, index) => (
                        <li key={index} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 flex-1 truncate">{item.name}</span>
                          <Badge variant="secondary">{item.count}×</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <TrendingUp className="h-4 w-4" aria-hidden="true" />
                      Top categories
                    </h3>
                    <ul className="space-y-2">
                      {summary.data.topCategories.slice(0, 5).map((cat, index) => (
                        <li key={index} className="flex items-center justify-between gap-2 text-sm">
                          {/* Was the raw key, so fuel read "Gas". */}
                          <span className="min-w-0 flex-1 truncate">{categoryName(cat.category)}</span>
                          <span className="amount whitespace-nowrap text-muted-foreground">{money(cat.total)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <Store className="h-4 w-4" aria-hidden="true" />
                      Top shops
                    </h3>
                    <ul className="space-y-2">
                      {summary.data.topMerchants.slice(0, 5).map((merchant, index) => (
                        <li key={index} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 flex-1 truncate">{merchant.merchant}</span>
                          <span className="amount whitespace-nowrap text-muted-foreground">{money(merchant.total)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {!summary && !isLoading && !error && (
          <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
            <FileText className="mb-4 h-10 w-10 opacity-20" aria-hidden="true" />
            <p className="mb-4 max-w-xs text-sm">
              A few paragraphs on where the money went in this period, and what you buy most.
            </p>
            <Button onClick={() => setRequestedPeriod(periodKey)} className="gap-2">
              <FileText className="h-4 w-4" aria-hidden="true" />
              Write a summary
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

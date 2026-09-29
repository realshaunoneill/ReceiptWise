'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ReceiptBatchUpload } from '@/components/receipts/receipt-batch-upload';
import { ReceiptList } from '@/components/receipts/receipt-list';
import { ReceiptListSkeleton } from '@/components/receipts/receipt-list-skeleton';
import { HouseholdSelector } from '@/components/households/household-selector';
import { Pagination } from '@/components/layout/pagination';
import { ReceiptDetailModal } from '@/components/receipts/receipt-detail-modal';
import { ReceiptSearchFilters, type ReceiptFilters } from '@/components/receipts/receipt-search-filters';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Upload, Camera, ScanLine, FileText, Crown, Tag, Chrome, FileX2, SearchX } from 'lucide-react';
import { useUser as useClerkUser } from '@clerk/nextjs';
import { useUser } from '@/lib/hooks/use-user';
import { useReceipts, useRecentReceipts } from '@/lib/hooks/use-receipts';
import { useHouseholds } from '@/lib/hooks/use-households';
import { ReceiptTimeline } from '@/components/receipts/receipt-timeline';
import type { ReceiptWithItems } from '@/lib/types/api-responses';
import type { Receipt } from '@/lib/db/schema';
import { useTrialDays } from '@/lib/hooks/use-trial-days';

function ReceiptsPageContent() {
  const trialDays = useTrialDays();
  const { user: clerkUser } = useClerkUser();
  const { isSubscribed } = useUser();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string>();
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filters, setFilters] = useState<ReceiptFilters>({
    sortBy: 'date',
    sortOrder: 'desc',
  });
  const pageSize = 12;

  const { data: households = [] } = useHouseholds();

  const router = useRouter();

  const handleUpgradeClick = () => {
    router.push('/upgrade');
  };

  // Get recent receipts for the top section
  const { receipts: recentReceipts, isLoading: recentLoading, refetch: refetchRecent } = useRecentReceipts(selectedHouseholdId, 5);

  // Get paginated receipts for the main list
  const { receipts: allReceipts, pagination, isLoading: allLoading, error, refetch: refetchAll } = useReceipts(
    selectedHouseholdId,
    currentPage,
    pageSize,
    filters,
  );

  // Reset page when household or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedHouseholdId, filters]);

  // Handle selected or receiptId query parameter from URL
  useEffect(() => {
    const selectedId = searchParams.get('selected') || searchParams.get('receiptId');
    if (selectedId) {
      // Find the receipt in either recent or all receipts
      const receiptsToSearch = [...(recentReceipts || []), ...(allReceipts || [])];
      const receipt = receiptsToSearch.find(r => r.id === selectedId);

      if (receipt) {
        setSelectedReceipt(receipt);
        setIsModalOpen(true);
      } else {
        // Receipt not yet loaded, fetch it using queryClient
        queryClient.fetchQuery({
          queryKey: ['receipt', selectedId],
          queryFn: async () => {
            const res = await fetch(`/api/receipts/${selectedId}`);
            if (!res.ok) throw new Error('Receipt not found');
            return res.json();
          },
          staleTime: 5 * 60 * 1000,
        }).then(receipt => {
          setSelectedReceipt(receipt);
          setIsModalOpen(true);
        }).catch(err => {
          console.error('Failed to fetch receipt:', err);
        });
      }
    }
  }, [searchParams, recentReceipts, allReceipts, queryClient]);

  // Prefetch subscription data for all receipts when they load
  useEffect(() => {
    const prefetchSubscriptions = async () => {
      const receiptsToCheck = [...(recentReceipts || []), ...(allReceipts || [])];

      for (const receipt of receiptsToCheck) {
        // Prefetch subscription data for each receipt
        queryClient.prefetchQuery({
          queryKey: ['receipt-subscription', receipt.id],
          queryFn: async () => {
            const res = await fetch(`/api/receipts/${receipt.id}/subscription`);
            if (!res.ok) {
              if (res.status === 404) return null;
              throw new Error('Failed to fetch subscription link');
            }
            return res.json();
          },
          staleTime: 5 * 60 * 1000, // 5 minutes
        });
      }
    };

    if (recentReceipts || allReceipts) {
      prefetchSubscriptions();
    }
  }, [recentReceipts, allReceipts, queryClient]);

  const handleUploadComplete = () => {
    // Invalidate and refetch all receipt-related queries to ensure fresh data
    queryClient.invalidateQueries({ queryKey: ['receipts'] });
    // Also explicitly refetch to ensure data is updated immediately
    refetchRecent();
    refetchAll();
  };

  const handleRetry = () => {
    refetchRecent();
    refetchAll();
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleFiltersChange = (newFilters: ReceiptFilters) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters({
      sortBy: 'date',
      sortOrder: 'desc',
    });
  };

  const handleReceiptClick = (receipt: ReceiptWithItems) => {
    setSelectedReceipt(receipt);
    setIsModalOpen(true);
  };

  const handleModalClose = (open: boolean) => {
    if (!open) {
      setIsModalOpen(false);
      setSelectedReceipt(null);
    }
  };

  // Clerk middleware ensures user is authenticated
  if (!clerkUser) return null;

  return (
    <main className="container mx-auto max-w-7xl space-y-6 p-4 sm:p-6" aria-labelledby="receipts-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 id="receipts-title" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Receipts
            </h1>
            <p className="mt-1 text-sm text-muted-foreground sm:mt-2">
              Add a receipt and it gets read, itemised and filed.
            </p>
            {isSubscribed && (
              /* Was `text-blue-600 dark:text-blue-400` — the only blue text on the
                 page, on a palette whose accent is emerald. */
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Chrome className="h-3.5 w-3.5" aria-hidden="true" />
                Online receipts can be clipped from the browser with the extension.
              </p>
            )}
          </div>

          {households.length > 0 && (
            <div className="flex items-center gap-4">
              <HouseholdSelector
                households={[
                  { id: '', name: 'Personal Receipts' },
                  ...households,
                ]}
                selectedHouseholdId={selectedHouseholdId || ''}
                onSelect={(id) => setSelectedHouseholdId(id || undefined)}
              />
            </div>
          )}
        </div>

        {/* Upload and Recent Receipts Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            {isSubscribed ? (
              <ReceiptBatchUpload
                householdId={selectedHouseholdId}
                onUploadComplete={handleUploadComplete}
              />
            ) : (
              <Card className="border-primary/30">
                <CardHeader className="pb-4">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                    <Upload className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-xl text-foreground">Uploading needs a subscription</CardTitle>
                    {trialDays > 0 && (
                      <Badge variant="secondary">{trialDays}-day trial</Badge>
                    )}
                  </div>
                  <CardDescription className="text-sm">
                    Everything you have already added stays readable. Adding new receipts is
                    part of Premium.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Four tiles that said "Photo upload / AI scanning / Auto
                      extraction / Smart categorization" — four names for one thing,
                      one of them iconed with sparkles. */}
                  <ul className="space-y-2.5 text-sm">
                    {[
                      { icon: Camera, text: 'Photograph a receipt, or upload a PDF or screenshot' },
                      { icon: ScanLine, text: 'Merchant, date, total and tax read automatically' },
                      { icon: FileText, text: 'Every line item extracted, not just the total' },
                      { icon: Tag, text: 'Sorted into a spending category as it arrives' },
                    ].map(({ icon: Icon, text }) => (
                      <li key={text} className="flex items-start gap-2.5 text-muted-foreground">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        {text}
                      </li>
                    ))}
                  </ul>
                  <Button onClick={handleUpgradeClick} className="w-full gap-2">
                    <Crown className="h-4 w-4" aria-hidden="true" />
                    {trialDays > 0 ? `Start the ${trialDays}-day trial` : 'See Premium'}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    {trialDays > 0 ? 'Cancel during the trial and nothing is charged.' : 'Cancel any time.'}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
          <div className="space-y-4">
            {recentLoading ? (
              <ReceiptListSkeleton />
            ) : error ? (
              <Card>
                <CardContent className="text-center p-8 text-destructive">
                  Failed to load recent receipts
                </CardContent>
              </Card>
            ) : recentReceipts.length > 0 ? (
              <ReceiptList receipts={recentReceipts} onReceiptClick={handleReceiptClick} onRetry={handleRetry} />
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  Recently added receipts will show up here.
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* All Receipts Section */}
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
                <Calendar className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                Timeline
              </h2>
              <p className="mt-1 text-muted-foreground">
                {pagination ? (
                  <>
                    <span className="amount font-medium">{pagination.total}</span> receipt
                    {pagination.total !== 1 ? 's' : ''}, newest first
                  </>
                ) : (
                  'Loading…'
                )}
              </p>
            </div>
          </div>

          {/* Search and Filters */}
          <ReceiptSearchFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onClearFilters={handleClearFilters}
            totalResults={filters.search ? pagination?.total : undefined}
            isSearching={allLoading && !!filters.search}
            hasHouseholdFilter={!!selectedHouseholdId && households.length > 0}
          />

          {allLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: pageSize }).map((_, i) => (
                <div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center p-12 text-destructive">
              Failed to load receipts
            </div>
          ) : allReceipts.length > 0 ? (
            <>
              <ReceiptTimeline receipts={allReceipts} onReceiptClick={handleReceiptClick} />

              {pagination && pagination.totalPages > 1 && (
                <div className="flex justify-center pt-6">
                  <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    onPageChange={handlePageChange}
                    hasNext={pagination.hasNext}
                    hasPrev={pagination.hasPrev}
                  />
                </div>
              )}
            </>
          ) : filters.search ? (
            /* The two empty states below were an emoji in a grey circle — 🔍 and
               📄 — the only emoji rendered as UI iconography in the app, next to
               several hundred lucide icons. */
            <div className="rounded-lg border bg-muted/20 p-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <SearchX className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">No matching receipts</h3>
              <p className="mb-4 text-muted-foreground">
                Nothing matched &ldquo;<span className="font-medium">{filters.search}</span>&rdquo;.
                {selectedHouseholdId && !filters.searchAllHouseholds && (
                  <span className="mt-1 block text-sm">It may be in another household.</span>
                )}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button
                  variant="outline"
                  onClick={() => handleFiltersChange({ ...filters, search: undefined })}
                >
                  Clear search
                </Button>
                {selectedHouseholdId && !filters.searchAllHouseholds && (
                  <Button
                    variant="secondary"
                    onClick={() => handleFiltersChange({ ...filters, searchAllHouseholds: true })}
                  >
                    Search all households
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <FileX2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">Nothing here yet</h3>
              <p className="mb-4 text-muted-foreground">
                Add a receipt and it will appear on the timeline, grouped by the day you
                spent it.
              </p>
            </div>
          )}
        </div>

        {/* Receipt Detail Modal */}
        <ReceiptDetailModal
          receipt={selectedReceipt}
          open={isModalOpen}
          onOpenChange={handleModalClose}
        />
      </main>
  );
}

export default function ReceiptsPage() {
  return (
    <Suspense fallback={<ReceiptListSkeleton />}>
      <ReceiptsPageContent />
    </Suspense>
  );
}

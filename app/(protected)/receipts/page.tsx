'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ReceiptBatchUpload } from '@/components/receipts/receipt-batch-upload';
import { ReceiptListSkeleton } from '@/components/receipts/receipt-list-skeleton';
import { HouseholdSelector } from '@/components/households/household-selector';
import { Pagination } from '@/components/layout/pagination';
import { ReceiptDetailModal } from '@/components/receipts/receipt-detail-modal';
import { ReceiptSearchFilters, describeSort, type ReceiptFilters } from '@/components/receipts/receipt-search-filters';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Upload, Camera, ScanLine, FileText, Crown, Tag, Chrome, FileX2, SearchX } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { useUser } from '@/lib/hooks/use-user';
import { useReceipts } from '@/lib/hooks/use-receipts';
import { useHouseholds } from '@/lib/hooks/use-households';
import { ReceiptTimeline } from '@/components/receipts/receipt-timeline';
import type { ReceiptWithItems } from '@/lib/types/api-responses';
import type { Receipt } from '@/lib/db/schema';
import { useTrialDays } from '@/lib/hooks/use-trial-days';

function ReceiptsPageContent() {
  const trialDays = useTrialDays();
  const { data: session } = useSession();
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
  const pathname = usePathname();

  const handleUpgradeClick = () => {
    router.push('/upgrade');
  };

  /*
   * The "Recent receipts" card that sat beside the upload box is gone: it was the latest five of
   * the same receipts the timeline below already lists, so the page showed them twice.
   */

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

  // A receipt opened by link: /receipts?selected=<id> (or ?receiptId=, from item analysis).
  const linkedReceiptId = searchParams.get('selected') || searchParams.get('receiptId');

  const clearLinkedReceipt = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (!params.has('selected') && !params.has('receiptId')) return;
    params.delete('selected');
    params.delete('receiptId');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  /*
   * Opens the linked receipt once. This effect re-ran on every refetch of the list, and the id
   * stayed in the URL after the modal closed, so a closed receipt opened itself again; an
   * unknown id failed silently (logging "Receipt not found" on each run).
   */
  const handledLinkRef = useRef<string | null>(null);
  useEffect(() => {
    if (!linkedReceiptId) {
      handledLinkRef.current = null;
      return;
    }
    if (handledLinkRef.current === linkedReceiptId) return;
    handledLinkRef.current = linkedReceiptId;

    const listed = allReceipts.find(r => r.id === linkedReceiptId);
    if (listed) {
      setSelectedReceipt(listed);
      setIsModalOpen(true);
      return;
    }

    queryClient.fetchQuery({
      queryKey: ['receipt', linkedReceiptId],
      queryFn: async () => {
        const res = await fetch(`/api/receipts/${linkedReceiptId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => null) as { movedToBills?: boolean } | null;
          throw new Error(body?.movedToBills ? 'moved-to-bills' : 'Receipt not found');
        }
        return res.json();
      },
      retry: false,
      staleTime: 5 * 60 * 1000,
    }).then(receipt => {
      setSelectedReceipt(receipt);
      setIsModalOpen(true);
    }).catch((error: unknown) => {
      // A clip from the extension that was a bill went to the bill inbox, which is on the Plan.
      if (error instanceof Error && error.message === 'moved-to-bills') {
        toast.info('That was a bill, so it’s in Bills to file, on the Plan.');
        router.push('/plan');
        return;
      }
      toast.error('That receipt couldn’t be found');
      clearLinkedReceipt();
    });
  }, [linkedReceiptId, allReceipts, queryClient, clearLinkedReceipt, router]);

  /*
   * A prefetch of /api/receipts/:id/subscription for every receipt on the page used to run here,
   * one request per receipt (each answering 404 when nothing was linked), and nothing read the
   * result: the modal gets the linked subscription from /api/receipts/:id.
   */

  const handleUploadComplete = () => {
    // Invalidates every receipt query, whatever its filters or page.
    refetchAll();
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleFiltersChange = (newFilters: ReceiptFilters) => {
    setFilters(newFilters);
  };

  // "Clear all" in the Filters sheet clears the sheet's filters. It used to reset the search and
  // the sort as well.
  const handleClearFilters = () => {
    setFilters(current => ({
      search: current.search,
      searchAllHouseholds: current.searchAllHouseholds,
      sortBy: current.sortBy,
      sortOrder: current.sortOrder,
    }));
  };

  const handleReceiptClick = (receipt: ReceiptWithItems) => {
    setSelectedReceipt(receipt);
    setIsModalOpen(true);
  };

  const handleModalClose = (open: boolean) => {
    if (!open) {
      setIsModalOpen(false);
      setSelectedReceipt(null);
      clearLinkedReceipt();
    }
  };

  // proxy.ts and the protected layout keep signed-out visitors away; this covers the gap while loading
  if (!session) return null;

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
                Online receipts and bills can be clipped from the browser with the Chrome extension, coming soon.
              </p>
            )}
          </div>

          {households.length > 0 && (
            /* The label names the picker for screen readers; it had no accessible name.
               "Personal Receipts" was misleading: with no household picked, this is
               everything you uploaded, shared or not. */
            <label className="flex items-center gap-4">
              <span className="sr-only">Show receipts from</span>
              <HouseholdSelector
                households={[
                  { id: '', name: 'My receipts' },
                  ...households,
                ]}
                selectedHouseholdId={selectedHouseholdId || ''}
                onSelect={(id) => setSelectedHouseholdId(id || undefined)}
              />
            </label>
          )}
        </div>

        {/* Upload Section */}
        <div>
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
                    /* Promised "a PDF or screenshot"; upload takes JPG, PNG and WebP only. */
                    { icon: Camera, text: 'Photograph a receipt, or upload a JPG, PNG or WebP image of one' },
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
                    {/* Said "newest first" whatever the sort was. */}
                    <span className="amount font-medium">{pagination.total}</span> receipt
                    {pagination.total !== 1 ? 's' : ''}, {describeSort(filters.sortBy, filters.sortOrder)}
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
              <ReceiptTimeline receipts={allReceipts} onReceiptClick={handleReceiptClick} sortBy={filters.sortBy} />

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
                {/* "Add a receipt…" was also said to people who can't upload one. */}
                {isSubscribed
                  ? 'Add a receipt and it will appear on the timeline, grouped by the day you spent it.'
                  : 'With Premium, the receipts you add appear here, grouped by the day you spent the money.'}
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

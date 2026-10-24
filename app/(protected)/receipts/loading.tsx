import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function ReceiptsLoading() {
  return (
    <main className="container mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      {/* Header - matches page exactly */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-8 sm:h-9 w-32" />
          <Skeleton className="h-4 w-80 mt-1 sm:mt-2" />
        </div>
        <Skeleton className="h-10 w-48" />
      </div>

      {/* Upload card. The page no longer has a "Recent receipts" column beside it. */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 p-10 space-y-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2 text-center">
              <Skeleton className="h-5 w-48 mx-auto" />
              <Skeleton className="h-4 w-64 mx-auto" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-10" />
      </div>

      {/* Receipt Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Card key={i} className="overflow-hidden">
            <Skeleton className="h-32 w-full" />
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-2">
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-10 w-10" />
      </div>
    </main>
  );
}

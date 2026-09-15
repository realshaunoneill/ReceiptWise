import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsLoading() {
  return (
    <main className="container mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      {/* Header - matches page exactly */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded" />
            <Skeleton className="h-9 w-24" />
          </div>
          <Skeleton className="h-5 w-64 mt-1 sm:mt-2" />
        </div>
      </div>

      {/* Tabs. Was five columns and five skeletons; Settings has six tabs, so the
          skeleton was a tab short and a column narrow — the row visibly reflowed
          when the real TabsList replaced it. */}
      <div className="grid h-auto w-full grid-cols-3 gap-1 rounded-lg bg-muted p-1 lg:w-auto lg:flex">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-9 rounded-md lg:w-28" />
        ))}
      </div>

      {/* Profile Card - matches TabsContent mt-6 */}
      <div className="space-y-6 mt-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-3 w-72" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

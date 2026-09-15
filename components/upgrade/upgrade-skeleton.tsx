import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading state for /upgrade.
 *
 * There were two copies of this — one in `loading.tsx` and one inline in
 * `page.tsx` — both commented "matches the page exactly", and neither did: both
 * drew a three-column grid of three pricing cards where the page renders a single
 * centred card. So every visit to the upgrade page flashed three plans that then
 * collapsed into one, on the screen where a customer is deciding what they are
 * being sold. One component now, used by both.
 */
export function UpgradeSkeleton() {
  return (
    <main className="container mx-auto max-w-4xl space-y-16 px-4 py-12">
      {/* Hero */}
      <div className="mx-auto max-w-2xl space-y-5">
        <Skeleton className="h-11 w-80 max-w-full" />
        <Skeleton className="h-6 w-full max-w-xl" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      {/* Single pricing card */}
      <div className="mx-auto max-w-md space-y-6 rounded-xl border-2 border-primary/50 p-6">
        <div className="space-y-2 text-center">
          <Skeleton className="mx-auto h-8 w-40" />
          <Skeleton className="mx-auto h-4 w-56" />
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
        <div className="space-y-2 text-center">
          <Skeleton className="mx-auto h-12 w-32" />
          <Skeleton className="mx-auto h-4 w-40" />
        </div>
        <Skeleton className="h-12 w-full" />
      </div>

      {/* Comparison table */}
      <div className="mx-auto max-w-3xl space-y-4 rounded-xl border p-6">
        <Skeleton className="h-7 w-72 max-w-full" />
        <Skeleton className="h-4 w-full max-w-lg" />
        <div className="space-y-3 pt-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

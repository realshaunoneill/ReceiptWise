import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main className="container mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-44 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-64 w-full" />
    </main>
  );
}

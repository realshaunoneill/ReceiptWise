import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { incomeSources, type IncomeSource } from '@/lib/db/schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Make one income the user's primary (the one whose paydays set the plan's period). At most one
 * active primary per user: done in the caller's transaction rather than with a partial unique
 * index, whose diffs drizzle-kit push handles unreliably.
 */
export async function clearOtherPrimaries(tx: Tx, userId: string, keepId: string): Promise<void> {
  await tx
    .update(incomeSources)
    .set({ isPrimary: false, updatedAt: new Date() })
    .where(and(eq(incomeSources.userId, userId), eq(incomeSources.isPrimary, true), ne(incomeSources.id, keepId)));
}

export async function getIncome(id: string): Promise<IncomeSource | null> {
  const [income] = await db.select().from(incomeSources).where(eq(incomeSources.id, id)).limit(1);
  return income ?? null;
}

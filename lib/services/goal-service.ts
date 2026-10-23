import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { savingsGoals, type SavingsGoal } from '@/lib/db/schema';

export async function getGoal(id: string): Promise<SavingsGoal | null> {
  const [goal] = await db.select().from(savingsGoals).where(eq(savingsGoals.id, id)).limit(1);
  return goal ?? null;
}

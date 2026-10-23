import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { inboundAddresses, users, type InboundAddress, type User } from '@/lib/db/schema';
import { generateInboundToken } from '@/lib/inbound-email/token';

/** The user's forwarding address, made on first use. */
export async function getOrCreateInboundAddress(userId: string): Promise<InboundAddress> {
  const [existing] = await db.select().from(inboundAddresses).where(eq(inboundAddresses.userId, userId)).limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(inboundAddresses)
    .values({ userId, token: generateInboundToken() })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  // Another request made it first.
  const [raced] = await db.select().from(inboundAddresses).where(eq(inboundAddresses.userId, userId)).limit(1);
  return raced;
}

/** A new token: mail to the old address is refused from now on. */
export async function rotateInboundAddress(userId: string): Promise<InboundAddress> {
  await getOrCreateInboundAddress(userId);
  const [rotated] = await db
    .update(inboundAddresses)
    .set({ token: generateInboundToken(), rotatedAt: new Date(), disabledAt: null })
    .where(eq(inboundAddresses.userId, userId))
    .returning();
  return rotated;
}

/** Who a token belongs to, if its address is live. */
export async function userForInboundToken(token: string): Promise<User | null> {
  const [row] = await db
    .select({ user: users })
    .from(inboundAddresses)
    .innerJoin(users, eq(users.id, inboundAddresses.userId))
    .where(and(eq(inboundAddresses.token, token), isNull(inboundAddresses.disabledAt)))
    .limit(1);
  return row?.user ?? null;
}

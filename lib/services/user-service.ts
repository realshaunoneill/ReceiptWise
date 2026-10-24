import { db } from '@/lib/db';
import { users, type User, type NewUser } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export class UserService {
  /**
   * The app user for a Better Auth user: found by the link, else by verified email (an account
   * from the Clerk years, or one whose auth user was recreated), else created. `email` must be the
   * verified address from the session; this is the only writer of `users.email`, since invitations
   * are matched on it and Stripe customers re-associated by it.
   */
  static async getOrCreateUserForAuth(authUserId: string, email: string): Promise<User> {
    const [linked] = await db.select().from(users).where(eq(users.authUserId, authUserId)).limit(1);

    if (linked) {
      if (linked.email !== email) {
        // Another row can only hold this address if its auth user was replaced; leave both
        // untouched rather than violate the unique constraint and lock this user out.
        const holder = await this.getUserByEmail(email);
        if (!holder) {
          const [updated] = await db
            .update(users)
            .set({ email, updatedAt: new Date() })
            .where(eq(users.id, linked.id))
            .returning();
          return updated;
        }
      }
      return linked;
    }

    // First sign-in for an existing person: link the row that already has this verified address.
    const existing = await this.getUserByEmail(email);
    if (existing) {
      const [relinked] = await db
        .update(users)
        .set({ authUserId, updatedAt: new Date() })
        .where(eq(users.id, existing.id))
        .returning();
      return relinked;
    }

    const newUser: NewUser = { authUserId, email, subscribed: false };
    const [created] = await db
      .insert(users)
      .values(newUser)
      .onConflictDoNothing()
      .returning();
    if (created) return created;
    // Two first requests at once: the other one made the row.
    const [raced] = await db.select().from(users).where(eq(users.authUserId, authUserId)).limit(1);
    return raced;
  }

  /**
   * Update user subscription status
   */
  static async updateSubscriptionStatus(userId: string, subscribed: boolean): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ subscribed, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  /**
   * Get user profile by user ID
   */
  static async getUserProfile(userId: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user || null;
  }

  /**
   * Get user by email address
   */
  static async getUserByEmail(email: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user || null;
  }

  /**
   * Update user Stripe customer ID
   */
  static async updateStripeCustomerId(userId: string, stripeCustomerId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ stripeCustomerId, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  /**
   * Get user by Stripe customer ID
   */
  static async getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, stripeCustomerId))
      .limit(1);
    return user || null;
  }

  /**
   * Check if a user is an admin
   */
  static async isAdmin(userId: string): Promise<boolean> {
    const user = await this.getUserProfile(userId);
    return user?.isAdmin || false;
  }

  /**
   * Block a user from using the app
   */
  static async blockUser(userId: string, reason?: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        isBlocked: true,
        blockedAt: new Date(),
        blockedReason: reason || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  /**
   * Unblock a user
   */
  static async unblockUser(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        isBlocked: false,
        blockedAt: null,
        blockedReason: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  /**
   * Check if a user is blocked
   */
  static async isBlocked(userId: string): Promise<boolean> {
    const user = await this.getUserProfile(userId);
    return user?.isBlocked || false;
  }

  /**
   * Update block reason for a blocked user
   */
  static async updateBlockReason(userId: string, reason: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        blockedReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }
}

import { db } from '@/lib/db';
import { users, type User, type NewUser } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export class UserService {
  /**
   * Create a new user in the database
   */
  static async createUser(clerkId: string, email: string): Promise<User> {
    const newUser: NewUser = {
      clerkId,
      email,
      subscribed: false,
    };

    const [user] = await db.insert(users).values(newUser).returning();
    return user;
  }

  /**
   * Get user by Clerk ID
   */
  static async getUserByClerkId(clerkId: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    return user || null;
  }

  /**
   * Get or create user by Clerk ID, keeping `users.email` in step with Clerk.
   *
   * `email` must be the verified primary address from Clerk (see getClerkUserEmail). It is the
   * only writer of `users.email`: invitations are matched on it and Stripe customers are
   * re-associated by it, so it must never be user-editable.
   */
  static async getOrCreateUser(clerkId: string, email: string): Promise<User> {
    const user = await this.getUserByClerkId(clerkId);

    if (user) {
      if (user.email !== email) {
        // Another row can only hold this address if that Clerk account was replaced; leave both
        // untouched rather than violate the unique constraint and lock this user out.
        const holder = await this.getUserByEmail(email);
        if (!holder) {
          const [updated] = await db
            .update(users)
            .set({ email, updatedAt: new Date() })
            .where(eq(users.id, user.id))
            .returning();
          return updated;
        }
      }
      return user;
    }

    // A returning person whose Clerk account was recreated gets a new clerkId but the same
    // verified address. Inserting would fail on users.email's unique constraint and 500 on every
    // request, so re-link the existing row instead.
    const existing = await this.getUserByEmail(email);
    if (existing) {
      const [relinked] = await db
        .update(users)
        .set({ clerkId, updatedAt: new Date() })
        .where(eq(users.id, existing.id))
        .returning();
      return relinked;
    }

    return this.createUser(clerkId, email);
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

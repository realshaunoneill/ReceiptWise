import { db } from '@/lib/db';
import { households, householdUsers, householdInvitations, users, receipts, subscriptions, type Household, type HouseholdInvitation, type HouseholdMember, type NewHousehold, type NewHouseholdUser } from '@/lib/db/schema';
import { eq, and, asc, inArray, count, ne, sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { getAppUrl } from '@/lib/app-url';

/**
 * Thrown for expected, user-caused failures (not a member, already invited, bad email…) so
 * routes can answer 400/403/404 with the message instead of a generic 500.
 */
export class HouseholdError extends Error {
  constructor(message: string, public readonly status: 400 | 403 | 404 | 409 | 410 = 400) {
    super(message);
    this.name = 'HouseholdError';
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const HOUSEHOLD_NAME_MAX_LENGTH = 60;
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** The shareable link for an invitation. Holding it is what lets someone accept. */
export function buildInviteUrl(token: string): string {
  return `${getAppUrl()}/invite/${token}`;
}

/** Emails are compared lower-cased everywhere; Clerk stores them that way. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Validate and trim a household name. Returns the trimmed name or throws HouseholdError.
 */
export function validateHouseholdName(name: unknown): string {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new HouseholdError('Household name is required');
  }
  const trimmed = name.trim();
  if (trimmed.length > HOUSEHOLD_NAME_MAX_LENGTH) {
    throw new HouseholdError(`Household name must be ${HOUSEHOLD_NAME_MAX_LENGTH} characters or fewer`);
  }
  return trimmed;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class HouseholdService {
  /**
   * Get a single household by ID with member count and user's role
   * More efficient than getHouseholdsByUser when you only need one household
   */
  static async getHouseholdById(householdId: string, userId: string): Promise<(Household & { memberCount: number; isAdmin: boolean }) | null> {
    // Get the household with user's role in a single query
    const [result] = await db
      .select({
        id: households.id,
        name: households.name,
        createdAt: households.createdAt,
        updatedAt: households.updatedAt,
        userRole: householdUsers.role,
      })
      .from(households)
      .innerJoin(householdUsers, eq(households.id, householdUsers.householdId))
      .where(
        and(
          eq(households.id, householdId),
          eq(householdUsers.userId, userId),
        ),
      )
      .limit(1);

    if (!result) {
      return null;
    }

    // Get member count
    const [memberCount] = await db
      .select({ count: count() })
      .from(householdUsers)
      .where(eq(householdUsers.householdId, householdId));

    return {
      id: result.id,
      name: result.name,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      memberCount: memberCount?.count || 1,
      isAdmin: result.userRole === 'owner',
    };
  }

  /**
   * Create a new household and assign the creator as owner
   * Validates: Requirements 3.1, 3.2
   */
  static async createHousehold(userId: string, name: string): Promise<Household> {
    const validName = validateHouseholdName(name);

    // Create household and household_users record in a transaction
    const result = await db.transaction(async (tx) => {
      // Create the household
      const newHousehold: NewHousehold = {
        name: validName,
      };

      const [household] = await tx.insert(households).values(newHousehold).returning();

      // Assign creator as owner
      const newHouseholdUser: NewHouseholdUser = {
        householdId: household.id,
        userId,
        role: 'owner',
      };

      await tx.insert(householdUsers).values(newHouseholdUser);

      return household;
    });

    return result;
  }

  /**
   * Get all households a user belongs to with member count and user's role
   * Validates: Requirements 3.6
   */
  static async getHouseholdsByUser(userId: string): Promise<(Household & { memberCount: number; isAdmin: boolean })[]> {
    // First get all households the user belongs to with their role
    const userHouseholds = await db
      .select({
        id: households.id,
        name: households.name,
        createdAt: households.createdAt,
        updatedAt: households.updatedAt,
        userRole: householdUsers.role,
      })
      .from(households)
      .innerJoin(householdUsers, eq(households.id, householdUsers.householdId))
      .where(eq(householdUsers.userId, userId));

    // Get member counts for each household
    const householdIds = userHouseholds.map(h => h.id);

    if (householdIds.length === 0) {
      return [];
    }

    // Count members for all households in a single query using GROUP BY
    const memberCounts = await db
      .select({
        householdId: householdUsers.householdId,
        count: count(),
      })
      .from(householdUsers)
      .where(inArray(householdUsers.householdId, householdIds))
      .groupBy(householdUsers.householdId);

    const countMap = new Map(memberCounts.map(mc => [mc.householdId, mc.count]));

    return userHouseholds.map(h => ({
      id: h.id,
      name: h.name,
      createdAt: h.createdAt,
      updatedAt: h.updatedAt,
      memberCount: countMap.get(h.id) || 1,
      isAdmin: h.userRole === 'owner',
    }));
  }

  /**
   * Get all members of a household with their details
   * Validates: Requirements 3.4
   */
  static async getHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
    const result = await db
      .select({
        userId: users.id,
        email: users.email,
        role: householdUsers.role,
        joinedAt: householdUsers.createdAt,
      })
      .from(householdUsers)
      .innerJoin(users, eq(householdUsers.userId, users.id))
      .where(eq(householdUsers.householdId, householdId))
      .orderBy(asc(householdUsers.createdAt));

    return result.map(row => ({
      userId: row.userId,
      email: row.email,
      role: row.role as 'owner' | 'member',
      joinedAt: row.joinedAt,
    }));
  }

  /**
   * Create an invitation for someone to join a household. Owner-only.
   *
   * The returned row carries the token; the caller turns it into a shareable
   * /invite/<token> link. There is no email provider, so that link is how someone without an
   * account yet can be invited. Someone who already has an account on the invited address also
   * sees the invitation in their notifications.
   */
  static async createInvitation(householdId: string, rawEmail: string, invitedBy: string): Promise<HouseholdInvitation> {
    const email = normalizeEmail(rawEmail || '');
    if (!EMAIL_PATTERN.test(email)) {
      throw new HouseholdError('Enter a valid email address');
    }

    // Only the owner invites. The UI already hid the button from members, but the service
    // accepted any member, so the rule existed only in the client.
    if (!(await this.isOwner(householdId, invitedBy))) {
      throw new HouseholdError('Only the household owner can invite people', 403);
    }

    // Check if user exists and is already a member
    const [existingUser] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);

    if (existingUser) {
      const [existingMember] = await db
        .select()
        .from(householdUsers)
        .where(and(
          eq(householdUsers.householdId, householdId),
          eq(householdUsers.userId, existingUser.id),
        ))
        .limit(1);

      if (existingMember) {
        throw new HouseholdError('That person is already a member of this household', 409);
      }
    }

    // A still-valid pending invitation for the same address is a duplicate. An expired one is
    // retired so a fresh invitation can be sent.
    const pendingForEmail = await db
      .select()
      .from(householdInvitations)
      .where(and(
        eq(householdInvitations.householdId, householdId),
        sql`lower(${householdInvitations.invitedEmail}) = ${email}`,
        eq(householdInvitations.status, 'pending'),
      ));

    const now = new Date();
    for (const invitation of pendingForEmail) {
      if (invitation.expiresAt > now) {
        throw new HouseholdError('An invitation to that address is already pending', 409);
      }
      await db
        .update(householdInvitations)
        .set({ status: 'expired', updatedAt: now })
        .where(eq(householdInvitations.id, invitation.id));
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    const [invitation] = await db.insert(householdInvitations).values({
      householdId,
      invitedByUserId: invitedBy,
      invitedEmail: email,
      token,
      expiresAt,
    }).returning();

    return invitation;
  }

  /**
   * Pending, unexpired invitations for a household, oldest first. Expired rows are marked
   * 'expired' on the way through — previously expiry was only ever a filter, so the status
   * column never said so.
   */
  static async getPendingInvitations(householdId: string) {
    const now = new Date();
    const rows = await db
      .select({
        id: householdInvitations.id,
        invitedEmail: householdInvitations.invitedEmail,
        status: householdInvitations.status,
        token: householdInvitations.token,
        createdAt: householdInvitations.createdAt,
        expiresAt: householdInvitations.expiresAt,
        invitedByEmail: users.email,
      })
      .from(householdInvitations)
      .leftJoin(users, eq(householdInvitations.invitedByUserId, users.id))
      .where(and(
        eq(householdInvitations.householdId, householdId),
        eq(householdInvitations.status, 'pending'),
      ))
      .orderBy(asc(householdInvitations.createdAt));

    const expiredIds = rows.filter(r => r.expiresAt <= now).map(r => r.id);
    if (expiredIds.length > 0) {
      await db
        .update(householdInvitations)
        .set({ status: 'expired', updatedAt: now })
        .where(inArray(householdInvitations.id, expiredIds));
    }

    return rows.filter(r => r.expiresAt > now);
  }

  /**
   * Revoke a pending invitation. Owner-only.
   */
  static async revokeInvitation(householdId: string, invitationId: string, revokedBy: string): Promise<void> {
    if (!UUID_PATTERN.test(householdId) || !UUID_PATTERN.test(invitationId)) {
      throw new HouseholdError('Invitation not found or no longer pending', 404);
    }
    if (!(await this.isOwner(householdId, revokedBy))) {
      throw new HouseholdError('Only the household owner can revoke invitations', 403);
    }

    const [updated] = await db
      .update(householdInvitations)
      .set({ status: 'revoked', updatedAt: new Date() })
      .where(and(
        eq(householdInvitations.id, invitationId),
        eq(householdInvitations.householdId, householdId),
        eq(householdInvitations.status, 'pending'),
      ))
      .returning({ id: householdInvitations.id });

    if (!updated) {
      throw new HouseholdError('Invitation not found or no longer pending', 404);
    }
  }

  /**
   * Look up an invitation by its token for the /invite/<token> page, with the household name
   * and inviter's email. Marks a pending-but-expired invitation 'expired'. Returns null for an
   * unknown token.
   */
  static async getInvitationByToken(token: string) {
    if (!/^[a-f0-9]{64}$/.test(token)) return null;

    const [row] = await db
      .select({
        id: householdInvitations.id,
        householdId: householdInvitations.householdId,
        householdName: households.name,
        invitedEmail: householdInvitations.invitedEmail,
        invitedByEmail: users.email,
        status: householdInvitations.status,
        expiresAt: householdInvitations.expiresAt,
      })
      .from(householdInvitations)
      .innerJoin(households, eq(householdInvitations.householdId, households.id))
      .leftJoin(users, eq(householdInvitations.invitedByUserId, users.id))
      .where(eq(householdInvitations.token, token))
      .limit(1);

    if (!row) return null;

    if (row.status === 'pending' && row.expiresAt <= new Date()) {
      await db
        .update(householdInvitations)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(householdInvitations.id, row.id));
      return { ...row, status: 'expired' };
    }

    return row;
  }

  /**
   * Accept or decline an invitation. Used by both the email-matched notification flow (looked
   * up by id + the caller's verified email) and the link flow (looked up by token, where
   * holding the link is the authorisation).
   *
   * Accepting when already a member is treated as success so a double-click or a second tab
   * doesn't show an error, and leaves the invitation untouched.
   */
  static async respondToInvitation(
    invitation: HouseholdInvitation,
    userId: string,
    action: 'accept' | 'decline',
  ): Promise<{ householdId: string; alreadyMember: boolean }> {
    // Already in the household (the owner opening their own link to check it, or the invitee
    // clicking it a second time): report success without consuming the invitation, so the
    // link still works for its real recipient.
    const [existingMembership] = await db
      .select({ id: householdUsers.id })
      .from(householdUsers)
      .where(and(
        eq(householdUsers.householdId, invitation.householdId),
        eq(householdUsers.userId, userId),
      ))
      .limit(1);

    if (existingMembership) {
      return { householdId: invitation.householdId, alreadyMember: true };
    }

    if (invitation.status !== 'pending') {
      throw new HouseholdError('This invitation has already been used or withdrawn', 409);
    }

    if (invitation.expiresAt <= new Date()) {
      await db
        .update(householdInvitations)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(householdInvitations.id, invitation.id));
      throw new HouseholdError('This invitation has expired. Ask for a new one.', 410);
    }

    if (action === 'decline') {
      await db
        .update(householdInvitations)
        .set({ status: 'declined', updatedAt: new Date() })
        .where(eq(householdInvitations.id, invitation.id));
      return { householdId: invitation.householdId, alreadyMember: false };
    }

    return db.transaction(async (tx) => {
      // Claim the invitation first so two concurrent accepts can't both succeed.
      const [claimed] = await tx
        .update(householdInvitations)
        .set({ status: 'accepted', updatedAt: new Date() })
        .where(and(
          eq(householdInvitations.id, invitation.id),
          eq(householdInvitations.status, 'pending'),
        ))
        .returning({ id: householdInvitations.id });

      if (!claimed) {
        throw new HouseholdError('This invitation has already been used or withdrawn', 409);
      }

      const inserted = await tx
        .insert(householdUsers)
        .values({ householdId: invitation.householdId, userId, role: 'member' })
        .onConflictDoNothing()
        .returning({ id: householdUsers.id });

      return { householdId: invitation.householdId, alreadyMember: inserted.length === 0 };
    });
  }

  /**
   * Remove a member from a household (owner only).
   */
  static async removeMember(householdId: string, userId: string, removedBy: string): Promise<void> {
    const isOwnerResult = await this.isOwner(householdId, removedBy);
    if (!isOwnerResult) {
      throw new HouseholdError('Only the household owner can remove members', 403);
    }

    if (userId === removedBy) {
      throw new HouseholdError('Owners cannot remove themselves. Transfer ownership or delete the household instead.');
    }

    await db.transaction(async (tx) => {
      const removed = await tx
        .delete(householdUsers)
        .where(and(
          eq(householdUsers.householdId, householdId),
          eq(householdUsers.userId, userId),
        ))
        .returning({ id: householdUsers.id });

      if (removed.length === 0) {
        throw new HouseholdError('That person is not a member of this household', 404);
      }

      await this.clearDefaultHousehold(tx, householdId, [userId]);
    });
  }

  /**
   * Delete a household (owner only).
   */
  static async deleteHousehold(householdId: string, userId: string): Promise<void> {
    const isOwnerResult = await this.isOwner(householdId, userId);
    if (!isOwnerResult) {
      throw new HouseholdError('Only the household owner can delete the household', 403);
    }

    await this.deleteHouseholdSafely(householdId);
  }

  /**
   * Delete a household without deleting anyone's data.
   *
   * Receipts and tracked subscriptions belong to the person who added them, not to the
   * household. The foreign keys are now ON DELETE SET NULL, but they used to cascade — deleting
   * a household hard-deleted every member's receipts — so the detach is done explicitly here as
   * well, in one transaction, rather than trusting the constraint alone. Everything returns to
   * its owner's personal view.
   *
   * No ownership check: callers are responsible (deleteHousehold, the account-deletion cron).
   */
  static async deleteHouseholdSafely(householdId: string, executor?: Tx): Promise<void> {
    const run = async (tx: Tx) => {
      await tx
        .update(receipts)
        .set({ householdId: null, updatedAt: new Date() })
        .where(eq(receipts.householdId, householdId));

      await tx
        .update(subscriptions)
        .set({ householdId: null, updatedAt: new Date() })
        .where(eq(subscriptions.householdId, householdId));

      await tx
        .update(users)
        .set({ defaultHouseholdId: null, updatedAt: new Date() })
        .where(eq(users.defaultHouseholdId, householdId));

      // household_users and household_invitations cascade from this row.
      await tx.delete(households).where(eq(households.id, householdId));
    };

    if (executor) {
      await run(executor);
    } else {
      await db.transaction(run);
    }
  }

  /**
   * Leave a household. Members can always leave. An owner can leave only when they are the
   * last person in it (which deletes the household) — otherwise they must transfer ownership
   * first, so a household is never left without an owner who can manage it.
   */
  static async leaveMember(householdId: string, userId: string): Promise<{ deletedHousehold: boolean }> {
    const [membership] = await db
      .select()
      .from(householdUsers)
      .where(and(
        eq(householdUsers.householdId, householdId),
        eq(householdUsers.userId, userId),
      ))
      .limit(1);

    if (!membership) {
      throw new HouseholdError('You are not a member of this household', 404);
    }

    if (membership.role === 'owner') {
      const [others] = await db
        .select({ count: count() })
        .from(householdUsers)
        .where(and(
          eq(householdUsers.householdId, householdId),
          ne(householdUsers.userId, userId),
        ));

      if ((others?.count ?? 0) > 0) {
        throw new HouseholdError('Transfer ownership to another member before leaving, or delete the household.');
      }

      await this.deleteHouseholdSafely(householdId);
      return { deletedHousehold: true };
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(householdUsers)
        .where(and(
          eq(householdUsers.householdId, householdId),
          eq(householdUsers.userId, userId),
        ));

      await this.clearDefaultHousehold(tx, householdId, [userId]);
    });

    return { deletedHousehold: false };
  }

  /**
   * Hand ownership to another member (owner only). The previous owner stays on as a member.
   */
  static async transferOwnership(householdId: string, newOwnerId: string, currentOwnerId: string, executor?: Tx): Promise<void> {
    const run = async (tx: Tx) => {
      const [currentOwner] = await tx
        .select()
        .from(householdUsers)
        .where(and(
          eq(householdUsers.householdId, householdId),
          eq(householdUsers.userId, currentOwnerId),
          eq(householdUsers.role, 'owner'),
        ))
        .limit(1);

      if (!currentOwner) {
        throw new HouseholdError('Only the household owner can transfer ownership', 403);
      }

      if (newOwnerId === currentOwnerId) {
        throw new HouseholdError('You already own this household');
      }

      const [promoted] = await tx
        .update(householdUsers)
        .set({ role: 'owner' })
        .where(and(
          eq(householdUsers.householdId, householdId),
          eq(householdUsers.userId, newOwnerId),
        ))
        .returning({ id: householdUsers.id });

      if (!promoted) {
        throw new HouseholdError('That person is not a member of this household', 404);
      }

      await tx
        .update(householdUsers)
        .set({ role: 'member' })
        .where(eq(householdUsers.id, currentOwner.id));
    };

    if (executor) {
      await run(executor);
    } else {
      await db.transaction(run);
    }
  }

  /**
   * Hand every household a departing user owns to its longest-standing other member, or
   * delete it (safely, keeping everyone's receipts) if nobody else is in it. Used by the
   * account-deletion cron so a deleted owner doesn't leave an ownerless household behind.
   */
  static async releaseOwnedHouseholds(userId: string): Promise<{ transferred: number; deleted: number }> {
    const owned = await db
      .select({ householdId: householdUsers.householdId })
      .from(householdUsers)
      .where(and(eq(householdUsers.userId, userId), eq(householdUsers.role, 'owner')));

    let transferred = 0;
    let deleted = 0;

    for (const { householdId } of owned) {
      await db.transaction(async (tx) => {
        const [successor] = await tx
          .select({ userId: householdUsers.userId })
          .from(householdUsers)
          .where(and(
            eq(householdUsers.householdId, householdId),
            ne(householdUsers.userId, userId),
          ))
          .orderBy(asc(householdUsers.createdAt))
          .limit(1);

        if (successor) {
          await this.transferOwnership(householdId, successor.userId, userId, tx);
          transferred++;
        } else {
          await this.deleteHouseholdSafely(householdId, tx);
          deleted++;
        }
      });
    }

    return { transferred, deleted };
  }

  /**
   * Clear users.defaultHouseholdId where it points at a household they no longer belong to.
   * Without this, every later upload from a removed member kept being filed into their old
   * household, visible to the people they had left.
   */
  private static async clearDefaultHousehold(tx: Tx, householdId: string, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    await tx
      .update(users)
      .set({ defaultHouseholdId: null, updatedAt: new Date() })
      .where(and(
        inArray(users.id, userIds),
        eq(users.defaultHouseholdId, householdId),
      ));
  }

  /**
   * Check if a user is the owner of a household
   */
  static async isOwner(householdId: string, userId: string): Promise<boolean> {
    const [householdUser] = await db
      .select()
      .from(householdUsers)
      .where(and(
        eq(householdUsers.householdId, householdId),
        eq(householdUsers.userId, userId),
        eq(householdUsers.role, 'owner'),
      ))
      .limit(1);

    return !!householdUser;
  }
}

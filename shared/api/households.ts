/** One of GET /api/households: a household the signed-in person belongs to. */
export type WireHousehold = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  /** Whether the signed-in person owns it. */
  isAdmin: boolean;
};

/** One person in a household (GET /api/households/:id/members, and the detail's members). */
export type WireHouseholdMember = {
  userId: string;
  email: string;
  name: string | null;
  /** 'owner' | 'member' */
  role: string;
  joinedAt: string;
};

/** GET /api/households/:id: the household and who is in it. */
export type WireHouseholdDetail = WireHousehold & { members: WireHouseholdMember[] };

/**
 * One of GET /api/households/:id/invitations: an invitation still waiting, unexpired. Only the
 * owner gets the link; a link is what lets someone join.
 */
export type WireSentInvitation = {
  id: string;
  invitedEmail: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  invitedByEmail: string | null;
  inviteUrl?: string;
};

/** POST /api/households/:id/invitations: the new invitation and the link to send. */
export type WireCreatedInvitation = {
  id: string;
  householdName?: string;
  invitedEmail: string;
  status: string;
  expiresAt: string;
  inviteUrl: string;
};

/** One of GET /api/invitations: an invitation to the signed-in person's address. */
export type WireReceivedInvitation = {
  id: string;
  householdId: string;
  householdName: string | null;
  invitedByEmail: string | null;
  status: string;
  createdAt: string;
  expiresAt: string;
};

/** GET /api/invitations/token/:token: what an invitation link shows, signed in or not. */
export type WireInvitePreview = {
  householdName: string;
  invitedByEmail: string | null;
  /** 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired' */
  status: string;
  expiresAt: string;
};

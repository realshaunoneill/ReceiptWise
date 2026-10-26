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

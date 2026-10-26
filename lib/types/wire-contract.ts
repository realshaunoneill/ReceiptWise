/**
 * Compile-time checks that what the API returns still matches the wire types the app reads
 * (shared/api/*). Nothing runs: if a route's shape drifts, `tsc` fails here, in the web's CI,
 * before the app ever sees it.
 */
import { type BillDocument, type FinancialAccount, type IncomeSource, type SavingsGoal, type Subscription, type SubscriptionPayment, type User } from '@/lib/db/schema';
import { type FeatureFlags } from '@/lib/features';
import { type getReceipts } from '@/lib/receipt-scanner';
import { type FinanceEntitlements } from '@/lib/services/finance-access';
import { type HouseholdService } from '@/lib/services/household-service';
import { type PlanResponse } from '@/lib/services/plan-service';
import { type MatchSuggestion } from '@/lib/provider-matching';
import { type WireBill, type WireBillDetail, type WireInboxDocument } from '@/shared/api/bills';
import { type WireAccount, type WireGoal, type WireIncome } from '@/shared/api/finance';
import { type Jsonify } from '@/shared/api/jsonify';
import { type WireHousehold } from '@/shared/api/households';
import { type WirePlan } from '@/shared/api/plan';
import { type WireReceiptsPage } from '@/shared/api/receipts';
import { type WireMe } from '@/shared/api/user';

type Assert<T extends true> = T;
type Fits<Server, Wire> = Jsonify<Server> extends Wire ? true : false;

/** app/api/users/me/route.ts */
export type MeFits = Assert<Fits<User & { features: FeatureFlags; entitlements: FinanceEntitlements }, WireMe>>;
/** app/api/receipts/route.ts */
export type ReceiptsFit = Assert<Fits<Awaited<ReturnType<typeof getReceipts>>, WireReceiptsPage>>;
/** app/api/plan/route.ts */
export type PlanFits = Assert<Fits<PlanResponse, WirePlan>>;
/** app/api/households/route.ts */
export type HouseholdsFit = Assert<Fits<Awaited<ReturnType<typeof HouseholdService.getHouseholdsByUser>>, WireHousehold[]>>;
/** app/api/subscriptions/route.ts (the rows, before any payments are added) */
export type BillsFit = Assert<Fits<Subscription[], WireBill[]>>;
/** app/api/subscriptions/[id]/route.ts */
export type BillDetailFits = Assert<Fits<Subscription & {
  payments: SubscriptionPayment[];
  bills: Array<Pick<BillDocument, 'id' | 'paymentId' | 'fileName' | 'provider' | 'amountDue' | 'currency' | 'dueDate' | 'issueDate' | 'periodStart' | 'periodEnd'>>;
  canEdit: boolean;
}, WireBillDetail>>;
/** app/api/bills/documents/route.ts (toClientDocument, plus suggestions) */
export type InboxFits = Assert<Fits<Array<Omit<BillDocument, 'blobPathname' | 'extracted'> & { suggestions: MatchSuggestion[] }>, WireInboxDocument[]>>;
/** app/api/income/route.ts */
export type IncomeFits = Assert<Fits<IncomeSource[], WireIncome[]>>;
/** app/api/goals/route.ts */
export type GoalsFit = Assert<Fits<SavingsGoal[], WireGoal[]>>;
/** app/api/accounts/route.ts */
export type AccountsFit = Assert<Fits<Array<FinancialAccount & { latestBalance: { balance: string; asOfDate: string } | null }>, WireAccount[]>>;

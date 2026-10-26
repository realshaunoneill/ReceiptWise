import { type Jsonify } from './jsonify';
import { type PlanResult } from '../plan/compute-plan';
import { type UsualItem } from '../plan/usual-items';

/** Whose plan: the viewer's own, or a household's (lib/services/finance-access.ts). */
export type WireScope = { type: 'mine' } | { type: 'household'; householdId: string };

/** GET /api/plan: one period of the plan, computed on the server (shared/plan/compute-plan.ts). */
export type WirePlan = Jsonify<PlanResult> & {
  scope: WireScope;
  /** One-offs from earlier periods, with their last amount: quick picks for adding. */
  suggestions: UsualItem[];
  /** The viewer's primary income, which sets the period; null without one. */
  primaryIncome: {
    id: string;
    name: string;
    amount: string;
    currency: string;
    frequency: string;
    payDay: number | null;
    anchorDate: string | null;
    weekendRule: string;
    householdId: string | null;
  } | null;
  viewerIncomeCount: number;
};

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type Subscription, type SubscriptionPayment } from '@/lib/db/schema';
import { type BillingFrequency } from '@/lib/schedule/billing-schedule';

export type SubscriptionWithPayments = Subscription & {
  missingPayments?: number;
  recentPayments?: SubscriptionPayment[];
};

export type SubscriptionDetail = Subscription & {
  payments: SubscriptionPayment[];
  /** False for a member of the household it is shared with: they can mark payments, not edit it. */
  canEdit?: boolean;
};

type SubscriptionKind = 'subscription' | 'bill';
type PaymentMethod = 'direct_debit' | 'standing_order' | 'card' | 'manual';

type CreateSubscriptionData = {
  name: string;
  description?: string;
  category?: string;
  amount: number | string;
  currency?: string;
  billingFrequency: BillingFrequency;
  billingDay?: number;
  customFrequencyDays?: number;
  /** YYYY-MM-DD */
  startDate: string;
  householdId?: string;
  isBusinessExpense?: boolean;
  website?: string;
  notes?: string;
  kind?: SubscriptionKind;
  amountType?: 'fixed' | 'variable';
  paymentMethod?: PaymentMethod | null;
};

type UpdateSubscriptionData = Partial<{
  name: string;
  description: string | null;
  category: string | null;
  amount: number | string;
  currency: string;
  billingFrequency: BillingFrequency;
  billingDay: number;
  customFrequencyDays: number | null;
  /** YYYY-MM-DD */
  startDate: string;
  status: 'active' | 'paused' | 'cancelled';
  /** YYYY-MM-DD, or null to clear */
  endDate: string | null;
  householdId: string | null;
  isBusinessExpense: boolean;
  website: string | null;
  notes: string | null;
  kind: SubscriptionKind;
  amountType: 'fixed' | 'variable';
  paymentMethod: PaymentMethod | null;
}>;

export type UpdatePaymentData = {
  receiptId?: string;
  status?: 'pending' | 'paid' | 'missed' | 'skipped' | 'cancelled';
  /** YYYY-MM-DD */
  actualDate?: string | null;
  actualAmount?: number | string | null;
  expectedAmount?: number | string;
  /** YYYY-MM-DD */
  dueDate?: string | null;
  notes?: string | null;
};

/** Throw the server's `{ error }` message rather than a generic one, so toasts say what went wrong. */
async function throwResponseError(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => null) as { error?: unknown } | null;
  throw new Error(typeof body?.error === 'string' ? body.error : fallback);
}

// Fetch all subscriptions
export function useSubscriptions(
  householdId?: string,
  status?: string,
  includePayments = false,
) {
  return useQuery<SubscriptionWithPayments[]>({
    queryKey: ['subscriptions', householdId, status, includePayments],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (householdId) params.append('householdId', householdId);
      if (status) params.append('status', status);
      if (includePayments) params.append('includePayments', 'true');

      const res = await fetch(`/api/subscriptions?${params}`);
      if (!res.ok) await throwResponseError(res, 'Failed to fetch subscriptions');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - subscriptions don't change frequently
    gcTime: 15 * 60 * 1000, // Keep in cache for 15 minutes
    refetchOnWindowFocus: false, // Don't refetch on tab focus
  });
}

// Fetch single subscription with payment history
export function useSubscription(id: string) {
  return useQuery<SubscriptionDetail>({
    queryKey: ['subscription', id],
    queryFn: async () => {
      const res = await fetch(`/api/subscriptions/${id}`);
      if (!res.ok) await throwResponseError(res, 'Failed to fetch subscription');
      return res.json();
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Create subscription
export function useCreateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSubscriptionData) => {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) await throwResponseError(res, 'Failed to create subscription');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });
}

// Update subscription
export function useUpdateSubscription(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateSubscriptionData) => {
      const res = await fetch(`/api/subscriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) await throwResponseError(res, 'Failed to update subscription');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscription', id] });
    },
  });
}

// Delete subscription
export function useDeleteSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/subscriptions/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) await throwResponseError(res, 'Failed to delete subscription');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });
}

// Update payment (link receipt or change status)
export function useUpdatePayment(subscriptionId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ paymentId, data }: { paymentId: string; data: UpdatePaymentData }) => {
      const res = await fetch(`/api/subscriptions/payments/${paymentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) await throwResponseError(res, 'Failed to update payment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      if (subscriptionId) {
        queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
      }
    },
  });
}

// Unlink receipt from payment
export function useUnlinkPayment(subscriptionId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await fetch(`/api/subscriptions/payments/${paymentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) await throwResponseError(res, 'Failed to unlink payment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      if (subscriptionId) {
        queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
      }
    },
  });
}

// Act on one cycle by its date (YYYY-MM-DD), creating its row if it has none yet
export function useUpdateOccurrence(subscriptionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ expectedDate, data }: { expectedDate: string; data: Omit<UpdatePaymentData, 'receiptId'> }) => {
      const res = await fetch(`/api/subscriptions/${subscriptionId}/occurrences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedDate, ...data }),
      });
      if (!res.ok) await throwResponseError(res, 'Failed to update payment');
      return res.json() as Promise<SubscriptionPayment>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
    },
  });
}

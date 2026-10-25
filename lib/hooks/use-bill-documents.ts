'use client';

import { upload } from '@vercel/blob/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type BillDocument } from '@/lib/db/schema';
import { invalidateFinanceQueries } from '@/lib/hooks/use-plan';
import { type MatchSuggestion } from '@/lib/provider-matching';

export type ClientBillDocument = Omit<BillDocument, 'blobPathname' | 'extracted'> & { suggestions: MatchSuggestion[] };

async function fetchJson<T>(url: string, init?: RequestInit, fallback = 'Something went wrong'): Promise<T> {
  const res = await fetch(url, init && { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: unknown } | null;
    throw new Error(typeof body?.error === 'string' ? body.error : fallback);
  }
  return res.json() as Promise<T>;
}

/** Bills waiting to be filed (or being read). Polls while any is still being read. */
export function useBillInbox(householdId?: string, enabled = true) {
  return useQuery<ClientBillDocument[]>({
    queryKey: ['bill-documents', 'review', householdId ?? null],
    queryFn: () => {
      const params = new URLSearchParams({ review: 'true' });
      if (householdId) params.set('householdId', householdId);
      return fetchJson<ClientBillDocument[]>(`/api/bills/documents?${params}`, undefined, 'Failed to load bills');
    },
    enabled,
    refetchInterval: (query) =>
      query.state.data?.some((doc) => doc.processingStatus === 'pending' || doc.processingStatus === 'processing') ? 3000 : false,
  });
}

function useBillMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    // Returned, so the mutation is pending until the inbox and plan on screen have caught up.
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['bill-documents'] }),
      invalidateFinanceQueries(queryClient),
    ]),
  });
}

/** Upload a bill straight to the private store, then register it so it is read. */
export function useUploadBill() {
  return useBillMutation(async ({ file, householdId }: { file: File; householdId?: string }) => {
    const { prefix, configured } = await fetchJson<{ prefix: string; configured: boolean }>('/api/bills/documents/upload', undefined, 'Uploads are unavailable');
    if (!configured) throw new Error('Bill uploads are not set up yet');
    const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(-80) || 'bill';
    const blob = await upload(`${prefix}${safeName}`, file, {
      access: 'private',
      handleUploadUrl: '/api/bills/documents/upload',
      contentType: file.type,
    });
    return fetchJson<ClientBillDocument>('/api/bills/documents', {
      method: 'POST',
      body: JSON.stringify({ pathname: blob.pathname, fileName: file.name, householdId: householdId ?? null }),
    }, 'Failed to add the bill');
  });
}

export type ApplyBillAction =
  | { action: 'match'; subscriptionId: string; amount?: 'due' | 'minimum' }
  | { action: 'new_bill'; name?: string; billingFrequency?: string }
  | { action: 'one_off'; label?: string }
  | { action: 'dismiss' };

export function useApplyBill() {
  return useBillMutation(({ id, action }: { id: string; action: ApplyBillAction }) =>
    fetchJson<ClientBillDocument>(`/api/bills/documents/${id}/apply`, { method: 'POST', body: JSON.stringify(action) }, 'Failed to file the bill'));
}

export function useRetryBill() {
  return useBillMutation((id: string) =>
    fetchJson<ClientBillDocument>(`/api/bills/documents/${id}/retry`, { method: 'POST' }, 'Failed to read it again'));
}

export function useDeleteBill() {
  return useBillMutation((id: string) =>
    fetchJson<{ success: boolean }>(`/api/bills/documents/${id}`, { method: 'DELETE' }, 'Failed to remove it'));
}

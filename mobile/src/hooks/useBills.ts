import { useQuery } from '@tanstack/react-query';
import { type WireBill } from '@shared/api/bills';
import { api } from '../api/client';

/** Active bills and subscriptions, soonest due first. Same key shape as the website's. */
export function useBills(status: 'active' | 'paused' | 'cancelled' = 'active') {
  return useQuery({
    queryKey: ['subscriptions', undefined, status, false],
    queryFn: () => api<WireBill[]>(`/api/subscriptions?status=${status}`),
  });
}

import { useQuery } from '@tanstack/react-query';
import { type WireHousehold } from '@shared/api/households';
import { api } from '../api/client';

/** The households the signed-in person belongs to. Joining or leaving one invalidates this. */
export function useHouseholds() {
  return useQuery({ queryKey: ['households'], queryFn: () => api<WireHousehold[]>('/api/households'), staleTime: 10 * 60 * 1000 });
}

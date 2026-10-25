import { useQuery } from '@tanstack/react-query';

export function useHouseholds() {
  return useQuery({
    queryKey: ['households'],
    queryFn: async () => {
      const response = await fetch('/api/households');
      if (!response.ok) {
        throw new Error('Failed to fetch households');
      }
      return response.json();
    },
    staleTime: 10 * 60 * 1000, // households rarely change; joining or leaving one invalidates this
    gcTime: 30 * 60 * 1000,
  });
}

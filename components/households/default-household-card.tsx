'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser } from '@/lib/hooks/use-user';

const JUST_ME = 'none';

/**
 * Where a receipt goes when it's added without choosing (uploads, email, the app): your own, or a
 * household. It was a tab of its own in Settings, away from the households it's about; the app
 * has it in Settings › Sharing. It saves as soon as it's picked.
 */
export function DefaultHouseholdCard({ households }: { households: Array<{ id: string; name: string }> }) {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: async (householdId: string | null) => {
      const response = await fetch('/api/users/default-household', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId }),
      });
      if (!response.ok) throw new Error('Couldn’t change where new receipts go');
      return response.json();
    },
    onSuccess: (_, householdId) => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast.success(`New receipts go to ${households.find((household) => household.id === householdId)?.name ?? 'just you'}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const current = update.isPending ? update.variables ?? JUST_ME : user?.defaultHouseholdId ?? JUST_ME;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">New receipts go to</CardTitle>
        <CardDescription>
          Where a receipt goes when you add it without choosing. Bills and the plan are shared line by line instead.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Select
          value={current}
          onValueChange={(value) => update.mutate(value === JUST_ME ? null : value)}
          disabled={!user || update.isPending}
        >
          <SelectTrigger className="h-11 w-full sm:w-72" aria-label="New receipts go to">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={JUST_ME}>Just me</SelectItem>
            {households.map((household) => (
              <SelectItem key={household.id} value={household.id}>{household.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

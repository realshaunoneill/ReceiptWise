'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { invalidateFinanceQueries } from '@/lib/hooks/use-plan';

/**
 * Shown on a receipt the reader thinks is a bill (an amount still to pay). Moving it reads it as a
 * bill for the plan and deletes the receipt, so the amount stops counting as money already spent.
 */
export function MoveToBills({ receiptId, onMoved }: { receiptId: string; onMoved: () => void }) {
  const [moving, setMoving] = useState(false);
  const queryClient = useQueryClient();

  const move = async () => {
    setMoving(true);
    try {
      const res = await fetch(`/api/receipts/${receiptId}/move-to-bills`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? 'Failed to move it to bills');
      }
      toast.success('Moved to bills. It will appear in your plan to file.');
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['bill-documents'] });
      invalidateFinanceQueries(queryClient);
      onMoved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to move it to bills');
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm">This looks like a bill still to pay. Move it to Bills to plan for it; it then stops counting as spending.</p>
      </div>
      <Button size="sm" onClick={move} disabled={moving}>{moving ? 'Moving…' : 'Move to Bills'}</Button>
    </div>
  );
}

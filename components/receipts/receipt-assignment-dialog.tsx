'use client';

import { useState, useEffect } from 'react';
import { Check, Users, Share2, Lock, Home, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useHouseholds } from '@/lib/hooks/use-households';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { HouseholdWithMembers } from '@/lib/types/api-responses';
import { Badge } from '@/components/ui/badge';

interface ReceiptAssignmentDialogProps {
  receiptId: string;
  currentHouseholdId?: string;
  isOwner?: boolean;
  canRemoveOnly?: boolean;
  children: React.ReactNode;
}

export function ReceiptAssignmentDialog({
  receiptId,
  currentHouseholdId,
  isOwner = true,
  canRemoveOnly = false,
  children,
}: ReceiptAssignmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string>(
    currentHouseholdId || '__personal__',
  );

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedHouseholdId(currentHouseholdId || '__personal__');
    }
  }, [open, currentHouseholdId]);

  const { data: households = [] } = useHouseholds() as { data: HouseholdWithMembers[] };
  const queryClient = useQueryClient();

  const assignReceipt = useMutation({
    mutationFn: async (householdId: string | null) => {
      const response = await fetch(`/api/receipts/${receiptId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to assign receipt');
      }

      return response.json();
    },
    onSuccess: (_data, householdId) => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['receipt', receiptId] });

      if (householdId === null) {
        toast.success('Receipt is now private', {
          description: 'This receipt is only visible to you.',
        });
      } else {
        const household = households.find(h => h.id === householdId);
        toast.success(`Shared with ${household?.name || 'household'}`, {
          description: 'Household members can now see this receipt.',
        });
      }
      setOpen(false);
    },
    onError: (error) => {
      toast.error('Failed to update receipt', {
        description: error.message,
      });
    },
  });

  const handleAssign = () => {
    const householdId = selectedHouseholdId === '__personal__' ? null : selectedHouseholdId;
    assignReceipt.mutate(householdId);
  };

  const hasChanges = (currentHouseholdId || '__personal__') !== selectedHouseholdId;
  const isCurrentlyShared = !!currentHouseholdId;
  const currentHousehold = households.find(h => h.id === currentHouseholdId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Share2 className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">
            {canRemoveOnly ? 'Remove from household' : 'Share receipt'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {canRemoveOnly
              ? 'Remove this receipt from the shared household'
              : 'Choose who can see this receipt'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current status indicator */}
          {isCurrentlyShared && !canRemoveOnly && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span>Currently shared with</span>
              <Badge variant="secondary" className="font-medium">
                <Users className="h-3 w-3 mr-1" />
                {currentHousehold?.name || 'Unknown'}
              </Badge>
            </div>
          )}

          {/* Options */}
          <div className="space-y-2">
            {/* Personal/Private option */}
            {(isOwner || canRemoveOnly) && (
              <button
                type="button"
                onClick={() => setSelectedHouseholdId('__personal__')}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  selectedHouseholdId === '__personal__'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-muted-foreground/30 hover:bg-muted/50'
                }`}
              >
                <div className={`p-2.5 rounded-lg ${
                  selectedHouseholdId === '__personal__'
                    ? 'bg-primary/10'
                    : 'bg-muted'
                }`}>
                  <Lock className={`h-5 w-5 ${
                    selectedHouseholdId === '__personal__' ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">
                    {canRemoveOnly ? 'Make private' : 'Keep private'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Only visible to you
                  </p>
                </div>
                {selectedHouseholdId === '__personal__' && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-4 w-4" />
                  </div>
                )}
              </button>
            )}

            {/* Household options - only for owners and not canRemoveOnly */}
            {isOwner && !canRemoveOnly && households.length > 0 && (
              <>
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or share with
                    </span>
                  </div>
                </div>

                {households.map(household => (
                  <button
                    key={household.id}
                    type="button"
                    onClick={() => setSelectedHouseholdId(household.id)}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      selectedHouseholdId === household.id
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-muted-foreground/30 hover:bg-muted/50'
                    }`}
                  >
                    <div className={`p-2.5 rounded-lg ${
                      selectedHouseholdId === household.id
                        ? 'bg-primary/10'
                        : 'bg-muted'
                    }`}>
                      <Home className={`h-5 w-5 ${
                        selectedHouseholdId === household.id ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium">{household.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {household.memberCount || 0} {(household.memberCount || 0) === 1 ? 'member' : 'members'}
                      </p>
                    </div>
                    {selectedHouseholdId === household.id && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-4 w-4" />
                      </div>
                    )}
                    {currentHouseholdId === household.id && selectedHouseholdId !== household.id && (
                      <Badge variant="outline" className="text-xs">Current</Badge>
                    )}
                  </button>
                ))}
              </>
            )}

            {/* No households message */}
            {isOwner && !canRemoveOnly && households.length === 0 && (
              <div className="text-center py-4 px-3 rounded-lg bg-muted/50">
                <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No households yet. Create one in Sharing to share receipts.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={assignReceipt.isPending}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={assignReceipt.isPending || !hasChanges}
            className="flex-1"
            variant={canRemoveOnly && selectedHouseholdId === '__personal__' ? 'destructive' : 'default'}
          >
            {assignReceipt.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : canRemoveOnly ? (
              <>
                <X className="h-4 w-4 mr-2" aria-hidden="true" />
                Remove from household
              </>
            ) : !hasChanges ? (
              /* Nothing picked yet. The disabled button used to say "Make Private" about a
                 receipt that was already private. */
              selectedHouseholdId === '__personal__' ? (
                <>
                  <Lock className="h-4 w-4 mr-2" aria-hidden="true" />
                  Already private
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" aria-hidden="true" />
                  Already shared here
                </>
              )
            ) : selectedHouseholdId === '__personal__' ? (
              <>
                <Lock className="h-4 w-4 mr-2" aria-hidden="true" />
                Make private
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4 mr-2" aria-hidden="true" />
                Share receipt
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

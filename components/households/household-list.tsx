'use client';

import { HouseholdCard, type HouseholdSummary } from '@/components/households/household-card';
import { Users, Share2, Receipt } from 'lucide-react';

type HouseholdWithDetails = HouseholdSummary;

interface HouseholdListProps {
  households: HouseholdWithDetails[]
  isSubscribed?: boolean
  onUpdate: () => void
  onSelect?: (household: HouseholdWithDetails) => void
  selectedId?: string
}

export function HouseholdList({
  households,
  isSubscribed = false,
  onUpdate,
  onSelect,
  selectedId,
}: HouseholdListProps) {
  if (households.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-muted-foreground/25 p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Users className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="font-medium text-foreground mb-1">No households yet</p>
        <p className="text-sm text-muted-foreground mb-4">
          Create your first household to start sharing receipts
        </p>
        <div className="flex justify-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Share2 className="h-3.5 w-3.5" />
            <span>Share expenses</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5" />
            <span>Split receipts</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {households.map((household) => (
        <div
          key={household.id}
          onClick={() => onSelect?.(household)}
          className={`cursor-pointer transition-all duration-200 rounded-lg ${
            selectedId === household.id
              ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
              : selectedId
              ? 'opacity-60 hover:opacity-100'
              : 'hover:shadow-md'
          }`}
        >
          <HouseholdCard
            household={household}
            isSubscribed={isSubscribed}
            onUpdate={onUpdate}
          />
        </div>
      ))}
    </div>
  );
}

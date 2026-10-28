'use client';

import { Gift, Tag, Percent } from 'lucide-react';
import type { OCRData } from '@/lib/types/api-responses';

interface ReceiptLoyaltyDetailsProps {
  ocrData: OCRData | null
}

export function ReceiptLoyaltyDetails({ ocrData }: ReceiptLoyaltyDetailsProps) {
  if (!ocrData?.loyaltyNumber && !ocrData?.specialOffers) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Gift className="h-4 w-4" />
        Loyalty and offers
      </div>
        <div className="grid grid-cols-1 gap-2">
          {ocrData?.loyaltyNumber && (
            <div className="flex items-center gap-2 text-sm">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span>Member: {ocrData.loyaltyNumber}</span>
            </div>
          )}
          {ocrData?.specialOffers && (
            <div className="flex items-center gap-2 text-sm">
              <Percent className="h-4 w-4 text-muted-foreground" />
              <span>{ocrData.specialOffers}</span>
            </div>
          )}
        </div>
      </div>
  );
}

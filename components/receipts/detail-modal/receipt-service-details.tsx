'use client';

import { Utensils, Hash, UserCheck, Users } from 'lucide-react';
import type { OCRData } from '@/lib/types/api-responses';

interface ReceiptServiceDetailsProps {
  ocrData: OCRData | null;
}

export function ReceiptServiceDetails({ ocrData }: ReceiptServiceDetailsProps) {
  if (!ocrData?.tableNumber && !ocrData?.serverName && !ocrData?.customerCount) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Utensils className="h-4 w-4" />
        Service details
      </div>
        <div className="grid grid-cols-1 gap-2">
          {ocrData?.tableNumber && (
            <div className="flex items-center gap-2 text-sm">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span>Table {ocrData.tableNumber}</span>
            </div>
          )}
          {ocrData?.serverName && (
            <div className="flex items-center gap-2 text-sm">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              <span>Server: {ocrData.serverName}</span>
            </div>
          )}
          {ocrData?.customerCount && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>Covers: {ocrData.customerCount}</span>
            </div>
          )}
        </div>
      </div>
  );
}

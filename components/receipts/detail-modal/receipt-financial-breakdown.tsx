'use client';

import { CreditCard } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import type { ReceiptWithItems, OCRData } from '@/lib/types/api-responses';

interface ReceiptFinancialBreakdownProps {
  receipt: ReceiptWithItems
}

export function ReceiptFinancialBreakdown({ receipt }: ReceiptFinancialBreakdownProps) {
  const ocrData = receipt.ocrData as OCRData | null;
  const tax = receipt.tax ? parseFloat(receipt.tax) : 0;
  const serviceCharge = receipt.serviceCharge ? parseFloat(receipt.serviceCharge) : 0;
  const tips = ocrData?.tips ? parseFloat(String(ocrData.tips)) : 0;
  const deliveryFee = ocrData?.deliveryFee ? parseFloat(String(ocrData.deliveryFee)) : 0;
  const packagingFee = ocrData?.packagingFee ? parseFloat(String(ocrData.packagingFee)) : 0;
  const discount = ocrData?.discount ? parseFloat(String(ocrData.discount)) : 0;

  const hasCharges = tax > 0 || serviceCharge > 0 || tips > 0 || deliveryFee > 0 || packagingFee > 0;
  const hasDiscount = discount > 0;
  const hasDetails = receipt.subtotal || hasCharges || hasDiscount;

  return (
    <div className="bg-background p-4 space-y-3 shrink-0">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <CreditCard className="h-3.5 w-3.5" />
        Financial Breakdown
      </div>

      {/* Only show detailed breakdown if there are details */}
      {hasDetails && (
        <div className="space-y-2 p-3 rounded-lg bg-muted/30">
          {receipt.subtotal && (
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Subtotal</span>
              <span className="text-sm font-semibold">
                {receipt.currency} {receipt.subtotal}
              </span>
            </div>
          )}

          {/* Charges Section */}
          {hasCharges && (
            <>
              {receipt.subtotal && <Separator className="my-1.5" />}
              <div className="space-y-1.5">
                {tax > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Tax</span>
                    <span className="text-sm font-medium">
                      +{receipt.currency} {receipt.tax}
                    </span>
                  </div>
                )}

                {serviceCharge > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Service Charge</span>
                    <span className="text-sm font-medium">
                      +{receipt.currency} {receipt.serviceCharge}
                    </span>
                  </div>
                )}

                {tips > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Tips</span>
                    <span className="text-sm font-medium">
                      +{receipt.currency} {String(ocrData?.tips || '')}
                    </span>
                  </div>
                )}

                {deliveryFee > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Delivery Fee</span>
                    <span className="text-sm font-medium">
                      +{receipt.currency} {String(ocrData?.deliveryFee || '')}
                    </span>
                  </div>
                )}

                {packagingFee > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Packaging Fee</span>
                    <span className="text-sm font-medium">
                      +{receipt.currency} {String(ocrData?.packagingFee || '')}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Discounts Section */}
          {hasDiscount && discount > 0 && (
            <>
              <Separator className="my-1.5" />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Discount</span>
                <span className="amount text-sm font-medium text-success">
                  -{receipt.currency} {String(ocrData?.discount || '')}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Total Section - Always show */}
      <div className="p-3 rounded-lg bg-primary/10 border-2 border-primary/30">
        <div className="flex justify-between items-center">
          <span className="text-base font-bold text-primary">Total Amount</span>
          <span className="text-xl font-bold text-primary">
            {receipt.currency} {receipt.totalAmount}
          </span>
        </div>
      </div>
    </div>
  );
}

import { CreditCard } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useCurrency } from '@/lib/hooks/use-currency';
import { formatCurrency } from '@/lib/utils/currency';
import type { ReceiptWithItems, OCRData } from '@/lib/types/api-responses';

interface ReceiptFinancialBreakdownProps {
  receipt: ReceiptWithItems
}

function amount(value: unknown): number {
  const parsed = parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

/*
 * Every figure here was the raw stored string after the ISO code ("EUR 2.8"); they go through
 * formatCurrency now.
 *
 * Tax was always shown as "+EUR 4.23", as if added on top. On Irish and most EU receipts VAT is
 * already inside the total, so it is only shown as added when the subtotal plus tax plus the
 * other charges actually comes to the total; otherwise it is labelled as included.
 */
export function ReceiptFinancialBreakdown({ receipt }: ReceiptFinancialBreakdownProps) {
  const { currency: userCurrency } = useCurrency();
  const currency = receipt.currency || userCurrency;
  const money = (value: number) => formatCurrency(value, currency);

  const ocrData = receipt.ocrData as OCRData | null;
  const total = amount(receipt.totalAmount);
  const subtotal = receipt.subtotal ? amount(receipt.subtotal) : null;
  const tax = amount(receipt.tax);
  const serviceCharge = amount(receipt.serviceCharge);
  const tips = amount(ocrData?.tips);
  const deliveryFee = amount(ocrData?.deliveryFee);
  const packagingFee = amount(ocrData?.packagingFee);
  const discount = amount(ocrData?.discount);

  const otherCharges = serviceCharge + tips + deliveryFee + packagingFee - discount;
  const taxAddedOnTop = tax > 0 && subtotal !== null && Math.abs(subtotal + tax + otherCharges - total) < 0.015;

  const hasCharges = tax > 0 || serviceCharge > 0 || tips > 0 || deliveryFee > 0 || packagingFee > 0;
  const hasDiscount = discount > 0;
  const hasDetails = subtotal !== null || hasCharges || hasDiscount;

  const charges = [
    { label: 'Service charge', value: serviceCharge },
    { label: 'Tips', value: tips },
    { label: 'Delivery fee', value: deliveryFee },
    { label: 'Packaging fee', value: packagingFee },
  ].filter((charge) => charge.value > 0);

  return (
    <div className="bg-background p-4 space-y-3 shrink-0">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
        Breakdown
      </div>

      {/* Only show detailed breakdown if there are details */}
      {hasDetails && (
        <div className="space-y-2 p-3 rounded-lg bg-muted/30">
          {subtotal !== null && (
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Subtotal</span>
              <span className="amount text-sm font-semibold">{money(subtotal)}</span>
            </div>
          )}

          {/* Charges Section */}
          {hasCharges && (
            <>
              {subtotal !== null && <Separator className="my-1.5" />}
              <div className="space-y-1.5">
                {tax > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {taxAddedOnTop ? 'Tax' : 'VAT (included)'}
                    </span>
                    <span className="amount text-sm font-medium">
                      {taxAddedOnTop ? '+' : ''}{money(tax)}
                    </span>
                  </div>
                )}

                {charges.map((charge) => (
                  <div key={charge.label} className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{charge.label}</span>
                    <span className="amount text-sm font-medium">+{money(charge.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Discounts Section */}
          {hasDiscount && (
            <>
              <Separator className="my-1.5" />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Discount</span>
                <span className="amount text-sm font-medium text-success">−{money(discount)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Total Section - Always show */}
      <div className="p-3 rounded-lg bg-primary/10 border-2 border-primary/30">
        <div className="flex justify-between items-center">
          <span className="text-base font-bold text-primary">Total</span>
          <span className="amount text-xl font-bold text-primary">{money(total)}</span>
        </div>
      </div>
    </div>
  );
}

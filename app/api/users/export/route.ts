import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { receipts, receiptItems, subscriptions, subscriptionPayments, households, householdUsers, users } from '@/lib/db/schema';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';

export const runtime = 'nodejs';

/**
 * GET /api/users/export
 * Export user data in CSV or JSON format
 * Query params:
 * - format: 'csv' | 'json' (default: csv)
 * - type: 'receipts' | 'subscriptions' | 'all' (default: all)
 */
export async function GET(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;

  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'csv';
    const type = searchParams.get('type') || 'all';

    // Fetch user's receipts with items
    const userReceipts = await db
      .select({
        id: receipts.id,
        imageUrl: receipts.imageUrl,
        merchantName: receipts.merchantName,
        totalAmount: receipts.totalAmount,
        currency: receipts.currency,
        transactionDate: receipts.transactionDate,
        category: receipts.category,
        paymentMethod: receipts.paymentMethod,
        location: receipts.location,
        tax: receipts.tax,
        serviceCharge: receipts.serviceCharge,
        subtotal: receipts.subtotal,
        receiptNumber: receipts.receiptNumber,
        isBusinessExpense: receipts.isBusinessExpense,
        businessCategory: receipts.businessCategory,
        businessNotes: receipts.businessNotes,
        taxDeductible: receipts.taxDeductible,
        createdAt: receipts.createdAt,
      })
      .from(receipts)
      .where(
        and(
          eq(receipts.userId, user.id),
          isNull(receipts.deletedAt),
        ),
      )
      .orderBy(receipts.transactionDate);

    // Line items for every exported receipt. They were only included in the
    // receipts-with-images variant, so the "all data" export — the one offered for data
    // portability — silently left out every line item.
    const receiptIds = userReceipts.map(r => r.id);
    const allItems = receiptIds.length > 0 ? await db
      .select({
        receiptId: receiptItems.receiptId,
        name: receiptItems.name,
        quantity: receiptItems.quantity,
        unitPrice: receiptItems.unitPrice,
        price: receiptItems.price,
        totalPrice: receiptItems.totalPrice,
        category: receiptItems.category,
        description: receiptItems.description,
        modifiers: receiptItems.modifiers,
      })
      .from(receiptItems)
      .where(inArray(receiptItems.receiptId, receiptIds))
      : [];

    const itemsByReceipt = new Map<string, typeof allItems>();
    for (const item of allItems) {
      const list = itemsByReceipt.get(item.receiptId) || [];
      list.push(item);
      itemsByReceipt.set(item.receiptId, list);
    }
    const receiptsWithItems = userReceipts.map(receipt => ({
      ...receipt,
      items: itemsByReceipt.get(receipt.id) || [],
    }));

    // Fetch user's subscriptions with payments
    const userSubscriptions = await db
      .select({
        id: subscriptions.id,
        name: subscriptions.name,
        description: subscriptions.description,
        category: subscriptions.category,
        amount: subscriptions.amount,
        currency: subscriptions.currency,
        billingFrequency: subscriptions.billingFrequency,
        billingDay: subscriptions.billingDay,
        status: subscriptions.status,
        startDate: subscriptions.startDate,
        nextBillingDate: subscriptions.nextBillingDate,
        lastPaymentDate: subscriptions.lastPaymentDate,
        isBusinessExpense: subscriptions.isBusinessExpense,
        website: subscriptions.website,
        notes: subscriptions.notes,
        createdAt: subscriptions.createdAt,
      })
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.id))
      .orderBy(subscriptions.createdAt);

    // Fetch subscription payments
    const subscriptionIds = userSubscriptions.map(s => s.id);
    const payments = subscriptionIds.length > 0 ? await db
      .select({
        subscriptionId: subscriptionPayments.subscriptionId,
        expectedDate: subscriptionPayments.expectedDate,
        expectedAmount: subscriptionPayments.expectedAmount,
        status: subscriptionPayments.status,
        actualDate: subscriptionPayments.actualDate,
        actualAmount: subscriptionPayments.actualAmount,
        notes: subscriptionPayments.notes,
        createdAt: subscriptionPayments.createdAt,
      })
      .from(subscriptionPayments)
      .where(inArray(subscriptionPayments.subscriptionId, subscriptionIds))
      : [];

    // Fetch household memberships
    const userHouseholds = await db
      .select({
        householdId: householdUsers.householdId,
        role: householdUsers.role,
        householdName: households.name,
        joinedAt: householdUsers.createdAt,
      })
      .from(householdUsers)
      .innerJoin(households, eq(householdUsers.householdId, households.id))
      .where(eq(householdUsers.userId, user.id));

    // Update last exported timestamp
    await db
      .update(users)
      .set({ lastExportedAt: new Date() })
      .where(eq(users.id, user.id));

    submitLogEvent('user', `User exported data: format=${format}, type=${type}`, correlationId, { userId: user.id });

    // Generate export based on format
    if (format === 'json') {
      const exportData: Record<string, unknown> = {
        exportDate: new Date().toISOString(),
        user: {
          email: user.email,
          subscribed: user.subscribed,
          createdAt: user.createdAt,
        },
      };

      if (type === 'receipts-with-images') {
        exportData.receipts = receiptsWithItems;

        return NextResponse.json(exportData, {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'private, no-store',
          },
        });
      }

      if (type === 'receipts' || type === 'all') {
        exportData.receipts = receiptsWithItems;
      }

      if (type === 'subscriptions' || type === 'all') {
        exportData.subscriptions = userSubscriptions.map(sub => ({
          ...sub,
          payments: payments.filter(p => p.subscriptionId === sub.id),
        }));
      }

      if (type === 'all') {
        exportData.households = userHouseholds;
      }

      return NextResponse.json(exportData, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="receiptwise-export-${new Date().toISOString().split('T')[0]}.json"`,
          'Cache-Control': 'private, no-store',
        },
      });
    } else {
      // CSV format. Every field goes through csvField — previously only a few were escaped, so
      // a comma in a category or payment method shifted every column after it.
      const row = (fields: unknown[]) => fields.map(csvField).join(',') + '\n';
      const day = (date: Date | null | undefined) => date?.toISOString().split('T')[0] || '';
      let csvContent = '';

      if (type === 'receipts' || type === 'all') {
        csvContent += 'RECEIPTS\n';
        csvContent += row(['Receipt ID', 'Merchant', 'Amount', 'Currency', 'Date', 'Category', 'Payment Method', 'Location', 'Tax', 'Subtotal', 'Service Charge', 'Receipt Number', 'Business Expense', 'Business Category', 'Business Notes', 'Tax Deductible', 'Created At']);

        userReceipts.forEach(receipt => {
          csvContent += row([
            receipt.id,
            receipt.merchantName,
            receipt.totalAmount,
            receipt.currency,
            receipt.transactionDate,
            receipt.category,
            receipt.paymentMethod,
            receipt.location,
            receipt.tax,
            receipt.subtotal,
            receipt.serviceCharge,
            receipt.receiptNumber,
            receipt.isBusinessExpense ? 'Yes' : 'No',
            receipt.businessCategory,
            receipt.businessNotes,
            receipt.taxDeductible ? 'Yes' : 'No',
            receipt.createdAt?.toISOString(),
          ]);
        });
        csvContent += '\n';

        csvContent += 'RECEIPT ITEMS\n';
        csvContent += row(['Receipt ID', 'Merchant', 'Date', 'Item', 'Quantity', 'Unit Price', 'Total Price', 'Category', 'Description']);

        userReceipts.forEach(receipt => {
          (itemsByReceipt.get(receipt.id) || []).forEach(item => {
            csvContent += row([
              receipt.id,
              receipt.merchantName,
              receipt.transactionDate,
              item.name,
              item.quantity,
              item.unitPrice,
              item.totalPrice ?? item.price,
              item.category,
              item.description,
            ]);
          });
        });
        csvContent += '\n';
      }

      if (type === 'subscriptions' || type === 'all') {
        csvContent += 'SUBSCRIPTIONS\n';
        csvContent += row(['Name', 'Description', 'Category', 'Amount', 'Currency', 'Billing Frequency', 'Billing Day', 'Status', 'Start Date', 'Next Billing', 'Last Payment', 'Business Expense', 'Website', 'Notes', 'Created At']);

        userSubscriptions.forEach(sub => {
          csvContent += row([
            sub.name,
            sub.description,
            sub.category,
            sub.amount,
            sub.currency,
            sub.billingFrequency,
            sub.billingDay,
            sub.status,
            day(sub.startDate),
            day(sub.nextBillingDate),
            day(sub.lastPaymentDate),
            sub.isBusinessExpense ? 'Yes' : 'No',
            sub.website,
            sub.notes,
            sub.createdAt?.toISOString(),
          ]);
        });
        csvContent += '\n';

        csvContent += 'SUBSCRIPTION PAYMENTS\n';
        csvContent += row(['Subscription', 'Expected Date', 'Expected Amount', 'Status', 'Actual Date', 'Actual Amount', 'Notes']);

        payments.forEach(payment => {
          const sub = userSubscriptions.find(s => s.id === payment.subscriptionId);
          csvContent += row([
            sub?.name,
            day(payment.expectedDate),
            payment.expectedAmount,
            payment.status,
            day(payment.actualDate),
            payment.actualAmount,
            payment.notes,
          ]);
        });
        csvContent += '\n';
      }

      if (type === 'all') {
        csvContent += 'HOUSEHOLDS\n';
        csvContent += row(['Household Name', 'Role', 'Joined At']);

        userHouseholds.forEach(household => {
          csvContent += row([
            household.householdName,
            household.role,
            household.joinedAt?.toISOString(),
          ]);
        });
      }

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="receiptwise-export-${new Date().toISOString().split('T')[0]}.csv"`,
          'Cache-Control': 'private, no-store',
        },
      });
    }
  } catch (error) {
    submitLogEvent('user', `Error exporting data: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 },
    );
  }
}

/**
 * Render one CSV field.
 *
 * Quotes anything containing a comma, quote or line break. Also neutralises spreadsheet formula
 * injection: merchant names, item names and notes come from OCR of arbitrary images (or from
 * the user), and a cell starting with =, +, -, @, tab or CR is executed as a formula by Excel
 * and Sheets. Those get a leading apostrophe so they display as text. Plain negative numbers
 * are left alone so amounts stay numeric.
 */
function csvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);

  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) {
    text = `'${text}`;
  }

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

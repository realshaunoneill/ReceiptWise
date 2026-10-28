import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import {
  receipts,
  receiptItems,
  subscriptions,
  subscriptionPayments,
  households,
  householdUsers,
  users,
  financialAccounts,
  accountBalances,
  incomeSources,
  planEntries,
  savingsGoals,
  savingsGoalContributions,
  planAmounts,
  billDocuments,
  premiumGrants,
} from '@/lib/db/schema';
import { eq, and, isNull, inArray, or } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';

export const runtime = 'nodejs';

/**
 * GET /api/users/export
 * Export user data in CSV or JSON format
 * Query params:
 * - format: 'csv' | 'json' (default: csv)
 * - type: 'receipts' | 'subscriptions' | 'all' (default: all). 'all' includes the monthly plan:
 *   income, one-off plan entries, savings goals and contributions, one month's own pay or savings
 *   amounts, accounts and balances.
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
        customFrequencyDays: subscriptions.customFrequencyDays,
        status: subscriptions.status,
        startDate: subscriptions.startDate,
        endDate: subscriptions.endDate,
        nextBillingDate: subscriptions.nextBillingDate,
        lastPaymentDate: subscriptions.lastPaymentDate,
        isBusinessExpense: subscriptions.isBusinessExpense,
        kind: subscriptions.kind,
        amountType: subscriptions.amountType,
        paymentMethod: subscriptions.paymentMethod,
        accountReference: subscriptions.accountReference,
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
        amountSource: subscriptionPayments.amountSource,
        dueDate: subscriptionPayments.dueDate,
        status: subscriptionPayments.status,
        actualDate: subscriptionPayments.actualDate,
        actualAmount: subscriptionPayments.actualAmount,
        paidVia: subscriptionPayments.paidVia,
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

    // The monthly plan (everything the user owns; shared rows other members own are theirs)
    const [userIncome, userEntries, userGoals, userAccounts, userBills] = type === 'all'
      ? await Promise.all([
        db.select().from(incomeSources).where(eq(incomeSources.userId, user.id)),
        db.select().from(planEntries).where(eq(planEntries.userId, user.id)).orderBy(planEntries.date),
        db.select().from(savingsGoals).where(eq(savingsGoals.userId, user.id)),
        db.select().from(financialAccounts).where(eq(financialAccounts.userId, user.id)),
        // What was read off each bill; the files themselves are downloadable in the app.
        db.select({
          fileName: billDocuments.fileName, source: billDocuments.source, documentType: billDocuments.documentType,
          provider: billDocuments.provider, amountDue: billDocuments.amountDue, currency: billDocuments.currency,
          dueDate: billDocuments.dueDate, issueDate: billDocuments.issueDate, periodStart: billDocuments.periodStart,
          periodEnd: billDocuments.periodEnd, reviewStatus: billDocuments.reviewStatus, appliedAs: billDocuments.appliedAs,
          createdAt: billDocuments.createdAt,
        }).from(billDocuments).where(and(eq(billDocuments.userId, user.id), isNull(billDocuments.deletedAt))),
      ])
      : [[], [], [], [], []];
    const [userContributions, userBalances, userMonthAmounts] = await Promise.all([
      userGoals.length === 0 ? [] : db.select().from(savingsGoalContributions)
        .where(inArray(savingsGoalContributions.goalId, userGoals.map((goal) => goal.id))),
      userAccounts.length === 0 ? [] : db.select().from(accountBalances)
        .where(inArray(accountBalances.accountId, userAccounts.map((account) => account.id)))
        .orderBy(accountBalances.asOfDate),
      userIncome.length + userGoals.length === 0 ? [] : db
        .select({ incomeId: planAmounts.incomeId, goalId: planAmounts.goalId, day: planAmounts.day, amount: planAmounts.amount })
        .from(planAmounts)
        .where(or(
          userIncome.length ? inArray(planAmounts.incomeId, userIncome.map((income) => income.id)) : undefined,
          userGoals.length ? inArray(planAmounts.goalId, userGoals.map((goal) => goal.id)) : undefined,
        ))
        .orderBy(planAmounts.day),
    ]);
    const monthAmounts = (column: 'incomeId' | 'goalId', id: string) => userMonthAmounts
      .filter((amount) => amount[column] === id)
      .map(({ day: on, amount }) => ({ day: on, amount }));

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
        // Where Premium comes from (the website, an app store, or given by hand), not the
        // provider's ids or internal notes.
        exportData.premium = (await db.select().from(premiumGrants).where(eq(premiumGrants.userId, user.id)))
          .map(({ source, status, productId, expiresAt, willRenew, createdAt, updatedAt }) => ({
            source, status, productId, expiresAt, willRenew, createdAt, updatedAt,
          }));
        exportData.households = userHouseholds;
        exportData.plan = {
          income: userIncome.map(({ userId: _userId, ...income }) => ({ ...income, monthAmounts: monthAmounts('incomeId', income.id) })),
          entries: userEntries.map(({ userId: _userId, ...entry }) => entry),
          savingsGoals: userGoals.map(({ userId: _userId, ...goal }) => ({
            ...goal,
            contributions: userContributions.filter((c) => c.goalId === goal.id),
            monthAmounts: monthAmounts('goalId', goal.id),
          })),
          accounts: userAccounts.map(({ userId: _userId, ...account }) => ({
            ...account,
            balances: userBalances.filter((b) => b.accountId === account.id),
          })),
          bills: userBills,
        };
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
        csvContent += row(['Name', 'Kind', 'Description', 'Category', 'Amount', 'Amount Type', 'Currency', 'Billing Frequency', 'Billing Day', 'Payment Method', 'Status', 'Start Date', 'End Date', 'Next Billing', 'Last Payment', 'Business Expense', 'Website', 'Notes', 'Created At']);

        userSubscriptions.forEach(sub => {
          csvContent += row([
            sub.name,
            sub.kind,
            sub.description,
            sub.category,
            sub.amount,
            sub.amountType,
            sub.currency,
            sub.billingFrequency,
            sub.billingDay,
            sub.paymentMethod,
            sub.status,
            day(sub.startDate),
            day(sub.endDate),
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
        csvContent += row(['Subscription', 'Expected Date', 'Due Date', 'Expected Amount', 'Status', 'Paid Via', 'Actual Date', 'Actual Amount', 'Notes']);

        payments.forEach(payment => {
          const sub = userSubscriptions.find(s => s.id === payment.subscriptionId);
          csvContent += row([
            sub?.name,
            day(payment.expectedDate),
            payment.dueDate,
            payment.expectedAmount,
            payment.status,
            payment.paidVia,
            day(payment.actualDate),
            payment.actualAmount,
            payment.notes,
          ]);
        });
        csvContent += '\n';
      }

      if (type === 'all') {
        csvContent += 'INCOME\n';
        csvContent += row(['Name', 'Amount', 'Currency', 'Frequency', 'Pay Day', 'Anchor Date', 'Weekend Rule', 'Primary', 'Status', 'End Date']);
        userIncome.forEach((income) => {
          csvContent += row([income.name, income.amount, income.currency, income.frequency, income.payDay, income.anchorDate, income.weekendRule, income.isPrimary ? 'Yes' : 'No', income.status, income.endDate]);
        });
        csvContent += '\n';

        csvContent += 'PLAN ENTRIES\n';
        csvContent += row(['Date', 'Label', 'Amount', 'Currency', 'Direction', 'Category', 'Done', 'Notes']);
        userEntries.forEach((entry) => {
          csvContent += row([entry.date, entry.label, entry.amount, entry.currency, entry.direction, entry.category, entry.doneAt ? day(entry.doneAt) : '', entry.notes]);
        });
        csvContent += '\n';

        csvContent += 'SAVINGS GOALS\n';
        csvContent += row(['Name', 'Target', 'Currency', 'Target Date', 'Per Period', 'Saved', 'Status']);
        userGoals.forEach((goal) => {
          csvContent += row([goal.name, goal.targetAmount, goal.currency, goal.targetDate, goal.contributionPerCycle, goal.savedAmount, goal.status]);
        });
        csvContent += '\n';

        csvContent += 'SAVINGS CONTRIBUTIONS\n';
        csvContent += row(['Goal', 'Amount', 'Date']);
        userContributions.forEach((contribution) => {
          csvContent += row([userGoals.find((goal) => goal.id === contribution.goalId)?.name, contribution.amount, contribution.contributedOn]);
        });
        csvContent += '\n';

        csvContent += 'PAY AND SAVINGS FOR ONE MONTH\n';
        csvContent += row(['For', 'Name', 'Day', 'Amount']);
        userMonthAmounts.forEach((amount) => {
          const name = amount.incomeId
            ? userIncome.find((income) => income.id === amount.incomeId)?.name
            : userGoals.find((goal) => goal.id === amount.goalId)?.name;
          csvContent += row([amount.incomeId ? 'Pay' : 'Savings', name, amount.day, amount.amount]);
        });
        csvContent += '\n';

        csvContent += 'ACCOUNTS\n';
        csvContent += row(['Name', 'Kind', 'Currency', 'Counts Towards Plan', 'Institution', 'Last 4', 'Archived']);
        userAccounts.forEach((account) => {
          csvContent += row([account.name, account.kind, account.currency, account.includeInPlan ? 'Yes' : 'No', account.institution, account.last4, day(account.archivedAt)]);
        });
        csvContent += '\n';

        csvContent += 'ACCOUNT BALANCES\n';
        csvContent += row(['Account', 'Balance', 'As Of']);
        userBalances.forEach((balance) => {
          csvContent += row([userAccounts.find((account) => account.id === balance.accountId)?.name, balance.balance, balance.asOfDate]);
        });
        csvContent += '\n';

        csvContent += 'BILLS BROUGHT IN\n';
        csvContent += row(['File', 'Source', 'Type', 'Provider', 'Amount Due', 'Currency', 'Due Date', 'Bill Date', 'Status', 'Filed As', 'Added']);
        userBills.forEach((bill) => {
          csvContent += row([bill.fileName, bill.source, bill.documentType, bill.provider, bill.amountDue, bill.currency, bill.dueDate, bill.issueDate, bill.reviewStatus, bill.appliedAs, day(bill.createdAt)]);
        });
        csvContent += '\n';

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

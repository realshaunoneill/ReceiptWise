import { pgTable, uuid, text, boolean, timestamp, jsonb, unique, integer, index, uniqueIndex, date, numeric, type AnyPgColumn } from 'drizzle-orm/pg-core';

// Users Table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkId: text('clerk_id').notNull().unique(),
  email: text('email').notNull().unique(),
  subscribed: boolean('subscribed').notNull().default(false),
  isAdmin: boolean('is_admin').notNull().default(false),
  isBlocked: boolean('is_blocked').notNull().default(false), // Admin can block users from using the app
  blockedAt: timestamp('blocked_at'), // When the user was blocked
  blockedReason: text('blocked_reason'), // Reason for blocking
  stripeCustomerId: text('stripe_customer_id').unique(),
  defaultHouseholdId: uuid('default_household_id').references(() => households.id, { onDelete: 'set null' }),
  currency: text('currency').notNull().default('EUR'),
  onboardingCompletedAt: timestamp('onboarding_completed_at'),
  lastExportedAt: timestamp('last_exported_at'),
  deletionScheduledAt: timestamp('deletion_scheduled_at'), // When account is scheduled for deletion (24 hours from request)
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Households Table
export const households = pgTable('households', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Household Users Table
export const householdUsers = pgTable('household_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'owner' | 'member'
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  uniqueHouseholdUser: unique().on(table.householdId, table.userId),
}));

// Receipts Table
export const receipts = pgTable('receipts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // 'set null', not 'cascade': a receipt belongs to the person who uploaded it. Deleting a
  // household used to hard-delete every member's receipts (and their line items) along with it;
  // now they fall back to each owner's personal view.
  householdId: uuid('household_id').references(() => households.id, { onDelete: 'set null' }),
  imageUrl: text('image_url').notNull(),
  merchantName: text('merchant_name'),
  totalAmount: text('total_amount'),
  currency: text('currency'),
  transactionDate: text('transaction_date'),
  category: text('category'),
  paymentMethod: text('payment_method'),
  location: text('location'),
  tax: text('tax'),
  serviceCharge: text('service_charge'),
  subtotal: text('subtotal'),
  receiptNumber: text('receipt_number'),
  ocrData: jsonb('ocr_data'), // Full OCR response
  processingTokens: jsonb('processing_tokens'), // OpenAI token usage: { prompt_tokens, completion_tokens, total_tokens }
  processingStatus: text('processing_status').notNull().default('pending'), // 'pending' | 'processing' | 'completed' | 'failed'
  processingError: text('processing_error'), // Error message if processing failed
  isReceipt: boolean('is_receipt').default(true), // Whether this is actually a receipt (AI-detected)
  // Business expense fields
  isBusinessExpense: boolean('is_business_expense').default(false),
  businessCategory: text('business_category'),
  businessNotes: text('business_notes'),
  taxDeductible: boolean('tax_deductible').default(false),
  // Soft delete
  deletedAt: timestamp('deleted_at'), // Soft delete timestamp
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // Every list, search and insights query filters on owner or household plus deletedAt;
  // the table previously had no index beyond its primary key.
  userIdDeletedAtIdx: index('receipts_user_id_deleted_at_idx').on(table.userId, table.deletedAt),
  householdIdDeletedAtIdx: index('receipts_household_id_deleted_at_idx').on(table.householdId, table.deletedAt),
  // Serves the stuck-processing sweeper.
  processingStatusUpdatedAtIdx: index('receipts_processing_status_updated_at_idx').on(table.processingStatus, table.updatedAt),
}));

// Receipt Items Table
export const receiptItems = pgTable('receipt_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  receiptId: uuid('receipt_id').notNull().references(() => receipts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  quantity: text('quantity'),
  unitPrice: text('unit_price'),
  totalPrice: text('total_price'),
  price: text('price'), // Keep for backward compatibility
  category: text('category'),
  description: text('description'),
  modifiers: jsonb('modifiers'), // Array of { name, price, type }
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  receiptIdIdx: index('receipt_items_receipt_id_idx').on(table.receiptId),
}));

// Household Invitations Table
export const householdInvitations = pgTable('household_invitations', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  invitedByUserId: uuid('invited_by_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  invitedEmail: text('invited_email').notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'accepted' | 'declined' | 'expired'
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// API Keys Table - for Chrome extension and other integrations
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('Chrome Extension'),
  // SHA-256 hex digest of the key, never the key itself — the plaintext is shown once at creation.
  key: text('key').notNull().unique(),
  // First characters of the plaintext key, so the settings page can tell keys apart.
  keyPrefix: text('key_prefix'),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'), // NULL for non-expiring keys
  isRevoked: boolean('is_revoked').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('api_keys_user_id_idx').on(table.userId),
  keyIdx: index('api_keys_key_idx').on(table.key),
}));

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

// TypeScript Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Household = typeof households.$inferSelect;
export type NewHousehold = typeof households.$inferInsert;

export type HouseholdUser = typeof householdUsers.$inferSelect;
export type NewHouseholdUser = typeof householdUsers.$inferInsert;

export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$inferInsert;

export type ReceiptItem = typeof receiptItems.$inferSelect;
export type NewReceiptItem = typeof receiptItems.$inferInsert;

export type HouseholdInvitation = typeof householdInvitations.$inferSelect;
export type NewHouseholdInvitation = typeof householdInvitations.$inferInsert;

// Insights Cache Table - stores cached insights data for 24 hours
export const insightsCache = pgTable('insights_cache', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  householdId: uuid('household_id').references(() => households.id, { onDelete: 'cascade' }),
  cacheType: text('cache_type').notNull(), // 'spending_summary' | 'top_items'
  cacheKey: text('cache_key').notNull(), // Includes query params like months, limit, sortBy
  data: jsonb('data').notNull(), // The cached response data
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  uniqueCache: unique().on(table.userId, table.cacheType, table.cacheKey),
}));

export type InsightsCache = typeof insightsCache.$inferSelect;
export type NewInsightsCache = typeof insightsCache.$inferInsert;

// Subscriptions Table
//
// Every recurring payment the user tracks: subscriptions, and since the bills work, bills too
// (the UI calls the whole table "Bills"). The table and column names stay as they are because
// the build applies the schema with `drizzle-kit push --force`, which turns a rename into a drop
// and re-create. Only add nullable columns, or NOT NULL ones with a default.
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // 'set null' for the same reason as receipts.householdId: deleting a household must not
  // delete the subscriptions its members track.
  householdId: uuid('household_id').references(() => households.id, { onDelete: 'set null' }),

  // Subscription Details
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'), // 'Software', 'Streaming', 'Utilities', 'Insurance', etc.

  // Financial Info
  amount: text('amount').notNull(),
  currency: text('currency').notNull().default('EUR'),

  // Recurrence
  billingFrequency: text('billing_frequency').notNull(), // BILLING_FREQUENCIES in lib/schedule/billing-schedule.ts
  billingDay: integer('billing_day').notNull(), // Day of month (1-31)
  customFrequencyDays: integer('custom_frequency_days'), // For custom frequency

  // Status
  status: text('status').notNull().default('active'), // 'active', 'paused', 'cancelled'
  isBusinessExpense: boolean('is_business_expense').default(false),
  // When it was last paused, so resuming can mark the cycles it skipped instead of backfilling
  // them as missed. Cleared on resume.
  pausedAt: timestamp('paused_at'),

  // Bills
  kind: text('kind').notNull().default('subscription'), // 'subscription' | 'bill'
  amountType: text('amount_type').notNull().default('fixed'), // 'fixed' | 'variable' (amount is then the typical bill)
  paymentMethod: text('payment_method'), // 'direct_debit' | 'standing_order' | 'card' | 'manual'; null = not said (older rows)
  providerKey: text('provider_key'), // normalised provider name, for matching uploaded bills
  accountReference: text('account_reference'), // last 4 characters of the account/reference number only
  // The account it comes out of, for the plan's "left until payday" view. Null = the main account.
  paidFromAccountId: uuid('paid_from_account_id').references((): AnyPgColumn => financialAccounts.id, { onDelete: 'set null' }),

  // Dates
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'), // NULL for ongoing
  nextBillingDate: timestamp('next_billing_date').notNull(),
  lastPaymentDate: timestamp('last_payment_date'),

  // Metadata
  website: text('website'),
  notes: text('notes'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('subscriptions_user_id_idx').on(table.userId),
  householdIdIdx: index('subscriptions_household_id_idx').on(table.householdId),
  nextBillingDateIdx: index('subscriptions_next_billing_date_idx').on(table.nextBillingDate),
  statusIdx: index('subscriptions_status_idx').on(table.status),
}));

// Subscription Payments (Links receipts to subscriptions)
export const subscriptionPayments = pgTable('subscription_payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  subscriptionId: uuid('subscription_id').notNull().references(() => subscriptions.id, { onDelete: 'cascade' }),
  receiptId: uuid('receipt_id').references(() => receipts.id, { onDelete: 'set null' }),

  // Payment Info
  expectedDate: timestamp('expected_date').notNull(),
  expectedAmount: text('expected_amount').notNull(),

  // The real due date when a bill gives one that differs from the schedule's cycle date. The
  // cycle date (expectedDate) stays the key that identifies the occurrence.
  dueDate: date('due_date'),
  // Where expectedAmount came from: 'estimate' (the item's usual amount), 'bill' (read from an
  // uploaded bill), 'manual' (typed in for this occurrence) or 'receipt'.
  amountSource: text('amount_source').notNull().default('estimate'),
  currency: text('currency'), // null = the subscription's currency

  // Status
  status: text('status').notNull().default('pending'), // 'pending', 'paid', 'missed', 'skipped', 'cancelled'

  // Actual payment
  actualDate: timestamp('actual_date'),
  actualAmount: text('actual_amount'),
  // How it came to be paid: 'receipt' (a receipt was linked), 'manual' (someone marked it), or
  // 'assumed' (a direct debit or standing order whose collection date passed). Null on older rows.
  paidVia: text('paid_via'),
  markedByUserId: uuid('marked_by_user_id').references(() => users.id, { onDelete: 'set null' }),

  // Metadata
  notes: text('notes'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  subscriptionIdIdx: index('subscription_payments_subscription_id_idx').on(table.subscriptionId),
  receiptIdIdx: index('subscription_payments_receipt_id_idx').on(table.receiptId),
  expectedDateIdx: index('subscription_payments_expected_date_idx').on(table.expectedDate),
  statusIdx: index('subscription_payments_status_idx').on(table.status),
  // One row per cycle. Generation used to run on every list request with no lock and created
  // duplicates; inserts now ignore conflicts against this. A uniqueIndex, not unique(): adding a
  // unique constraint to a table with rows makes `drizzle-kit push` stop at an interactive
  // prompt, even with --force, which would hang the Vercel build.
  subscriptionCycleUnique: uniqueIndex('subscription_payments_subscription_cycle_uidx').on(table.subscriptionId, table.expectedDate),
}));

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export type SubscriptionPayment = typeof subscriptionPayments.$inferSelect;
export type NewSubscriptionPayment = typeof subscriptionPayments.$inferInsert;

// ---------------------------------------------------------------------------------------------
// The monthly plan (bills & budget). All of these follow the receipts/subscriptions ownership
// shape: an owner, optionally shared with one household (see lib/services/finance-access.ts).
// Money is numeric(12,2), which Drizzle returns as a string; calendar days are Postgres `date`,
// returned as YYYY-MM-DD strings. Additive changes only: the build applies this with
// `drizzle-kit push --force`.
// ---------------------------------------------------------------------------------------------

const money = (name: string) => numeric(name, { precision: 12, scale: 2 });

// Bank accounts, for the optional "left until payday" view. Balances are typed in by hand; there
// is no bank connection.
export const financialAccounts = pgTable('financial_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  householdId: uuid('household_id').references(() => households.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  kind: text('kind').notNull().default('current'), // 'current' | 'savings' | 'cash'
  currency: text('currency').notNull().default('EUR'),
  // Whether its balance counts towards "left until payday". Savings accounts default to no.
  includeInPlan: boolean('include_in_plan').notNull().default(true),
  institution: text('institution'),
  last4: text('last4'),
  sortOrder: integer('sort_order').notNull().default(0),
  archivedAt: timestamp('archived_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('financial_accounts_user_id_idx').on(table.userId),
  householdIdIdx: index('financial_accounts_household_id_idx').on(table.householdId),
}));

// Balance history: the latest entry (newest as_of_date, then newest created_at) is the balance.
export const accountBalances = pgTable('account_balances', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').notNull().references(() => financialAccounts.id, { onDelete: 'cascade' }),
  balance: money('balance').notNull(),
  asOfDate: date('as_of_date').notNull(),
  enteredByUserId: uuid('entered_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  accountAsOfIdx: index('account_balances_account_as_of_idx').on(table.accountId, table.asOfDate, table.createdAt),
}));

// What comes in, and when. The active primary one sets the plan's period (payday to payday).
export const incomeSources = pgTable('income_sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  householdId: uuid('household_id').references(() => households.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  amount: money('amount').notNull(),
  currency: text('currency').notNull().default('EUR'),
  frequency: text('frequency').notNull().default('monthly'), // PAY_FREQUENCIES in lib/schedule/pay-schedule.ts
  payDay: integer('pay_day'), // 1-31, for 'monthly' (clamped to short months)
  anchorDate: date('anchor_date'), // any real payday, for 'weekly' | 'fortnightly' | 'four_weekly'
  weekendRule: text('weekend_rule').notNull().default('previous_business_day'), // | 'next_business_day' | 'none'
  isPrimary: boolean('is_primary').notNull().default(false),
  intoAccountId: uuid('into_account_id').references(() => financialAccounts.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('active'), // 'active' | 'ended'
  endDate: date('end_date'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('income_sources_user_id_idx').on(table.userId),
  householdIdIdx: index('income_sources_household_id_idx').on(table.householdId),
}));

// One-off lines in a period's plan: "Niamh's wedding 400", "Dress 85", a bonus coming in. An entry
// belongs to whichever period its date falls in, so moving payday re-buckets entries instead of
// orphaning them.
export const planEntries = pgTable('plan_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  householdId: uuid('household_id').references(() => households.id, { onDelete: 'set null' }),
  date: date('date').notNull(),
  label: text('label').notNull(),
  amount: money('amount').notNull(),
  currency: text('currency').notNull().default('EUR'),
  direction: text('direction').notNull().default('out'), // 'out' | 'in'
  category: text('category'),
  doneAt: timestamp('done_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userDateIdx: index('plan_entries_user_date_idx').on(table.userId, table.date),
  householdDateIdx: index('plan_entries_household_date_idx').on(table.householdId, table.date),
}));

// Something being saved for. Its per-period contribution is a line in the plan.
export const savingsGoals = pgTable('savings_goals', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  householdId: uuid('household_id').references(() => households.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  targetAmount: money('target_amount'), // null = no target, just a regular set-aside
  currency: text('currency').notNull().default('EUR'),
  targetDate: date('target_date'),
  contributionPerCycle: money('contribution_per_cycle'),
  // Saved so far, typed in or raised by contributions. With a linked account, that balance is used.
  savedAmount: money('saved_amount').notNull().default('0'),
  linkedAccountId: uuid('linked_account_id').references(() => financialAccounts.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('active'), // 'active' | 'paused' | 'achieved' | 'archived'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('savings_goals_user_id_idx').on(table.userId),
  householdIdIdx: index('savings_goals_household_id_idx').on(table.householdId),
}));

export const savingsGoalContributions = pgTable('savings_goal_contributions', {
  id: uuid('id').defaultRandom().primaryKey(),
  goalId: uuid('goal_id').notNull().references(() => savingsGoals.id, { onDelete: 'cascade' }),
  amount: money('amount').notNull(),
  contributedOn: date('contributed_on').notNull(),
  enteredByUserId: uuid('entered_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  goalDateIdx: index('savings_goal_contributions_goal_date_idx').on(table.goalId, table.contributedOn),
}));

// A bill brought in by upload (and, later, by email): the file, what the AI read off it, and what
// the user did with it. The file is in the private Blob store (BILLS_BLOB_READ_WRITE_TOKEN) at
// blobPathname, never at a public URL; it's served through an authenticated route.
export const billDocuments = pgTable('bill_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  householdId: uuid('household_id').references(() => households.id, { onDelete: 'set null' }),
  source: text('source').notNull().default('upload'), // 'upload' | 'email' | 'receipt_move'

  // The file
  blobPathname: text('blob_pathname').notNull(),
  mimeType: text('mime_type').notNull(),
  fileName: text('file_name'),
  sizeBytes: integer('size_bytes'),
  contentHash: text('content_hash'), // sha256 of the bytes: the same file uploaded twice
  inboundEmailId: uuid('inbound_email_id').references((): AnyPgColumn => inboundEmails.id, { onDelete: 'set null' }),
  partIndex: integer('part_index'),

  // Reading it (the claim/fail lifecycle of receipts.processing_status)
  processingStatus: text('processing_status').notNull().default('pending'), // 'pending' | 'processing' | 'completed' | 'failed'
  processingError: text('processing_error'),
  processingAttempts: integer('processing_attempts').notNull().default(0),
  processingTokens: jsonb('processing_tokens'),

  // What it says
  documentType: text('document_type'), // BILL_DOCUMENT_TYPES in lib/bill-extraction.ts
  extracted: jsonb('extracted'),
  provider: text('provider'),
  providerKey: text('provider_key'),
  accountReference: text('account_reference'), // last 4 only
  amountDue: money('amount_due'),
  currency: text('currency'),
  dueDate: date('due_date'),
  issueDate: date('issue_date'),
  periodStart: date('period_start'),
  periodEnd: date('period_end'),
  statementBalance: money('statement_balance'),
  minimumPayment: money('minimum_payment'),
  isDirectDebit: boolean('is_direct_debit'),
  fingerprint: text('fingerprint'), // provider + amount + due date: the same bill sent twice
  duplicateOfId: uuid('duplicate_of_id').references((): AnyPgColumn => billDocuments.id, { onDelete: 'set null' }),

  // What was done with it
  reviewStatus: text('review_status').notNull().default('pending_review'), // 'pending_review' | 'needs_document' | 'not_a_bill' | 'applied' | 'dismissed'
  appliedAs: text('applied_as'), // 'bill' | 'new_bill' | 'one_off'
  autoApplied: boolean('auto_applied').notNull().default(false),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id, { onDelete: 'set null' }),
  paymentId: uuid('payment_id').references(() => subscriptionPayments.id, { onDelete: 'set null' }),
  entryId: uuid('entry_id').references(() => planEntries.id, { onDelete: 'set null' }),
  receiptId: uuid('receipt_id').references(() => receipts.id, { onDelete: 'set null' }),
  reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at'),
  deletedAt: timestamp('deleted_at'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userDeletedIdx: index('bill_documents_user_deleted_idx').on(table.userId, table.deletedAt),
  householdDeletedIdx: index('bill_documents_household_deleted_idx').on(table.householdId, table.deletedAt),
  processingIdx: index('bill_documents_processing_idx').on(table.processingStatus, table.updatedAt),
  userFingerprintIdx: index('bill_documents_user_fingerprint_idx').on(table.userId, table.fingerprint),
  // One document per attachment of a forwarded email; uploads have no email (NULLs don't clash).
  emailPartUnique: uniqueIndex('bill_documents_email_part_uidx').on(table.inboundEmailId, table.partIndex),
}));

export type BillDocument = typeof billDocuments.$inferSelect;

// Each user's forwarding address, <token>@in.receiptwise.io. The token is the whole local part
// (16 random bytes, base32) and is the only thing that identifies the user: never the From header,
// which anyone can set. Rotating replaces it; mail to the old one is then refused.
export const inboundAddresses = pgTable('inbound_addresses', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  rotatedAt: timestamp('rotated_at'),
  disabledAt: timestamp('disabled_at'),
}, (table) => ({
  userUnique: uniqueIndex('inbound_addresses_user_uidx').on(table.userId),
  tokenUnique: uniqueIndex('inbound_addresses_token_uidx').on(table.token),
}));

// One forwarded email. The raw message sits in the private store until processed (+7 days); this
// row keeps who it was from and what happened, for the Settings list, for 90 days.
export const inboundEmails = pgTable('inbound_emails', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // The Message-ID header, or a hash of the raw message without one: the same email delivered twice is one row.
  messageKey: text('message_key').notNull(),
  rawBlobPathname: text('raw_blob_pathname'),
  fromAddress: text('from_address'),
  subject: text('subject'),
  sizeBytes: integer('size_bytes'),
  status: text('status').notNull().default('receiving'), // 'receiving' | 'stored' | 'processed' | 'rejected_limit' | 'no_content' | 'forwarding_confirmation' | 'failed'
  error: text('error'),
  // Gmail's "confirm forwarding" email: its code and link, shown in Settings.
  confirmationCode: text('confirmation_code'),
  confirmationUrl: text('confirmation_url'),
  partCount: integer('part_count'),
  receivedAt: timestamp('received_at').notNull().defaultNow(),
  processedAt: timestamp('processed_at'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  messageKeyUnique: uniqueIndex('inbound_emails_message_key_uidx').on(table.userId, table.messageKey),
  userReceivedIdx: index('inbound_emails_user_received_idx').on(table.userId, table.receivedAt),
  statusIdx: index('inbound_emails_status_idx').on(table.status, table.updatedAt),
}));

export type InboundAddress = typeof inboundAddresses.$inferSelect;
export type InboundEmail = typeof inboundEmails.$inferSelect;

export type FinancialAccount = typeof financialAccounts.$inferSelect;
export type AccountBalance = typeof accountBalances.$inferSelect;
export type IncomeSource = typeof incomeSources.$inferSelect;
export type PlanEntry = typeof planEntries.$inferSelect;
export type SavingsGoal = typeof savingsGoals.$inferSelect;
export type SavingsGoalContribution = typeof savingsGoalContributions.$inferSelect;

// Additional types for business logic
export type HouseholdMember = {
  userId: string;
  email: string;
  role: 'owner' | 'member';
  joinedAt: Date;
};

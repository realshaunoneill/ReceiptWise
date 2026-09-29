import { pgTable, uuid, text, boolean, timestamp, jsonb, unique, integer, index } from 'drizzle-orm/pg-core';

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
  billingFrequency: text('billing_frequency').notNull(), // 'monthly', 'quarterly', 'yearly', 'custom'
  billingDay: integer('billing_day').notNull(), // Day of month (1-31)
  customFrequencyDays: integer('custom_frequency_days'), // For custom frequency

  // Status
  status: text('status').notNull().default('active'), // 'active', 'paused', 'cancelled'
  isBusinessExpense: boolean('is_business_expense').default(false),

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

  // Status
  status: text('status').notNull().default('pending'), // 'pending', 'paid', 'missed', 'cancelled'

  // Actual payment (if receipt linked)
  actualDate: timestamp('actual_date'),
  actualAmount: text('actual_amount'),

  // Metadata
  notes: text('notes'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  subscriptionIdIdx: index('subscription_payments_subscription_id_idx').on(table.subscriptionId),
  receiptIdIdx: index('subscription_payments_receipt_id_idx').on(table.receiptId),
  expectedDateIdx: index('subscription_payments_expected_date_idx').on(table.expectedDate),
  statusIdx: index('subscription_payments_status_idx').on(table.status),
}));

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export type SubscriptionPayment = typeof subscriptionPayments.$inferSelect;
export type NewSubscriptionPayment = typeof subscriptionPayments.$inferInsert;

// Additional types for business logic
export type HouseholdMember = {
  userId: string;
  email: string;
  role: 'owner' | 'member';
  joinedAt: Date;
};

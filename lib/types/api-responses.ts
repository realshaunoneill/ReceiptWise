import type { Receipt, ReceiptItem, Household, Subscription, SubscriptionPayment } from '@/lib/db/schema';

// Receipt with items
export type ReceiptWithItems = Receipt & {
  items?: ReceiptItem[];
  submittedBy?: string;
  linkedSubscription?: {
    id: string;
    subscriptionId: string;
    expectedDate: string;
    expectedAmount: string;
    status: string;
    subscription: {
      id: string;
      name: string;
      amount: string;
      currency: string;
      billingFrequency: string;
      status: string;
      isBusinessExpense: boolean;
    };
  } | null;
};

// Household with member info
export type HouseholdWithMembers = Household & {
  memberCount?: number;
  isAdmin?: boolean;
  isDefault?: boolean;
};

// Member with user info — the shape HouseholdService.getHouseholdMembers returns. This type
// used to describe snake_case fields (user_id, joined_at) the API never sent, which is how the
// sharing page and the receipt modal both failed to recognise the household owner.
export type MemberWithUser = {
  userId: string;
  email: string;
  role: 'owner' | 'member';
  joinedAt: string;
};

// OCR Item from OpenAI response
export type OCRItem = {
  name: string;
  quantity?: number | string | null;
  unitPrice?: number | string | null;
  totalPrice?: number | string | null;
  price?: number | string | null;
  category?: string | null;
  description?: string | null;
  modifiers?: Array<{
    name: string;
    price: number | string;
    type?: string;
  }> | null;
};

// OCR Data structure from OpenAI
export type OCRData = {
  merchant?: string;
  merchantType?: string;
  total?: number | string;
  currency?: string;
  date?: string;
  category?: string;
  paymentMethod?: string;
  location?: string;
  tax?: string | number;
  serviceCharge?: string | number;
  subtotal?: string | number;
  receiptNumber?: string;
  items?: OCRItem[];
  tips?: string | number;
  discount?: string | number;
  loyaltyNumber?: string;
  specialOffers?: string;
  tableNumber?: string | number;
  serverName?: string;
  customerCount?: string | number;
  phoneNumber?: string;
  website?: string;
  vatNumber?: string;
  timeOfDay?: string;
  orderNumber?: string;
  [key: string]: unknown; // For additional fields
};

// Subscription with payments
export type SubscriptionWithPayments = Subscription & {
  payments?: SubscriptionPayment[];
  missingPayments?: number;
  recentPayments?: SubscriptionPayment[];
};

// Paginated response
export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

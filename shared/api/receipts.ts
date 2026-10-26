/** A receipt as GET /api/receipts and GET /api/receipts/[id] return it. Amounts are strings. */
export type WireReceipt = {
  id: string;
  userId: string;
  householdId: string | null;
  imageUrl: string;
  merchantName: string | null;
  totalAmount: string | null;
  currency: string | null;
  /** The day on the receipt, YYYY-MM-DD (or older free text); null until read. */
  transactionDate: string | null;
  category: string | null;
  paymentMethod: string | null;
  location: string | null;
  tax: string | null;
  serviceCharge: string | null;
  subtotal: string | null;
  receiptNumber: string | null;
  /** 'pending' | 'processing' | 'completed' | 'failed' */
  processingStatus: string;
  processingError: string | null;
  isReceipt: boolean | null;
  isBusinessExpense: boolean | null;
  businessCategory: string | null;
  businessNotes: string | null;
  source: string | null;
  createdAt: string;
  updatedAt: string;
  /** Line items; left out for an account without Premium. */
  items?: WireReceiptItem[];
  /** Who uploaded it, on a household's receipt. */
  submittedBy?: string;
};

export type WireReceiptItem = {
  id: string;
  name: string;
  quantity: string | null;
  unitPrice: string | null;
  totalPrice: string | null;
  price: string | null;
  category: string | null;
};

export type WireReceiptsPage = {
  receipts: WireReceipt[];
  pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
};

/** POST /api/receipts/capture: a receipt from the app. */
export type WireCaptureResult = { receiptId: string; processingStatus: string; created: boolean };

export interface User {
  id: string
  clerk_user_id: string
  email: string
  full_name?: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface Household {
  id: string
  name: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface HouseholdMember {
  id: string
  household_id: string
  user_id: string
  role: 'admin' | 'member'
  joined_at: string
}

export interface Receipt {
  id: string
  user_id: string
  household_id?: string
  merchant_name?: string
  total_amount: number
  currency: string
  transaction_date: string
  category?: string
  payment_method?: string
  image_url?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw_ocr_data?: any
  notes?: string
  created_at: string
  updated_at: string
}

export interface ReceiptItem {
  id: string
  receipt_id: string
  item_name: string
  quantity?: number
  unit_price?: number
  total_price: number
  category?: string
  created_at: string
}

export interface Subscription {
  id: string
  user_id: string
  stripe_customer_id?: string
  stripe_subscription_id?: string
  plan_type: 'free' | 'pro'
  status: 'active' | 'canceled' | 'past_due'
  current_period_start?: string
  current_period_end?: string
  created_at: string
  updated_at: string
}

export type SpendingCategory =
  | 'groceries'
  | 'dining'
  | 'transportation'
  | 'utilities'
  | 'entertainment'
  | 'shopping'
  | 'healthcare'
  | 'travel'
  | 'other'

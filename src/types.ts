export type NetworkId = 'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE';
export type PlanCategory = 'SME' | 'GIFTING' | 'CORPORATE';

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  phone: string;
  walletBalance: number;
  bonusBalance: number;
  referralCode: string;
  referredBy: string;
  otpVerified: boolean;
  status: 'active' | 'suspended';
  role: 'user' | 'admin';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DataPlan {
  id: string;
  network: NetworkId;
  category: PlanCategory;
  name: string;
  dataVolume: string;
  validity: string;
  costPrice: number;
  sellingPrice: number;
  discountLabel: string;
  apiPlanCode: string;
  active: boolean;
  featured: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TransactionRecord {
  id: string;
  userId: string;
  userEmail: string;
  type: 'DATA' | 'AIRTIME' | 'WALLET_FUND' | 'BONUS_CLAIM';
  network: NetworkId | 'WALLET';
  planName: string;
  phoneNumber: string;
  amount: number;
  profit: number;
  paymentMethod: 'WALLET' | 'PAYSTACK_CARD' | 'BANK_TRANSFER' | 'BONUS_CONVERSION';
  reference: string;
  providerReference: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  apiMessage: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ReferralRecord {
  id: string;
  referrerId: string;
  referredUserId: string;
  referredUserName: string;
  referralCode: string;
  bonusAmount: number;
  commissionRate: number;
  status: 'pending' | 'credited';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface WalletDepositRecord {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  method: 'BANK_TRANSFER' | 'DEBIT_CARD' | 'GATEWAY';
  reference: string;
  virtualAccount: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AppNotification {
  id: string;
  targetUserId: string;
  title: string;
  message: string;
  category: 'PROMO' | 'SYSTEM' | 'TRANSACTION' | 'REFERRAL';
  createdBy: string;
  createdAt?: unknown;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  transactionRef: string;
  message: string;
  adminReply: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ApiConnection {
  id: string;
  name: string;
  providerType: 'VTU' | 'PAYMENT' | 'OTP';
  baseUrl: string;
  mode: 'LIVE' | 'SANDBOX';
  active: boolean;
  lastCheckedAt?: unknown;
  updatedAt?: unknown;
}

export interface NotificationPreferences {
  userId: string;
  pushEnabled: boolean;
  purchaseAlerts: boolean;
  referralAlerts: boolean;
  offerAlerts: boolean;
  lastReadAt?: unknown;
  updatedAt?: unknown;
}

export type AppTab = 'dashboard' | 'purchase' | 'wallet' | 'referrals' | 'support' | 'admin';

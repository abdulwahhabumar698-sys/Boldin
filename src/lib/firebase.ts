import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  collection,
  doc,
  getDocFromServer,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { ApiConnection, DataPlan, NetworkId } from '../types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const BOOTSTRAP_ADMIN_EMAIL = 'abdulwahhabumar698@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

export function formatTimestamp(value: unknown): string {
  if (!value) return 'Just now';
  if (value instanceof Timestamp) {
    return value.toDate().toLocaleString('en-NG', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const seconds = Number((value as { seconds: number }).seconds);
    return new Date(seconds * 1000).toLocaleString('en-NG', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return 'Just now';
}

export function formatNaira(amount: number): string {
  return `₦${Number(amount || 0).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function detectNigerianNetwork(phone: string): NetworkId | null {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  let prefix = '';
  if (cleaned.startsWith('+234') && cleaned.length >= 7) {
    prefix = `0${cleaned.slice(4, 7)}`;
  } else if (cleaned.startsWith('234') && cleaned.length >= 6) {
    prefix = `0${cleaned.slice(3, 6)}`;
  } else if (cleaned.startsWith('0') && cleaned.length >= 4) {
    prefix = cleaned.slice(0, 4);
  }
  if (!prefix) return null;

  const mtn = ['0803', '0806', '0703', '0706', '0813', '0816', '0810', '0814', '0903', '0906', '0913', '0916', '0704'];
  const airtel = ['0802', '0808', '0708', '0812', '0701', '0902', '0901', '0904', '0907', '0912'];
  const glo = ['0805', '0807', '0705', '0815', '0811', '0905', '0915'];
  const nineMobile = ['0809', '0818', '0817', '0909', '0908'];

  if (mtn.includes(prefix)) return 'MTN';
  if (airtel.includes(prefix)) return 'AIRTEL';
  if (glo.includes(prefix)) return 'GLO';
  if (nineMobile.includes(prefix)) return '9MOBILE';
  return null;
}

export const DEFAULT_DATA_PLANS: Omit<DataPlan, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'mtn-sme-500mb',
    network: 'MTN',
    category: 'SME',
    name: 'MTN 500MB SME',
    dataVolume: '500MB',
    validity: '30 Days',
    costPrice: 130,
    sellingPrice: 145,
    discountLabel: 'Save 15%',
    apiPlanCode: 'mtn-500mb-sme',
    active: true,
    featured: false,
  },
  {
    id: 'mtn-sme-1gb',
    network: 'MTN',
    category: 'SME',
    name: 'MTN 1GB SME',
    dataVolume: '1GB',
    validity: '30 Days',
    costPrice: 245,
    sellingPrice: 265,
    discountLabel: 'Best Seller',
    apiPlanCode: 'mtn-1gb-sme',
    active: true,
    featured: true,
  },
  {
    id: 'mtn-sme-2gb',
    network: 'MTN',
    category: 'SME',
    name: 'MTN 2GB SME',
    dataVolume: '2GB',
    validity: '30 Days',
    costPrice: 490,
    sellingPrice: 530,
    discountLabel: 'Save 18%',
    apiPlanCode: 'mtn-2gb-sme',
    active: true,
    featured: true,
  },
  {
    id: 'mtn-corp-5gb',
    network: 'MTN',
    category: 'CORPORATE',
    name: 'MTN 5GB Corporate',
    dataVolume: '5GB',
    validity: '30 Days',
    costPrice: 1220,
    sellingPrice: 1320,
    discountLabel: 'Hot Deal',
    apiPlanCode: 'mtn-5gb-corp',
    active: true,
    featured: false,
  },
  {
    id: 'airtel-corp-1gb',
    network: 'AIRTEL',
    category: 'CORPORATE',
    name: 'Airtel 1GB Corporate',
    dataVolume: '1GB',
    validity: '30 Days',
    costPrice: 260,
    sellingPrice: 285,
    discountLabel: 'Save 14%',
    apiPlanCode: 'airtel-1gb-corp',
    active: true,
    featured: true,
  },
  {
    id: 'airtel-corp-2gb',
    network: 'AIRTEL',
    category: 'CORPORATE',
    name: 'Airtel 2GB Corporate',
    dataVolume: '2GB',
    validity: '30 Days',
    costPrice: 520,
    sellingPrice: 565,
    discountLabel: 'Save 16%',
    apiPlanCode: 'airtel-2gb-corp',
    active: true,
    featured: false,
  },
  {
    id: 'airtel-gift-5gb',
    network: 'AIRTEL',
    category: 'GIFTING',
    name: 'Airtel 5GB Gifting',
    dataVolume: '5GB',
    validity: '30 Days',
    costPrice: 1300,
    sellingPrice: 1400,
    discountLabel: '10% Off',
    apiPlanCode: 'airtel-5gb-gift',
    active: true,
    featured: false,
  },
  {
    id: 'glo-corp-1gb',
    network: 'GLO',
    category: 'CORPORATE',
    name: 'Glo 1GB Corporate',
    dataVolume: '1GB',
    validity: '30 Days',
    costPrice: 235,
    sellingPrice: 260,
    discountLabel: 'Cheapest 1GB',
    apiPlanCode: 'glo-1gb-corp',
    active: true,
    featured: true,
  },
  {
    id: 'glo-corp-3gb',
    network: 'GLO',
    category: 'CORPORATE',
    name: 'Glo 3GB Corporate',
    dataVolume: '3GB',
    validity: '30 Days',
    costPrice: 705,
    sellingPrice: 770,
    discountLabel: 'Save 20%',
    apiPlanCode: 'glo-3gb-corp',
    active: true,
    featured: false,
  },
  {
    id: '9mobile-corp-1gb',
    network: '9MOBILE',
    category: 'CORPORATE',
    name: '9mobile 1GB Corporate',
    dataVolume: '1GB',
    validity: '30 Days',
    costPrice: 185,
    sellingPrice: 210,
    discountLabel: 'Mega Value',
    apiPlanCode: '9mobile-1gb-corp',
    active: true,
    featured: true,
  },
  {
    id: '9mobile-corp-2gb',
    network: '9MOBILE',
    category: 'CORPORATE',
    name: '9mobile 2.5GB Corporate',
    dataVolume: '2.5GB',
    validity: '30 Days',
    costPrice: 460,
    sellingPrice: 510,
    discountLabel: 'Save 22%',
    apiPlanCode: '9mobile-25gb-corp',
    active: true,
    featured: false,
  },
];

export const DEFAULT_API_CONNECTIONS: Omit<ApiConnection, 'lastCheckedAt' | 'updatedAt'>[] = [
  {
    id: 'vtpass-vtu',
    name: 'VTpass Nigeria Switch',
    providerType: 'VTU',
    baseUrl: 'https://sandbox.vtpass.com/api',
    mode: 'SANDBOX',
    active: true,
  },
  {
    id: 'paystack-gateway',
    name: 'Paystack Checkout & Cards',
    providerType: 'PAYMENT',
    baseUrl: 'https://api.paystack.co',
    mode: 'SANDBOX',
    active: true,
  },
  {
    id: 'termii-otp',
    name: 'Termii Nigeria SMS OTP',
    providerType: 'OTP',
    baseUrl: 'https://api.ng.termii.com/api',
    mode: 'SANDBOX',
    active: true,
  },
];

export async function seedDefaultCatalogIfAdmin(): Promise<void> {
  try {
    const plansSnap = await getDocs(collection(db, 'dataPlans'));
    if (plansSnap.empty) {
      await Promise.all(
        DEFAULT_DATA_PLANS.map((plan) =>
          setDoc(doc(db, 'dataPlans', plan.id), {
            ...plan,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        )
      );
    }

    const connSnap = await getDocs(collection(db, 'apiConnections'));
    if (connSnap.empty) {
      await Promise.all(
        DEFAULT_API_CONNECTIONS.map((conn) =>
          setDoc(doc(db, 'apiConnections', conn.id), {
            ...conn,
            lastCheckedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        )
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'dataPlans');
  }
}

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Gift,
  Headphones,
  Home,
  LogOut,
  Shield,
  Wallet,
  Wifi,
} from 'lucide-react';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  DEFAULT_DATA_PLANS,
  OperationType,
  auth,
  db,
  formatNaira,
  googleProvider,
  handleFirestoreError,
  seedDefaultCatalogIfAdmin,
} from './lib/firebase';
import { apiFetch } from './lib/api';
import {
  BrowserPushPermission,
  InAppPushToast,
  PushAlertCategory,
  dispatchSystemPushNotification,
  ensureServiceWorkerRegistration,
  getBrowserPushPermission,
  requestBrowserPushPermission,
} from './lib/notifications';
import {
  ApiConnection,
  AppNotification,
  AppTab,
  DataPlan,
  NetworkId,
  NotificationPreferences,
  ReferralRecord,
  SupportTicket,
  TransactionRecord,
  UserProfile,
  WalletDepositRecord,
} from './types';
import { LandingAuthView, OtpVerificationScreen } from './components/LandingAuthView';
import { DashboardView } from './components/DashboardView';
import { PurchaseView } from './components/PurchaseView';
import { WalletView } from './components/WalletView';
import { ReferralView } from './components/ReferralView';
import { SupportView } from './components/SupportView';
import { AdminView } from './components/AdminView';
import { ReceiptModal } from './components/ReceiptModal';
import { PushToastStack } from './components/PushToastStack';

function generateReferralCode(fullName: string, uid: string): string {
  const cleanPrefix = fullName
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 4)
    .padEnd(4, 'B');
  const suffix = uid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4);
  return `${cleanPrefix}-${suffix}`;
}

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [purchasePreset, setPurchasePreset] = useState<{
    mode: 'DATA' | 'AIRTIME';
    network: NetworkId;
    planId: string | null;
  }>({ mode: 'DATA', network: 'MTN', planId: null });

  const [plans, setPlans] = useState<DataPlan[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  // Admin collections
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allDeposits, setAllDeposits] = useState<WalletDepositRecord[]>([]);
  const [apiConnections, setApiConnections] = useState<ApiConnection[]>([]);

  const [receiptTx, setReceiptTx] = useState<TransactionRecord | null>(null);
  const [pendingRefCode, setPendingRefCode] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('ref') || '').toUpperCase().trim();
  });

  // Push Notification State & Preferences
  const [browserPushPermission, setBrowserPushPermission] = useState<BrowserPushPermission>(() =>
    getBrowserPushPermission()
  );
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>({
    userId: '',
    pushEnabled: true,
    purchaseAlerts: true,
    referralAlerts: true,
    offerAlerts: true,
  });
  const [pushToasts, setPushToasts] = useState<InAppPushToast[]>([]);

  const notifPrefsRef = useRef(notifPrefs);
  notifPrefsRef.current = notifPrefs;

  const plansHydratedRef = useRef(false);
  const notifsHydratedRef = useRef(false);
  const refsHydratedRef = useRef(false);
  const knownPlanPricesRef = useRef<Map<string, number>>(new Map());
  const seenNotifIdsRef = useRef<Set<string>>(new Set());

  const dismissPushToast = useCallback((id: string) => {
    setPushToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const triggerPushAlert = useCallback(
    async (params: {
      title: string;
      body: string;
      category: PushAlertCategory;
      targetTab?: InAppPushToast['targetTab'];
      persistPersonal?: boolean;
    }) => {
      const prefs = notifPrefsRef.current;
      if (params.category === 'TRANSACTION' && !prefs.purchaseAlerts) return;
      if (params.category === 'REFERRAL' && !prefs.referralAlerts) return;
      if (params.category === 'PROMO' && !prefs.offerAlerts) return;

      const toastId = `toast-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      setPushToasts((prev) => [
        {
          id: toastId,
          title: params.title,
          body: params.body,
          category: params.category,
          targetTab: params.targetTab,
          createdAt: Date.now(),
        },
        ...prev.slice(0, 2),
      ]);

      setTimeout(() => {
        setPushToasts((prev) => prev.filter((t) => t.id !== toastId));
      }, 6500);

      if (prefs.pushEnabled) {
        await dispatchSystemPushNotification({
          title: params.title,
          body: params.body,
          tag: `dr-boldin-${params.category.toLowerCase()}-${Date.now()}`,
        });
      }

      if (params.persistPersonal && auth.currentUser && auth.currentUser.emailVerified) {
        const notifId = `notif-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
        try {
          await setDoc(doc(db, 'notifications', notifId), {
            targetUserId: auth.currentUser.uid,
            title: params.title.slice(0, 120),
            message: params.body.slice(0, 500),
            category: params.category === 'REFERRAL' ? 'REFERRAL' : 'TRANSACTION',
            createdBy: auth.currentUser.uid,
            createdAt: serverTimestamp(),
          });
        } catch {
          // Do not block purchase/referral UX if notification history write fails
        }
      }
    },
    []
  );

  const isAdmin =
    Boolean(authUser?.emailVerified) &&
    (authUser?.email === BOOTSTRAP_ADMIN_EMAIL || profile?.role === 'admin');

  // Register Service Worker if already granted
  useEffect(() => {
    if (getBrowserPushPermission() === 'granted') {
      ensureServiceWorkerRegistration();
    }
  }, []);

  // Public Data Plans Listener (also triggers special offer/discount push alerts)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'dataPlans'),
      (snap) => {
        if (snap.empty) {
          setPlans(
            DEFAULT_DATA_PLANS.map((p) => ({
              ...p,
              createdAt: null,
              updatedAt: null,
            }))
          );
          return;
        }

        const loaded = snap.docs.map((d) => ({ ...(d.data() as DataPlan), id: d.id }));
        loaded.sort((a, b) => a.sellingPrice - b.sellingPrice);
        setPlans(loaded);

        if (!plansHydratedRef.current) {
          loaded.forEach((p) => knownPlanPricesRef.current.set(p.id, p.sellingPrice));
          plansHydratedRef.current = true;
          return;
        }

        snap.docChanges().forEach((change) => {
          const plan = { ...(change.doc.data() as DataPlan), id: change.doc.id };
          const prevPrice = knownPlanPricesRef.current.get(plan.id);
          knownPlanPricesRef.current.set(plan.id, plan.sellingPrice);

          if (!plan.active) return;

          if (change.type === 'added' && (plan.featured || plan.discountLabel)) {
            triggerPushAlert({
              title: `New Special Offer: ${plan.name}`,
              body: `${plan.dataVolume} (${plan.validity}) now ${formatNaira(plan.sellingPrice)}${plan.discountLabel ? ` · ${plan.discountLabel}` : ''}`,
              category: 'PROMO',
              targetTab: 'purchase',
            });
          } else if (change.type === 'modified' && prevPrice !== undefined && plan.sellingPrice < prevPrice) {
            triggerPushAlert({
              title: `Price Drop Alert: ${plan.name}`,
              body: `Reduced from ${formatNaira(prevPrice)} to ${formatNaira(plan.sellingPrice)}!`,
              category: 'PROMO',
              targetTab: 'purchase',
            });
          }
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'dataPlans');
      }
    );
    return () => unsub();
  }, [triggerPushAlert]);

  // Auth State Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (!user) {
        setProfile(null);
        setTransactions([]);
        setReferrals([]);
        setNotifications([]);
        setTickets([]);
        setAllUsers([]);
        setAllDeposits([]);
        setApiConnections([]);
      }
    });
    return () => unsub();
  }, []);

  // Ensure User Profile Document & Referral Registration
  const ensureUserProfile = useCallback(
    async (user: User, referralCodeToApply: string) => {
      setProfileLoading(true);
      const userRef = doc(db, 'users', user.uid);
      try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          const fullName = (user.displayName || user.email?.split('@')[0] || 'Customer').slice(0, 120);
          const myCode = generateReferralCode(fullName, user.uid);

          let validReferrer: { ownerId: string; code: string } | null = null;
          if (referralCodeToApply && referralCodeToApply !== myCode) {
            try {
              const refCodeSnap = await getDoc(doc(db, 'referralCodes', referralCodeToApply));
              if (refCodeSnap.exists()) {
                const refData = refCodeSnap.data() as { ownerId: string; code: string };
                if (refData.ownerId !== user.uid) {
                  validReferrer = refData;
                }
              }
            } catch {
              // Ignore invalid code
            }
          }

          await setDoc(userRef, {
            uid: user.uid,
            email: user.email || '',
            fullName,
            phone: '',
            walletBalance: 0,
            bonusBalance: 0,
            referralCode: myCode,
            referredBy: validReferrer ? validReferrer.code : '',
            otpVerified: false,
            status: 'active',
            role: 'user',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          await setDoc(doc(db, 'referralCodes', myCode), {
            code: myCode,
            ownerId: user.uid,
            ownerName: fullName,
            createdAt: serverTimestamp(),
          });

          if (validReferrer) {
            const refRecordId = `ref-${user.uid}`;
            await setDoc(doc(db, 'referrals', refRecordId), {
              referrerId: validReferrer.ownerId,
              referredUserId: user.uid,
              referredUserName: fullName,
              referralCode: validReferrer.code,
              bonusAmount: 150,
              commissionRate: 2.5,
              status: 'pending',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }

        if (user.email === BOOTSTRAP_ADMIN_EMAIL && user.emailVerified) {
          await seedDefaultCatalogIfAdmin();
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      } finally {
        setProfileLoading(false);
      }
    },
    []
  );

  // User Profile & Core Listeners
  useEffect(() => {
    if (!authReady || !authUser) return;

    ensureUserProfile(authUser, pendingRefCode);

    const unsubProfile = onSnapshot(
      doc(db, 'users', authUser.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${authUser.uid}`);
      }
    );

    const txQuery =
      authUser.email === BOOTSTRAP_ADMIN_EMAIL && authUser.emailVerified
        ? collection(db, 'transactions')
        : query(collection(db, 'transactions'), where('userId', '==', authUser.uid));

    const unsubTxs = onSnapshot(
      txQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({ ...(d.data() as TransactionRecord), id: d.id }));
        list.sort((a, b) => {
          const ta = (a.createdAt as { seconds?: number } | null)?.seconds || 0;
          const tb = (b.createdAt as { seconds?: number } | null)?.seconds || 0;
          return tb - ta;
        });
        setTransactions(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'transactions');
      }
    );

    const unsubRefs = onSnapshot(
      query(collection(db, 'referrals'), where('referrerId', '==', authUser.uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ ...(d.data() as ReferralRecord), id: d.id }));
        list.sort((a, b) => {
          const ta = (a.createdAt as { seconds?: number } | null)?.seconds || 0;
          const tb = (b.createdAt as { seconds?: number } | null)?.seconds || 0;
          return tb - ta;
        });
        setReferrals(list);

        if (!refsHydratedRef.current) {
          refsHydratedRef.current = true;
          return;
        }

        snap.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const refItem = change.doc.data() as ReferralRecord;
            triggerPushAlert({
              title: 'New Referral Bonus Earned!',
              body: `${refItem.referredUserName} joined with your code (${refItem.referralCode}). Bonus: +${formatNaira(refItem.bonusAmount)}.`,
              category: 'REFERRAL',
              targetTab: 'referrals',
              persistPersonal: true,
            });
          }
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'referrals');
      }
    );

    const unsubNotifs = onSnapshot(
      query(collection(db, 'notifications'), where('targetUserId', 'in', [authUser.uid, 'ALL'])),
      (snap) => {
        const list = snap.docs.map((d) => ({ ...(d.data() as AppNotification), id: d.id }));
        list.sort((a, b) => {
          const ta = (a.createdAt as { seconds?: number } | null)?.seconds || 0;
          const tb = (b.createdAt as { seconds?: number } | null)?.seconds || 0;
          return tb - ta;
        });
        setNotifications(list);

        if (!notifsHydratedRef.current) {
          list.forEach((n) => seenNotifIdsRef.current.add(n.id));
          notifsHydratedRef.current = true;
          return;
        }

        snap.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const n = { ...(change.doc.data() as AppNotification), id: change.doc.id };
            if (seenNotifIdsRef.current.has(n.id)) return;
            seenNotifIdsRef.current.add(n.id);
            if (n.category === 'PROMO' || n.category === 'SYSTEM') {
              triggerPushAlert({
                title: n.title,
                body: n.message,
                category: n.category,
                targetTab: n.category === 'PROMO' ? 'purchase' : 'dashboard',
              });
            }
          }
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'notifications');
      }
    );

    const prefsRef = doc(db, 'notificationPreferences', authUser.uid);
    const unsubPrefs = onSnapshot(
      prefsRef,
      (snap) => {
        if (snap.exists()) {
          setNotifPrefs(snap.data() as NotificationPreferences);
        } else if (authUser.emailVerified) {
          setDoc(prefsRef, {
            userId: authUser.uid,
            pushEnabled: true,
            purchaseAlerts: true,
            referralAlerts: true,
            offerAlerts: true,
            lastReadAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `notificationPreferences/${authUser.uid}`);
      }
    );

    const ticketQuery =
      authUser.email === BOOTSTRAP_ADMIN_EMAIL && authUser.emailVerified
        ? collection(db, 'supportTickets')
        : query(collection(db, 'supportTickets'), where('userId', '==', authUser.uid));

    const unsubTickets = onSnapshot(
      ticketQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({ ...(d.data() as SupportTicket), id: d.id }));
        list.sort((a, b) => {
          const ta = (a.createdAt as { seconds?: number } | null)?.seconds || 0;
          const tb = (b.createdAt as { seconds?: number } | null)?.seconds || 0;
          return tb - ta;
        });
        setTickets(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'supportTickets');
      }
    );

    return () => {
      unsubProfile();
      unsubTxs();
      unsubRefs();
      unsubNotifs();
      unsubPrefs();
      unsubTickets();
    };
  }, [authReady, authUser, ensureUserProfile, pendingRefCode, triggerPushAlert]);

  // Admin-Only Listeners
  useEffect(() => {
    if (!authReady || !authUser || !isAdmin) return;

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => setAllUsers(snap.docs.map((d) => d.data() as UserProfile)),
      (error) => handleFirestoreError(error, OperationType.LIST, 'users')
    );

    const unsubDeposits = onSnapshot(
      collection(db, 'walletDeposits'),
      (snap) => {
        const list = snap.docs.map((d) => ({ ...(d.data() as WalletDepositRecord), id: d.id }));
        list.sort((a, b) => {
          const ta = (a.createdAt as { seconds?: number } | null)?.seconds || 0;
          const tb = (b.createdAt as { seconds?: number } | null)?.seconds || 0;
          return tb - ta;
        });
        setAllDeposits(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'walletDeposits')
    );

    const unsubConns = onSnapshot(
      collection(db, 'apiConnections'),
      (snap) => setApiConnections(snap.docs.map((d) => ({ ...(d.data() as ApiConnection), id: d.id }))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'apiConnections')
    );

    return () => {
      unsubUsers();
      unsubDeposits();
      unsubConns();
    };
  }, [authReady, authUser, isAdmin]);

  const handleGoogleSignIn = async (referralCodeInput: string) => {
    setSigningIn(true);
    setAuthError(null);
    setPendingRefCode(referralCodeInput.toUpperCase().trim());
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google Sign-In was cancelled or failed.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setActiveTab('dashboard');
  };

  const handleOtpVerified = async (verifiedPhone: string) => {
    if (!authUser) return;
    try {
      await updateDoc(doc(db, 'users', authUser.uid), {
        phone: verifiedPhone,
        otpVerified: true,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${authUser.uid}`);
    }
  };

  const handleExecutePurchase = async (params: {
    type: 'DATA' | 'AIRTIME';
    network: NetworkId;
    phoneNumber: string;
    amount: number;
    profit: number;
    planName: string;
    paymentMethod: 'WALLET' | 'PAYSTACK_CARD';
    reference: string;
    providerReference: string;
    status: TransactionRecord['status'];
    apiMessage: string;
  }): Promise<TransactionRecord> => {
    if (!authUser || !profile) throw new Error('User not signed in.');
    const txId = `tx-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const userRef = doc(db, 'users', authUser.uid);
    const txRef = doc(db, 'transactions', txId);

    const txPayload = {
      userId: authUser.uid,
      userEmail: profile.email,
      type: params.type,
      network: params.network,
      planName: params.planName,
      phoneNumber: params.phoneNumber,
      amount: params.amount,
      profit: params.profit,
      paymentMethod: params.paymentMethod,
      reference: params.reference,
      providerReference: params.providerReference,
      status: params.status,
      apiMessage: params.apiMessage,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await runTransaction(db, async (transaction) => {
        if (params.paymentMethod === 'WALLET') {
          const userSnap = await transaction.get(userRef);
          if (!userSnap.exists()) throw new Error('User profile missing.');
          const currentBalance = Number((userSnap.data() as UserProfile).walletBalance || 0);
          if (currentBalance < params.amount) {
            throw new Error('Insufficient wallet balance.');
          }
          transaction.update(userRef, {
            walletBalance: Number((currentBalance - params.amount).toFixed(2)),
            updatedAt: serverTimestamp(),
          });
        }
        transaction.set(txRef, txPayload);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `transactions/${txId}`);
    }

    const savedTx: TransactionRecord = {
      ...txPayload,
      id: txId,
      createdAt: { seconds: Math.floor(Date.now() / 1000) },
      updatedAt: { seconds: Math.floor(Date.now() / 1000) },
    };

    if (params.status === 'SUCCESS') {
      await triggerPushAlert({
        title: `${params.network} ${params.type === 'DATA' ? 'Data' : 'Airtime'} Delivered!`,
        body: `${params.planName} delivered to ${params.phoneNumber} (${formatNaira(params.amount)}).`,
        category: 'TRANSACTION',
        targetTab: 'wallet',
        persistPersonal: true,
      });
    }

    return savedTx;
  };

  const handleCheckTxStatus = async (tx: TransactionRecord) => {
    try {
      const res = await apiFetch<{
        status: TransactionRecord['status'];
        message: string;
        providerReference?: string;
      }>(`/api/vtu/status/${encodeURIComponent(tx.reference)}`);

      await updateDoc(doc(db, 'transactions', tx.id), {
        status: res.status,
        apiMessage: res.message,
        ...(res.providerReference ? { providerReference: res.providerReference } : {}),
        updatedAt: serverTimestamp(),
      });

      if (tx.status !== 'SUCCESS' && res.status === 'SUCCESS') {
        await triggerPushAlert({
          title: `${tx.network} Delivery Confirmed!`,
          body: `${tx.planName} confirmed delivered to ${tx.phoneNumber}.`,
          category: 'TRANSACTION',
          targetTab: 'wallet',
          persistPersonal: true,
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${tx.id}`);
    }
  };

  const handleReceiptStatusUpdate = async (
    txId: string,
    status: TransactionRecord['status'],
    message: string,
    providerRef?: string
  ) => {
    try {
      await updateDoc(doc(db, 'transactions', txId), {
        status,
        apiMessage: message,
        ...(providerRef ? { providerReference: providerRef } : {}),
        updatedAt: serverTimestamp(),
      });
      setReceiptTx((prev) =>
        prev && prev.id === txId
          ? { ...prev, status, apiMessage: message, providerReference: providerRef || prev.providerReference }
          : prev
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${txId}`);
    }
  };

  const handleCreateDeposit = async (params: {
    amount: number;
    method: 'BANK_TRANSFER' | 'DEBIT_CARD' | 'GATEWAY';
    reference: string;
    virtualAccount: string;
  }): Promise<string> => {
    if (!authUser || !profile) throw new Error('User not authenticated.');
    const depositId = `dep-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      await setDoc(doc(db, 'walletDeposits', depositId), {
        userId: authUser.uid,
        userName: profile.fullName,
        amount: params.amount,
        method: params.method,
        reference: params.reference,
        virtualAccount: params.virtualAccount,
        status: 'PENDING',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `walletDeposits/${depositId}`);
    }
    return depositId;
  };

  const handleConfirmDeposit = useCallback(
    async (params: {
      depositId: string;
      amount: number;
      method: 'BANK_TRANSFER' | 'PAYSTACK_CARD';
      reference: string;
    }): Promise<TransactionRecord> => {
      if (!authUser || !profile) throw new Error('User not authenticated.');
      const userRef = doc(db, 'users', authUser.uid);
      const depositRef = doc(db, 'walletDeposits', params.depositId);
      const txId = `tx-fund-${Date.now()}`;
      const txRef = doc(db, 'transactions', txId);

      const txPayload = {
        userId: authUser.uid,
        userEmail: profile.email,
        type: 'WALLET_FUND' as const,
        network: 'WALLET' as const,
        planName: `Wallet Funding (${params.method === 'BANK_TRANSFER' ? 'Bank Transfer' : 'Debit Card'})`,
        phoneNumber: profile.phone || '',
        amount: params.amount,
        profit: 0,
        paymentMethod: params.method,
        reference: params.reference,
        providerReference: `SETTLED-${params.reference.slice(-6)}`,
        status: 'SUCCESS' as const,
        apiMessage: 'Wallet funded and confirmed automatically.',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        await runTransaction(db, async (transaction) => {
          const userSnap = await transaction.get(userRef);
          const depSnap = await transaction.get(depositRef);
          if (!userSnap.exists()) throw new Error('User missing');
          if (depSnap.exists() && depSnap.data().status === 'CONFIRMED') return;

          const currentBal = Number((userSnap.data() as UserProfile).walletBalance || 0);
          transaction.update(userRef, {
            walletBalance: Number((currentBal + params.amount).toFixed(2)),
            updatedAt: serverTimestamp(),
          });
          if (depSnap.exists()) {
            transaction.update(depositRef, {
              status: 'CONFIRMED',
              updatedAt: serverTimestamp(),
            });
          }
          transaction.set(txRef, txPayload);
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `walletDeposits/${params.depositId}`);
      }

      return {
        ...txPayload,
        id: txId,
        createdAt: { seconds: Math.floor(Date.now() / 1000) },
        updatedAt: { seconds: Math.floor(Date.now() / 1000) },
      };
    },
    [authUser, profile]
  );

  const handleConvertBonusToWallet = async (amount: number) => {
    if (!authUser || !profile || amount <= 0) return;
    const userRef = doc(db, 'users', authUser.uid);
    const txId = `tx-bonus-${Date.now()}`;
    const txRef = doc(db, 'transactions', txId);

    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(userRef);
        if (!snap.exists()) throw new Error('User missing');
        const data = snap.data() as UserProfile;
        if (data.bonusBalance < amount) throw new Error('Insufficient bonus balance.');

        transaction.update(userRef, {
          bonusBalance: Number((data.bonusBalance - amount).toFixed(2)),
          walletBalance: Number((data.walletBalance + amount).toFixed(2)),
          updatedAt: serverTimestamp(),
        });

        transaction.set(txRef, {
          userId: authUser.uid,
          userEmail: profile.email,
          type: 'BONUS_CLAIM',
          network: 'WALLET',
          planName: 'Referral Bonus Conversion',
          phoneNumber: profile.phone || '',
          amount,
          profit: 0,
          paymentMethod: 'BONUS_CONVERSION',
          reference: `BON-${Date.now()}`,
          providerReference: 'REFERRAL-WALLET',
          status: 'SUCCESS',
          apiMessage: 'Referral bonus transferred to main wallet.',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await triggerPushAlert({
        title: 'Bonus Transferred to Wallet',
        body: `${formatNaira(amount)} moved from Referral Bonus into your main wallet.`,
        category: 'REFERRAL',
        targetTab: 'wallet',
        persistPersonal: true,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${authUser.uid}`);
    }
  };

  const handleClaimPendingBonuses = async (): Promise<number> => {
    if (!authUser || !profile) return 0;
    const pending = referrals.filter((r) => r.status === 'pending');
    if (pending.length === 0) return 0;

    const totalToCredit = pending.reduce((s, r) => s + r.bonusAmount, 0);
    const userRef = doc(db, 'users', authUser.uid);
    try {
      await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error('User missing');
        const currentBonus = Number((userSnap.data() as UserProfile).bonusBalance || 0);
        for (const r of pending) {
          transaction.update(doc(db, 'referrals', r.id), {
            status: 'credited',
            updatedAt: serverTimestamp(),
          });
        }
        transaction.update(userRef, {
          bonusBalance: Number((currentBonus + totalToCredit).toFixed(2)),
          updatedAt: serverTimestamp(),
        });
      });
      await triggerPushAlert({
        title: `Referral Bonus Credited: +${formatNaira(totalToCredit)}`,
        body: `Your referral bonus has been credited and is ready to spend or move to your wallet.`,
        category: 'REFERRAL',
        targetTab: 'referrals',
        persistPersonal: true,
      });
      return totalToCredit;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'referrals');
    }
  };

  const handleApplyReferralCode = async (code: string) => {
    if (!authUser || !profile) return;
    if (profile.referredBy) throw new Error('A referral code is already linked to your account.');
    if (code === profile.referralCode) throw new Error('You cannot use your own referral code.');

    try {
      const codeSnap = await getDoc(doc(db, 'referralCodes', code));
      if (!codeSnap.exists()) {
        throw new Error('Referral code not found. Double-check the code and try again.');
      }
      const refData = codeSnap.data() as { ownerId: string; code: string };
      if (refData.ownerId === authUser.uid) {
        throw new Error('You cannot refer yourself.');
      }

      await updateDoc(doc(db, 'users', authUser.uid), {
        referredBy: code,
        updatedAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'referrals', `ref-${authUser.uid}`), {
        referrerId: refData.ownerId,
        referredUserId: authUser.uid,
        referredUserName: profile.fullName,
        referralCode: code,
        bonusAmount: 150,
        commissionRate: 2.5,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      if (error instanceof Error && (error.message.includes('not found') || error.message.includes('already') || error.message.includes('yourself'))) {
        throw error;
      }
      handleFirestoreError(error, OperationType.WRITE, `referrals/ref-${authUser.uid}`);
    }
  };

  const handleSubmitTicket = async (params: {
    subject: string;
    transactionRef: string;
    message: string;
  }) => {
    if (!authUser || !profile) return;
    const ticketId = `tkt-${Date.now()}`;
    try {
      await setDoc(doc(db, 'supportTickets', ticketId), {
        userId: authUser.uid,
        userName: profile.fullName,
        userEmail: profile.email,
        subject: params.subject,
        transactionRef: params.transactionRef,
        message: params.message,
        adminReply: '',
        status: 'OPEN',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `supportTickets/${ticketId}`);
    }
  };

  // Admin Handlers
  const handleSavePlan = async (plan: Omit<DataPlan, 'createdAt' | 'updatedAt'>, isNew: boolean) => {
    try {
      if (isNew) {
        await setDoc(doc(db, 'dataPlans', plan.id), {
          ...plan,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, 'dataPlans', plan.id), {
          ...plan,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `dataPlans/${plan.id}`);
    }
  };

  const handleToggleUserStatus = async (userId: string, nextStatus: 'active' | 'suspended') => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleAdjustUserWallet = async (userId: string, delta: number) => {
    const userRef = doc(db, 'users', userId);
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(userRef);
        if (!snap.exists()) return;
        const current = Number((snap.data() as UserProfile).walletBalance || 0);
        transaction.update(userRef, {
          walletBalance: Math.max(0, Number((current + delta).toFixed(2))),
          updatedAt: serverTimestamp(),
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleUpdateTransactionStatus = async (txId: string, status: TransactionRecord['status']) => {
    try {
      await updateDoc(doc(db, 'transactions', txId), {
        status,
        apiMessage: `Updated by administrator (${status}).`,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${txId}`);
    }
  };

  const handleConfirmDepositAdmin = async (
    deposit: WalletDepositRecord,
    action: 'CONFIRMED' | 'REJECTED'
  ) => {
    try {
      if (action === 'REJECTED') {
        await updateDoc(doc(db, 'walletDeposits', deposit.id), {
          status: 'REJECTED',
          updatedAt: serverTimestamp(),
        });
        return;
      }

      const userRef = doc(db, 'users', deposit.userId);
      const depRef = doc(db, 'walletDeposits', deposit.id);
      await runTransaction(db, async (transaction) => {
        const depSnap = await transaction.get(depRef);
        const userSnap = await transaction.get(userRef);
        if (!depSnap.exists() || !userSnap.exists()) return;
        if (depSnap.data().status === 'CONFIRMED') return;

        const currentBal = Number((userSnap.data() as UserProfile).walletBalance || 0);
        transaction.update(depRef, {
          status: 'CONFIRMED',
          updatedAt: serverTimestamp(),
        });
        transaction.update(userRef, {
          walletBalance: Number((currentBal + deposit.amount).toFixed(2)),
          updatedAt: serverTimestamp(),
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `walletDeposits/${deposit.id}`);
    }
  };

  const handleSaveConnection = async (conn: Omit<ApiConnection, 'lastCheckedAt' | 'updatedAt'>) => {
    try {
      await setDoc(doc(db, 'apiConnections', conn.id), {
        ...conn,
        lastCheckedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `apiConnections/${conn.id}`);
    }
  };

  const handleSendNotification = async (params: {
    targetUserId: string;
    title: string;
    message: string;
    category: 'PROMO' | 'SYSTEM' | 'TRANSACTION' | 'REFERRAL';
  }) => {
    if (!authUser) return;
    const notifId = `notif-${Date.now()}`;
    try {
      await setDoc(doc(db, 'notifications', notifId), {
        targetUserId: params.targetUserId,
        title: params.title,
        message: params.message,
        category: params.category,
        createdBy: authUser.uid,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `notifications/${notifId}`);
    }
  };

  const handleReplyTicket = async (
    ticketId: string,
    reply: string,
    status: SupportTicket['status']
  ) => {
    try {
      await updateDoc(doc(db, 'supportTickets', ticketId), {
        adminReply: reply,
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `supportTickets/${ticketId}`);
    }
  };

  if (!authReady || (authUser && profileLoading && !profile)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#0A192F] border-t-[#D4AF37] rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">Loading DR BOLDIN DATA SUB...</p>
        </div>
      </div>
    );
  }

  if (!authUser || !profile) {
    return (
      <LandingAuthView
        onGoogleSignIn={handleGoogleSignIn}
        signingIn={signingIn}
        authError={authError}
        previewPlans={plans}
        initialRefCode={pendingRefCode}
      />
    );
  }

  if (!profile.otpVerified) {
    return (
      <OtpVerificationScreen
        profile={profile}
        onVerified={handleOtpVerified}
        onSignOut={handleSignOut}
      />
    );
  }

  const navItems: { id: AppTab; label: string; mobileLabel: string; icon: typeof Home }[] = [
    { id: 'dashboard', label: 'Dashboard', mobileLabel: 'Home', icon: Home },
    { id: 'purchase', label: 'Buy Data', mobileLabel: 'Buy', icon: Wifi },
    { id: 'wallet', label: 'Wallet', mobileLabel: 'Wallet', icon: Wallet },
    { id: 'referrals', label: 'Referral Program', mobileLabel: 'Referrals', icon: Gift },
    { id: 'support', label: 'Support', mobileLabel: 'Support', icon: Headphones },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'Admin', mobileLabel: 'Admin', icon: Shield });
  }

  const handleEnablePush = async () => {
    const permission = await requestBrowserPushPermission();
    setBrowserPushPermission(permission);
    if (authUser && authUser.emailVerified) {
      try {
        await setDoc(
          doc(db, 'notificationPreferences', authUser.uid),
          {
            userId: authUser.uid,
            pushEnabled: permission === 'granted',
            purchaseAlerts: notifPrefs.purchaseAlerts,
            referralAlerts: notifPrefs.referralAlerts,
            offerAlerts: notifPrefs.offerAlerts,
            lastReadAt: notifPrefs.lastReadAt || serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch {
        // Ignore preference sync error if offline
      }
    }
    triggerPushAlert({
      title: permission === 'granted' ? 'Push Notifications Enabled' : 'In-App Alerts Active',
      body:
        permission === 'granted'
          ? 'You will receive instant alerts for data purchases, referral bonuses, and new special offers.'
          : 'In-app push banners are active for purchases, referral bonuses, and special offers.',
      category: 'SYSTEM',
    });
  };

  const handleUpdateNotifPrefs = async (patch: Partial<NotificationPreferences>) => {
    const nextPrefs: NotificationPreferences = {
      ...notifPrefs,
      ...patch,
      userId: authUser?.uid || notifPrefs.userId,
    };
    setNotifPrefs(nextPrefs);
    if (!authUser || !authUser.emailVerified) return;
    try {
      await setDoc(
        doc(db, 'notificationPreferences', authUser.uid),
        {
          userId: authUser.uid,
          pushEnabled: nextPrefs.pushEnabled,
          purchaseAlerts: nextPrefs.purchaseAlerts,
          referralAlerts: nextPrefs.referralAlerts,
          offerAlerts: nextPrefs.offerAlerts,
          lastReadAt: nextPrefs.lastReadAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notificationPreferences/${authUser.uid}`);
    }
  };

  const handleMarkAllRead = async () => {
    if (!authUser || !authUser.emailVerified) return;
    try {
      await setDoc(
        doc(db, 'notificationPreferences', authUser.uid),
        {
          userId: authUser.uid,
          pushEnabled: notifPrefs.pushEnabled,
          purchaseAlerts: notifPrefs.purchaseAlerts,
          referralAlerts: notifPrefs.referralAlerts,
          offerAlerts: notifPrefs.offerAlerts,
          lastReadAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notificationPreferences/${authUser.uid}`);
    }
  };

  const handleSendTestPush = () => {
    triggerPushAlert({
      title: 'DR BOLDIN DATA SUB Alerts Ready',
      body: 'Live notifications are active for MTN, Airtel, Glo & 9mobile purchases, referral bonuses, and promo offers.',
      category: 'SYSTEM',
      targetTab: 'purchase',
    });
  };

  const lastReadSeconds = (notifPrefs.lastReadAt as { seconds?: number } | null)?.seconds || 0;
  const unreadCount = notifications.filter((n) => {
    const createdSeconds = (n.createdAt as { seconds?: number } | null)?.seconds || 0;
    return createdSeconds > lastReadSeconds;
  }).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 md:pb-10">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="font-display font-bold text-base sm:text-lg text-[#0A192F] whitespace-nowrap shrink-0"
          >
            DR BOLDIN DATA SUB
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors border-b-2 ${
                  activeTab === item.id
                    ? 'text-[#0A192F] font-semibold border-[#D4AF37]'
                    : 'border-transparent hover:text-[#0A192F]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setActiveTab('wallet')}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0A192F] hover:bg-[#112240] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            Fund Wallet
          </button>
        </div>
      </header>

      {/* Suspended Account Notice */}
      {profile.status === 'suspended' && (
        <div className="bg-rose-600 text-white text-xs font-medium py-2.5 px-4 text-center">
          Your account is currently suspended. Please contact Customer Support to restore purchasing access.
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            profile={profile}
            plans={plans}
            transactions={transactions}
            notifications={notifications}
            notifPrefs={notifPrefs}
            browserPushPermission={browserPushPermission}
            unreadCount={unreadCount}
            onNavigate={(tab) => setActiveTab(tab)}
            onQuickBuyPlan={(plan) => {
              setPurchasePreset({ mode: 'DATA', network: plan.network, planId: plan.id });
              setActiveTab('purchase');
            }}
            onQuickSelectNetwork={(network, mode) => {
              setPurchasePreset({ mode, network, planId: null });
              setActiveTab('purchase');
            }}
            onOpenReceipt={(tx) => setReceiptTx(tx)}
            onCheckTxStatus={handleCheckTxStatus}
            onEnablePush={handleEnablePush}
            onUpdateNotifPrefs={handleUpdateNotifPrefs}
            onMarkAllRead={handleMarkAllRead}
            onSendTestPush={handleSendTestPush}
          />
        )}

        {activeTab === 'purchase' && (
          <PurchaseView
            profile={profile}
            plans={plans}
            initialMode={purchasePreset.mode}
            initialNetwork={purchasePreset.network}
            initialPlanId={purchasePreset.planId}
            onExecuteWalletPurchase={handleExecutePurchase}
            onOpenReceipt={(tx) => setReceiptTx(tx)}
            onGoToWallet={() => setActiveTab('wallet')}
          />
        )}

        {activeTab === 'wallet' && (
          <WalletView
            profile={profile}
            transactions={transactions}
            onCreateDeposit={handleCreateDeposit}
            onConfirmDeposit={handleConfirmDeposit}
            onConvertBonus={handleConvertBonusToWallet}
            onOpenReceipt={(tx) => setReceiptTx(tx)}
            onCheckTxStatus={handleCheckTxStatus}
          />
        )}

        {activeTab === 'referrals' && (
          <ReferralView
            profile={profile}
            referrals={referrals}
            onClaimPendingBonuses={handleClaimPendingBonuses}
            onConvertBonusToWallet={handleConvertBonusToWallet}
            onApplyReferralCode={handleApplyReferralCode}
          />
        )}

        {activeTab === 'support' && (
          <SupportView
            tickets={tickets}
            transactions={transactions}
            onSubmitTicket={handleSubmitTicket}
          />
        )}

        {activeTab === 'admin' && isAdmin && (
          <AdminView
            users={allUsers}
            plans={plans}
            transactions={transactions}
            deposits={allDeposits}
            connections={apiConnections}
            tickets={tickets}
            onSavePlan={handleSavePlan}
            onToggleUserStatus={handleToggleUserStatus}
            onAdjustUserWallet={handleAdjustUserWallet}
            onUpdateTransactionStatus={handleUpdateTransactionStatus}
            onConfirmDepositAdmin={handleConfirmDepositAdmin}
            onSaveConnection={handleSaveConnection}
            onSendNotification={handleSendNotification}
            onReplyTicket={handleReplyTicket}
            onSeedCatalog={seedDefaultCatalogIfAdmin}
          />
        )}
      </main>

      {/* Quiet Footer with Sign Out */}
      <footer className="no-print max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <p>DR BOLDIN DATA SUB · Your Reliable Data Plug – Fast, Cheap and Reliable.</p>
        <div className="flex items-center gap-4">
          <span>Signed in as {profile.email}</span>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1 font-semibold text-[#0A192F] hover:text-[#B8921F]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </footer>

      {/* Mobile Bottom Thumb-Zone Navigation */}
      <nav
        aria-label="Mobile Navigation"
        className="no-print md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200"
      >
        <div
          className={`grid h-16 items-center ${
            isAdmin ? 'grid-cols-6' : 'grid-cols-5'
          }`}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 ${
                  isActive ? 'text-[#0A192F] font-bold' : 'text-slate-500'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-[#B8921F]' : ''}`} />
                <span className="text-[10px] tracking-tight whitespace-nowrap">{item.mobileLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Printable Transaction Receipt Modal */}
      <ReceiptModal
        transaction={receiptTx}
        onClose={() => setReceiptTx(null)}
        onStatusUpdated={handleReceiptStatusUpdate}
      />

      {/* Live Push Notification Toast Stack */}
      <PushToastStack
        toasts={pushToasts}
        onDismiss={dismissPushToast}
        onNavigate={(tab) => setActiveTab(tab)}
      />
    </div>
  );
}

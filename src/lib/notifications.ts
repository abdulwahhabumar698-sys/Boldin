export type PushAlertCategory = 'TRANSACTION' | 'REFERRAL' | 'PROMO' | 'SYSTEM';

export interface InAppPushToast {
  id: string;
  title: string;
  body: string;
  category: PushAlertCategory;
  targetTab?: 'dashboard' | 'purchase' | 'wallet' | 'referrals' | 'support';
  createdAt: number;
}

export type BrowserPushPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export function getBrowserPushPermission(): BrowserPushPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export async function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  if (!swRegistrationPromise) {
    swRegistrationPromise = navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => reg)
      .catch(() => null);
  }
  return swRegistrationPromise;
}

export async function requestBrowserPushPermission(): Promise<BrowserPushPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    await ensureServiceWorkerRegistration();
    const permission = await Notification.requestPermission();
    return permission;
  } catch {
    return Notification.permission || 'default';
  }
}

export async function dispatchSystemPushNotification(params: {
  title: string;
  body: string;
  tag: string;
  url?: string;
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    const reg = await ensureServiceWorkerRegistration();
    if (reg && typeof reg.showNotification === 'function') {
      await reg.showNotification(params.title, {
        body: params.body,
        tag: params.tag,
        icon: '/src/assets/images/brand_emblem_1795477336656.jpg',
        badge: '/src/assets/images/brand_emblem_1795477336656.jpg',
        data: { url: params.url || '/' },
      });
      return true;
    }

    new Notification(params.title, {
      body: params.body,
      tag: params.tag,
      icon: '/src/assets/images/brand_emblem_1795477336656.jpg',
    });
    return true;
  } catch {
    return false;
  }
}

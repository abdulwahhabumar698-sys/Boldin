import React from 'react';
import {
  ArrowUpRight,
  Bell,
  BellRing,
  Check,
  Gift,
  PhoneCall,
  Plus,
  RefreshCw,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import {
  AppNotification,
  AppTab,
  DataPlan,
  NetworkId,
  NotificationPreferences,
  TransactionRecord,
  UserProfile,
} from '../types';
import { BrowserPushPermission } from '../lib/notifications';
import { formatNaira, formatTimestamp } from '../lib/firebase';

interface DashboardViewProps {
  profile: UserProfile;
  plans: DataPlan[];
  transactions: TransactionRecord[];
  notifications: AppNotification[];
  notifPrefs: NotificationPreferences;
  browserPushPermission: BrowserPushPermission;
  unreadCount: number;
  onNavigate: (tab: AppTab) => void;
  onQuickBuyPlan: (plan: DataPlan) => void;
  onQuickSelectNetwork: (network: NetworkId, mode: 'DATA' | 'AIRTIME') => void;
  onOpenReceipt: (tx: TransactionRecord) => void;
  onCheckTxStatus: (tx: TransactionRecord) => Promise<void>;
  onEnablePush: () => Promise<void>;
  onUpdateNotifPrefs: (patch: Partial<NotificationPreferences>) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onSendTestPush: () => void;
}

const NETWORK_CARDS: { id: NetworkId; label: string; subtitle: string; accent: string; badgeBg: string }[] = [
  { id: 'MTN', label: 'MTN Nigeria', subtitle: 'SME · Corporate', accent: 'text-[#B8921F]', badgeBg: 'bg-[#FFCC00] text-[#0A192F]' },
  { id: 'AIRTEL', label: 'Airtel', subtitle: 'Corporate · Gifting', accent: 'text-rose-600', badgeBg: 'bg-[#E11900] text-white' },
  { id: 'GLO', label: 'Glo', subtitle: 'Mega Data · Capped', accent: 'text-emerald-700', badgeBg: 'bg-[#008037] text-white' },
  { id: '9MOBILE', label: '9mobile', subtitle: 'Fast Corporate', accent: 'text-teal-700', badgeBg: 'bg-[#006E53] text-white' },
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  profile,
  plans,
  transactions,
  notifications,
  notifPrefs,
  browserPushPermission,
  unreadCount,
  onNavigate,
  onQuickBuyPlan,
  onQuickSelectNetwork,
  onOpenReceipt,
  onCheckTxStatus,
  onEnablePush,
  onUpdateNotifPrefs,
  onMarkAllRead,
  onSendTestPush,
}) => {
  const featuredOffers = plans.filter((p) => p.active && p.featured).slice(0, 4);
  const recentTxs = transactions.slice(0, 5);
  const latestNotifs = notifications.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Top Greeting & Account Overview */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Your Reliable Data Plug · Fast, Cheap and Reliable
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0A192F] tracking-tight mt-1">
            Welcome back, {profile.fullName}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1.5">
            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              OTP Verified
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{profile.phone || 'Phone linked'}</span>
            <span aria-hidden="true">·</span>
            <span>Ref Code: <strong className="font-mono text-[#0A192F]">{profile.referralCode}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('purchase')}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-[#0A192F] text-sm font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            Buy Data
          </button>
          <button
            type="button"
            onClick={() => onNavigate('wallet')}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C59B27] text-[#0A192F] text-sm font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Fund Wallet</span>
          </button>
        </div>
      </div>

      {/* Wallet Hero & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-[#0A192F] text-white rounded-3xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-start justify-between gap-6">
            <div>
              <p className="text-xs font-medium text-[#E5C158]">Available Wallet Balance</p>
              <p className="text-4xl sm:text-5xl font-bold tracking-tight tabular-nums mt-2">
                {formatNaira(profile.walletBalance)}
              </p>
              <p className="text-xs text-slate-300 mt-2">
                Instant zero-fee checkout across all Nigerian networks
              </p>
            </div>

            <div className="bg-white/10 border border-white/15 rounded-2xl px-4 py-3 min-w-[165px]">
              <p className="text-xs text-slate-300">Referral Bonus</p>
              <p className="text-xl font-bold text-[#E5C158] tabular-nums mt-0.5">
                {formatNaira(profile.bonusBalance)}
              </p>
              <button
                type="button"
                onClick={() => onNavigate('referrals')}
                className="text-xs font-semibold text-white hover:text-[#E5C158] mt-1 inline-flex items-center gap-1"
              >
                <span>Open Referrals</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-6 border-t border-white/15">
            <button
              type="button"
              onClick={() => onQuickSelectNetwork('MTN', 'DATA')}
              className="min-h-[44px] px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-left transition-colors"
            >
              <Wifi className="w-4 h-4 text-[#E5C158] mb-1" />
              <span className="block text-xs font-semibold">Buy Data</span>
            </button>
            <button
              type="button"
              onClick={() => onQuickSelectNetwork('MTN', 'AIRTIME')}
              className="min-h-[44px] px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-left transition-colors"
            >
              <PhoneCall className="w-4 h-4 text-[#E5C158] mb-1" />
              <span className="block text-xs font-semibold">Buy Airtime</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('wallet')}
              className="min-h-[44px] px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-left transition-colors"
            >
              <Plus className="w-4 h-4 text-[#E5C158] mb-1" />
              <span className="block text-xs font-semibold">Fund Wallet</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('referrals')}
              className="min-h-[44px] px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-left transition-colors"
            >
              <Gift className="w-4 h-4 text-[#E5C158] mb-1" />
              <span className="block text-xs font-semibold">Refer &amp; Earn</span>
            </button>
          </div>
        </div>

        {/* Available Networks */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#0A192F]">Available Networks</h2>
            <p className="text-xs text-slate-500 mt-0.5">Select a carrier to purchase data or airtime instantly.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 my-4">
            {NETWORK_CARDS.map((net) => (
              <button
                key={net.id}
                type="button"
                onClick={() => onQuickSelectNetwork(net.id, 'DATA')}
                className="min-h-[72px] p-3.5 rounded-2xl border border-slate-200 hover:border-[#0A192F] hover:bg-slate-50 text-left transition-colors flex flex-col justify-between"
              >
                <span className={`inline-block w-fit px-2 py-0.5 rounded-md text-xs font-bold ${net.badgeBg}`}>
                  {net.id}
                </span>
                <div className="mt-2">
                  <p className="text-sm font-bold text-[#0A192F]">{net.label}</p>
                  <p className="text-xs text-slate-500">{net.subtitle}</p>
                </div>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onNavigate('purchase')}
            className="w-full min-h-[44px] rounded-xl bg-[#0A192F] text-white text-sm font-semibold hover:bg-[#112240] transition-colors"
          >
            Browse All Data Plans
          </button>
        </div>
      </div>

      {/* Special Offers & Discounts */}
      <section>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-[#0A192F]">Special Offers &amp; Discounts</h2>
            <p className="text-xs text-slate-500 mt-0.5">Lowest wholesale rates active right now across Nigeria.</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('purchase')}
            className="text-xs font-semibold text-[#0A192F] hover:text-[#B8921F] transition-colors whitespace-nowrap"
          >
            View All Plans
          </button>
        </div>

        {featuredOffers.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-sm text-slate-500">
            Featured data bundles will appear here as soon as plans are loaded.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredOffers.map((plan) => (
              <div
                key={plan.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between hover:border-[#D4AF37] transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span className="font-bold text-[#0A192F]">{plan.network}</span>
                    <span className="font-medium text-[#B8921F]">{plan.discountLabel || plan.category}</span>
                  </div>
                  <h3 className="text-2xl font-bold text-[#0A192F]">{plan.dataVolume}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {plan.name} · {plan.validity}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-lg font-bold text-[#0A192F] tabular-nums">
                    {formatNaira(plan.sellingPrice)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onQuickBuyPlan(plan)}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#0A192F] hover:bg-[#112240] text-white text-xs font-semibold transition-colors whitespace-nowrap"
                  >
                    Quick Buy
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent Transactions & Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#0A192F]">Recent Transactions</h2>
              <p className="text-xs text-slate-500">Click any transaction for its official receipt.</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('wallet')}
              className="text-xs font-semibold text-[#0A192F] hover:text-[#B8921F]"
            >
              See All
            </button>
          </div>

          {recentTxs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-500 mb-4">
                No transactions yet. Buy your first data bundle or fund your wallet to get started.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('purchase')}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0A192F] text-white text-sm font-semibold"
              >
                Buy First Data Bundle
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentTxs.map((tx) => (
                <div
                  key={tx.id}
                  className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onOpenReceipt(tx)}
                    className="flex-1 text-left min-w-0"
                  >
                    <p className="text-sm font-semibold text-[#0A192F] truncate">{tx.planName}</p>
                    <p className="text-xs text-slate-500 mt-0.5 tabular-nums truncate">
                      {tx.network} · {tx.phoneNumber || tx.paymentMethod.replace('_', ' ')} · {formatTimestamp(tx.createdAt)}
                    </p>
                  </button>

                  <div className="flex items-center gap-3 shrink-0">
                    {tx.status === 'PROCESSING' || tx.status === 'PENDING' ? (
                      <button
                        type="button"
                        onClick={() => onCheckTxStatus(tx)}
                        title="Check live status"
                        className="min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Verify</span>
                      </button>
                    ) : null}

                    <div className="text-right">
                      <p className="text-sm font-bold text-[#0A192F] tabular-nums">
                        {tx.type === 'WALLET_FUND' || tx.type === 'BONUS_CLAIM' ? '+' : '-'}
                        {formatNaira(tx.amount)}
                      </p>
                      <p
                        className={`text-xs font-semibold ${
                          tx.status === 'SUCCESS'
                            ? 'text-emerald-700'
                            : tx.status === 'FAILED'
                              ? 'text-rose-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {tx.status}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#B8921F]" />
              <h2 className="text-lg font-bold text-[#0A192F]">Push Alerts &amp; Updates</h2>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="text-xs font-semibold text-[#0A192F] hover:text-[#B8921F] inline-flex items-center gap-1 whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Mark Read ({unreadCount})</span>
              </button>
            )}
          </div>

          <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs">
                <p className="font-semibold text-[#0A192F]">Instant Push Notifications</p>
                <p className="text-slate-500">
                  {browserPushPermission === 'granted' && notifPrefs.pushEnabled
                    ? 'Browser & in-app push alerts active'
                    : browserPushPermission === 'denied'
                      ? 'Browser alerts blocked · In-app alerts active'
                      : 'Enable OS alerts for purchases, bonuses & offers'}
                </p>
              </div>
              {browserPushPermission !== 'granted' ? (
                <button
                  type="button"
                  onClick={onEnablePush}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#0A192F] text-white text-xs font-semibold hover:bg-[#112240] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
                >
                  <BellRing className="w-3.5 h-3.5 text-[#E5C158]" />
                  <span>Enable Push</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSendTestPush}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[#0A192F] text-xs font-semibold hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                >
                  Test Alert
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifPrefs.purchaseAlerts}
                  onChange={(e) => onUpdateNotifPrefs({ purchaseAlerts: e.target.checked })}
                />
                <span>Purchases</span>
              </label>
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifPrefs.referralAlerts}
                  onChange={(e) => onUpdateNotifPrefs({ referralAlerts: e.target.checked })}
                />
                <span>Referrals</span>
              </label>
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifPrefs.offerAlerts}
                  onChange={(e) => onUpdateNotifPrefs({ offerAlerts: e.target.checked })}
                />
                <span>Offers</span>
              </label>
            </div>
          </div>

          <div className="p-5 space-y-4 flex-1">
            {latestNotifs.length === 0 ? (
              <p className="text-sm text-slate-500">
                No alerts yet. You will be notified immediately after purchases, referral bonuses, and new special offers.
              </p>
            ) : (
              latestNotifs.map((n) => (
                <div key={n.id} className="pb-4 border-b border-slate-100 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span className="font-semibold text-[#B8921F]">{n.category}</span>
                    <span>{formatTimestamp(n.createdAt)}</span>
                  </div>
                  <p className="text-sm font-semibold text-[#0A192F]">{n.title}</p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

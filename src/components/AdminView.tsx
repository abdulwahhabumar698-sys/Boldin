import React, { useState } from 'react';
import {
  Activity,
  Bell,
  CheckCircle2,
  Database,
  Layers,
  MessageSquare,
  Plus,
  Send,
  ShieldAlert,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  ApiConnection,
  DataPlan,
  NetworkId,
  PlanCategory,
  SupportTicket,
  TransactionRecord,
  UserProfile,
  WalletDepositRecord,
} from '../types';
import { formatNaira, formatTimestamp } from '../lib/firebase';
import { apiFetch } from '../lib/api';

interface AdminViewProps {
  users: UserProfile[];
  plans: DataPlan[];
  transactions: TransactionRecord[];
  deposits: WalletDepositRecord[];
  connections: ApiConnection[];
  tickets: SupportTicket[];
  onSavePlan: (plan: Omit<DataPlan, 'createdAt' | 'updatedAt'>, isNew: boolean) => Promise<void>;
  onToggleUserStatus: (userId: string, nextStatus: 'active' | 'suspended') => Promise<void>;
  onAdjustUserWallet: (userId: string, delta: number) => Promise<void>;
  onUpdateTransactionStatus: (txId: string, status: TransactionRecord['status']) => Promise<void>;
  onConfirmDepositAdmin: (deposit: WalletDepositRecord, action: 'CONFIRMED' | 'REJECTED') => Promise<void>;
  onSaveConnection: (conn: Omit<ApiConnection, 'lastCheckedAt' | 'updatedAt'>) => Promise<void>;
  onSendNotification: (params: {
    targetUserId: string;
    title: string;
    message: string;
    category: 'PROMO' | 'SYSTEM' | 'TRANSACTION' | 'REFERRAL';
  }) => Promise<void>;
  onReplyTicket: (ticketId: string, reply: string, status: SupportTicket['status']) => Promise<void>;
  onSeedCatalog: () => Promise<void>;
}

type AdminSection = 'overview' | 'plans' | 'users' | 'transactions' | 'apis' | 'comms';

export const AdminView: React.FC<AdminViewProps> = ({
  users,
  plans,
  transactions,
  deposits,
  connections,
  tickets,
  onSavePlan,
  onToggleUserStatus,
  onAdjustUserWallet,
  onUpdateTransactionStatus,
  onConfirmDepositAdmin,
  onSaveConnection,
  onSendNotification,
  onReplyTicket,
  onSeedCatalog,
}) => {
  const [section, setSection] = useState<AdminSection>('overview');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Plan editor state
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState<{
    id: string;
    network: NetworkId;
    category: PlanCategory;
    name: string;
    dataVolume: string;
    validity: string;
    costPrice: string;
    sellingPrice: string;
    discountLabel: string;
    apiPlanCode: string;
    active: boolean;
    featured: boolean;
  }>({
    id: '',
    network: 'MTN',
    category: 'SME',
    name: '',
    dataVolume: '',
    validity: '30 Days',
    costPrice: '',
    sellingPrice: '',
    discountLabel: 'Best Value',
    apiPlanCode: '',
    active: true,
    featured: false,
  });
  const [notifyOfferUsers, setNotifyOfferUsers] = useState(true);

  // Notification sender state
  const [notifTarget, setNotifTarget] = useState('ALL');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifCategory, setNotifCategory] = useState<'PROMO' | 'SYSTEM'>('PROMO');

  // API connection editor / test
  const [apiTestResult, setApiTestResult] = useState<Record<string, string>>({});
  const [newConn, setNewConn] = useState({
    id: '',
    name: '',
    providerType: 'VTU' as 'VTU' | 'PAYMENT' | 'OTP',
    baseUrl: 'https://',
    mode: 'SANDBOX' as 'LIVE' | 'SANDBOX',
    active: true,
  });

  // Ticket reply state
  const [ticketReplies, setTicketReplies] = useState<Record<string, string>>({});
  const [userSearch, setUserSearch] = useState('');

  // Metrics
  const successfulPurchases = transactions.filter(
    (t) => (t.type === 'DATA' || t.type === 'AIRTIME') && t.status === 'SUCCESS'
  );
  const totalSales = successfulPurchases.reduce((sum, t) => sum + t.amount, 0);
  const totalProfit = successfulPurchases.reduce((sum, t) => sum + (t.profit || 0), 0);
  const confirmedDepositsTotal = deposits
    .filter((d) => d.status === 'CONFIRMED')
    .reduce((sum, d) => sum + d.amount, 0);
  const activeUsersCount = users.filter((u) => u.status === 'active').length;

  const notify = (msg: string) => {
    setError(null);
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handlePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const id =
      editingPlanId ||
      planForm.id.trim() ||
      `${planForm.network.toLowerCase()}-${planForm.dataVolume.toLowerCase().replace(/\s+/g, '')}-${Date.now().toString().slice(-4)}`;
    try {
      await onSavePlan(
        {
          id,
          network: planForm.network,
          category: planForm.category,
          name: planForm.name.trim(),
          dataVolume: planForm.dataVolume.trim(),
          validity: planForm.validity.trim(),
          costPrice: Number(planForm.costPrice) || 0,
          sellingPrice: Number(planForm.sellingPrice) || 1,
          discountLabel: planForm.discountLabel.trim(),
          apiPlanCode: planForm.apiPlanCode.trim() || id,
          active: planForm.active,
          featured: planForm.featured,
        },
        !editingPlanId
      );
      if (notifyOfferUsers && planForm.active && (planForm.featured || planForm.discountLabel.trim())) {
        await onSendNotification({
          targetUserId: 'ALL',
          title: `New Special Offer: ${planForm.name.trim()}`,
          message: `Get ${planForm.dataVolume.trim()} (${planForm.validity.trim()}) for ${formatNaira(Number(planForm.sellingPrice) || 1)}${planForm.discountLabel.trim() ? ` — ${planForm.discountLabel.trim()}` : ''}.`,
          category: 'PROMO',
        });
      }
      setEditingPlanId(null);
      setPlanForm({
        id: '',
        network: 'MTN',
        category: 'SME',
        name: '',
        dataVolume: '',
        validity: '30 Days',
        costPrice: '',
        sellingPrice: '',
        discountLabel: 'Best Value',
        apiPlanCode: '',
        active: true,
        featured: false,
      });
      notify('Data plan saved successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save data plan.');
    }
  };

  const handleTestConnection = async (conn: ApiConnection) => {
    setApiTestResult((prev) => ({ ...prev, [conn.id]: 'Testing endpoint...' }));
    try {
      const res = await apiFetch<{ reachable: boolean; statusCode: number; latencyMs: number }>(
        '/api/admin/test-connection',
        {
          method: 'POST',
          body: JSON.stringify({ baseUrl: conn.baseUrl }),
        }
      );
      setApiTestResult((prev) => ({
        ...prev,
        [conn.id]: res.reachable
          ? `Reachable · HTTP ${res.statusCode} · ${res.latencyMs}ms`
          : `Unreachable (${res.latencyMs}ms)`,
      }));
    } catch (err) {
      setApiTestResult((prev) => ({
        ...prev,
        [conn.id]: err instanceof Error ? err.message : 'Test failed',
      }));
    }
  };

  const handleBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await onSendNotification({
        targetUserId: notifTarget,
        title: notifTitle.trim(),
        message: notifMessage.trim(),
        category: notifCategory,
      });
      setNotifTitle('');
      setNotifMessage('');
      notify('Notification delivered.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send notification.');
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    return (
      !q ||
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.phone.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#B8921F]">Administrator Console</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0A192F] tracking-tight">
            Platform Control &amp; Operations
          </h1>
        </div>

        <button
          type="button"
          onClick={onSeedCatalog}
          className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-[#0A192F] hover:bg-slate-50 transition-colors flex items-center gap-1.5 w-fit"
        >
          <Database className="w-4 h-4 text-[#B8921F]" />
          <span>Sync Default Nigerian Plans</span>
        </button>
      </div>

      {/* Section Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl overflow-x-auto">
        {(
          [
            { id: 'overview', label: 'Sales & Profits', icon: TrendingUp },
            { id: 'plans', label: 'Data Plans', icon: Layers },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'transactions', label: 'Transactions & Deposits', icon: Activity },
            { id: 'apis', label: 'API Connections', icon: Database },
            { id: 'comms', label: 'Notifications & Tickets', icon: Bell },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSection(tab.id)}
              className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
                section === tab.id ? 'bg-[#0A192F] text-white' : 'text-slate-700 hover:text-[#0A192F]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {feedback && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm font-medium">
          {error}
        </div>
      )}

      {/* 1. Overview */}
      {section === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0A192F] text-white rounded-2xl p-5">
              <p className="text-xs text-[#E5C158]">Total VTU Sales</p>
              <p className="text-2xl font-bold tabular-nums mt-1">{formatNaira(totalSales)}</p>
              <p className="text-xs text-slate-300 mt-1">{successfulPurchases.length} completed orders</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-xs text-slate-500">Net VTU Profit</p>
              <p className="text-2xl font-bold text-emerald-700 tabular-nums mt-1">{formatNaira(totalProfit)}</p>
              <p className="text-xs text-slate-500 mt-1">Margin across SME &amp; Airtime</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-xs text-slate-500">Confirmed Deposits</p>
              <p className="text-2xl font-bold text-[#0A192F] tabular-nums mt-1">{formatNaira(confirmedDepositsTotal)}</p>
              <p className="text-xs text-slate-500 mt-1">{deposits.length} total deposit records</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-xs text-slate-500">Registered Customers</p>
              <p className="text-2xl font-bold text-[#0A192F] tabular-nums mt-1">{users.length}</p>
              <p className="text-xs text-slate-500 mt-1">{activeUsersCount} active accounts</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-base font-bold text-[#0A192F] mb-4">Network Volume Breakdown</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {(['MTN', 'AIRTEL', 'GLO', '9MOBILE'] as NetworkId[]).map((net) => {
                const netTxs = successfulPurchases.filter((t) => t.network === net);
                const netVol = netTxs.reduce((s, t) => s + t.amount, 0);
                return (
                  <div key={net} className="border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-[#B8921F]">{net}</p>
                    <p className="text-lg font-bold text-[#0A192F] tabular-nums mt-1">{formatNaira(netVol)}</p>
                    <p className="text-xs text-slate-500 tabular-nums">{netTxs.length} orders</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. Data Plans & Selling Prices */}
      {section === 'plans' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form onSubmit={handlePlanSubmit} className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-[#0A192F] flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#B8921F]" />
              <span>{editingPlanId ? 'Update Data Plan' : 'Add New Data Plan'}</span>
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Network</label>
                <select
                  value={planForm.network}
                  onChange={(e) => setPlanForm({ ...planForm, network: e.target.value as NetworkId })}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs bg-white"
                >
                  <option value="MTN">MTN</option>
                  <option value="AIRTEL">AIRTEL</option>
                  <option value="GLO">GLO</option>
                  <option value="9MOBILE">9MOBILE</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={planForm.category}
                  onChange={(e) => setPlanForm({ ...planForm, category: e.target.value as PlanCategory })}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs bg-white"
                >
                  <option value="SME">SME</option>
                  <option value="CORPORATE">CORPORATE</option>
                  <option value="GIFTING">GIFTING</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Plan Title</label>
              <input
                type="text"
                required
                value={planForm.name}
                onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                placeholder="MTN 3GB SME"
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Data Volume</label>
                <input
                  type="text"
                  required
                  value={planForm.dataVolume}
                  onChange={(e) => setPlanForm({ ...planForm, dataVolume: e.target.value })}
                  placeholder="3GB"
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Validity</label>
                <input
                  type="text"
                  required
                  value={planForm.validity}
                  onChange={(e) => setPlanForm({ ...planForm, validity: e.target.value })}
                  placeholder="30 Days"
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cost Price (₦)</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={planForm.costPrice}
                  onChange={(e) => setPlanForm({ ...planForm, costPrice: e.target.value })}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Selling Price (₦)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={planForm.sellingPrice}
                  onChange={(e) => setPlanForm({ ...planForm, sellingPrice: e.target.value })}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 font-mono text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">API Plan Code</label>
                <input
                  type="text"
                  required
                  value={planForm.apiPlanCode}
                  onChange={(e) => setPlanForm({ ...planForm, apiPlanCode: e.target.value })}
                  placeholder="mtn-3gb-sme"
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Promo Label</label>
                <input
                  type="text"
                  value={planForm.discountLabel}
                  onChange={(e) => setPlanForm({ ...planForm, discountLabel: e.target.value })}
                  placeholder="Save 15%"
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-6 text-xs font-semibold text-slate-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={planForm.active}
                  onChange={(e) => setPlanForm({ ...planForm, active: e.target.checked })}
                />
                <span>Active</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={planForm.featured}
                  onChange={(e) => setPlanForm({ ...planForm, featured: e.target.checked })}
                />
                <span>Featured Offer</span>
              </label>
            </div>

            {(planForm.featured || planForm.discountLabel.trim()) && (
              <label className="flex items-center gap-2 text-xs font-medium text-[#0A192F] cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyOfferUsers}
                  onChange={(e) => setNotifyOfferUsers(e.target.checked)}
                />
                <span>Broadcast push notification for this special offer</span>
              </label>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-[#0A192F] text-white text-xs font-semibold hover:bg-[#112240]"
              >
                {editingPlanId ? 'Save Changes' : 'Add Data Plan'}
              </button>
              {editingPlanId && (
                <button
                  type="button"
                  onClick={() => setEditingPlanId(null)}
                  className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-[#0A192F]">Active Data Catalog ({plans.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500 bg-slate-50/70">
                    <th className="py-3 px-4 font-semibold">Network / Plan</th>
                    <th className="py-3 px-4 font-semibold text-right">Cost</th>
                    <th className="py-3 px-4 font-semibold text-right">Selling</th>
                    <th className="py-3 px-4 font-semibold text-right">Profit</th>
                    <th className="py-3 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {plans.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[#0A192F]">
                          {p.name} {!p.active && <span className="text-rose-600 text-xs">(Disabled)</span>}
                        </p>
                        <p className="text-xs text-slate-500">
                          {p.network} · {p.category} · {p.validity}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                        {formatNaira(p.costPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[#0A192F] tabular-nums">
                        {formatNaira(p.sellingPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-emerald-700 tabular-nums">
                        +{formatNaira(p.sellingPrice - p.costPrice)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPlanId(p.id);
                            setPlanForm({
                              id: p.id,
                              network: p.network,
                              category: p.category,
                              name: p.name,
                              dataVolume: p.dataVolume,
                              validity: p.validity,
                              costPrice: String(p.costPrice),
                              sellingPrice: String(p.sellingPrice),
                              discountLabel: p.discountLabel,
                              apiPlanCode: p.apiPlanCode,
                              active: p.active,
                              featured: p.featured,
                            });
                          }}
                          className="text-xs font-semibold text-[#0A192F] hover:text-[#B8921F] underline"
                        >
                          Edit Price
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. Users Management */}
      {section === 'users' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-[#0A192F]">Manage Users ({users.length})</h2>
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Filter by name, email, or phone..."
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:w-64"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500 bg-slate-50/70">
                  <th className="py-3 px-5 font-semibold">User</th>
                  <th className="py-3 px-4 font-semibold">Phone</th>
                  <th className="py-3 px-4 font-semibold text-right">Wallet</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredUsers.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50">
                    <td className="py-3.5 px-5">
                      <p className="font-semibold text-[#0A192F]">{u.fullName}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs tabular-nums">{u.phone || '—'}</td>
                    <td className="py-3.5 px-4 text-right font-bold tabular-nums">{formatNaira(u.walletBalance)}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-xs font-semibold capitalize ${
                          u.status === 'active' ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap space-x-2">
                      <button
                        type="button"
                        onClick={() => onAdjustUserWallet(u.uid, 500)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-[#0A192F] hover:bg-slate-100"
                      >
                        +₦500
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onToggleUserStatus(u.uid, u.status === 'active' ? 'suspended' : 'active')
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                          u.status === 'active'
                            ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {u.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Transactions & Wallet Deposits */}
      {section === 'transactions' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-[#0A192F]">Wallet Deposits Monitor ({deposits.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500 bg-slate-50/70">
                    <th className="py-3 px-5 font-semibold">User</th>
                    <th className="py-3 px-4 font-semibold">Method / Ref</th>
                    <th className="py-3 px-4 font-semibold text-right">Amount</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-5 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {deposits.slice(0, 20).map((d) => (
                    <tr key={d.id}>
                      <td className="py-3 px-5 font-medium text-[#0A192F]">{d.userName}</td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-600">
                        {d.method} · {d.reference}
                      </td>
                      <td className="py-3 px-4 text-right font-bold tabular-nums">{formatNaira(d.amount)}</td>
                      <td className="py-3 px-4 text-xs font-semibold">{d.status}</td>
                      <td className="py-3 px-5 text-right whitespace-nowrap space-x-2">
                        {d.status === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              onClick={() => onConfirmDepositAdmin(d, 'CONFIRMED')}
                              className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                            >
                              Approve &amp; Credit
                            </button>
                            <button
                              type="button"
                              onClick={() => onConfirmDepositAdmin(d, 'REJECTED')}
                              className="px-3 py-1 rounded-lg bg-rose-50 text-rose-700 text-xs font-semibold"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-[#0A192F]">All Platform Transactions ({transactions.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500 bg-slate-50/70">
                    <th className="py-3 px-5 font-semibold">User / Plan</th>
                    <th className="py-3 px-4 font-semibold">Ref</th>
                    <th className="py-3 px-4 font-semibold text-right">Amount</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-5 font-semibold text-right">Override</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {transactions.slice(0, 30).map((t) => (
                    <tr key={t.id}>
                      <td className="py-3 px-5">
                        <p className="font-semibold text-[#0A192F]">{t.planName}</p>
                        <p className="text-xs text-slate-500">{t.userEmail} · {t.phoneNumber}</p>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600">{t.reference}</td>
                      <td className="py-3 px-4 text-right font-bold tabular-nums">{formatNaira(t.amount)}</td>
                      <td className="py-3 px-4 text-xs font-semibold">{t.status}</td>
                      <td className="py-3 px-5 text-right space-x-2">
                        {t.status !== 'SUCCESS' && (
                          <button
                            type="button"
                            onClick={() => onUpdateTransactionStatus(t.id, 'SUCCESS')}
                            className="text-xs font-semibold text-emerald-700 underline"
                          >
                            Mark Success
                          </button>
                        )}
                        {t.status !== 'FAILED' && (
                          <button
                            type="button"
                            onClick={() => onUpdateTransactionStatus(t.id, 'FAILED')}
                            className="text-xs font-semibold text-rose-700 underline"
                          >
                            Mark Failed
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. API Connections */}
      {section === 'apis' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-4">
            {connections.map((conn) => (
              <div key={conn.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-[#B8921F]">
                      {conn.providerType} · {conn.mode}
                    </p>
                    <h3 className="text-base font-bold text-[#0A192F]">{conn.name}</h3>
                    <p className="text-xs font-mono text-slate-500 mt-0.5">{conn.baseUrl}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onSaveConnection({
                          id: conn.id,
                          name: conn.name,
                          providerType: conn.providerType,
                          baseUrl: conn.baseUrl,
                          mode: conn.mode === 'LIVE' ? 'SANDBOX' : 'LIVE',
                          active: conn.active,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
                    >
                      Switch to {conn.mode === 'LIVE' ? 'Sandbox' : 'Live'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTestConnection(conn)}
                      className="px-3 py-1.5 rounded-lg bg-[#0A192F] text-white text-xs font-semibold"
                    >
                      Test Ping
                    </button>
                  </div>
                </div>
                {apiTestResult[conn.id] && (
                  <p className="text-xs font-mono text-[#0A192F] bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    {apiTestResult[conn.id]}
                  </p>
                )}
              </div>
            ))}
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await onSaveConnection({
                id: newConn.id.trim() || `conn-${Date.now()}`,
                name: newConn.name.trim(),
                providerType: newConn.providerType,
                baseUrl: newConn.baseUrl.trim(),
                mode: newConn.mode,
                active: newConn.active,
              });
              setNewConn({ id: '', name: '', providerType: 'VTU', baseUrl: 'https://', mode: 'SANDBOX', active: true });
              notify('API connection saved.');
            }}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
          >
            <h2 className="text-lg font-bold text-[#0A192F]">Add API Provider</h2>
            <p className="text-xs text-slate-500">
              Secret API keys are kept securely in server environment Secrets (`VTU_API_KEY`, `PAYSTACK_SECRET_KEY`).
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Provider Name</label>
              <input
                type="text"
                required
                value={newConn.name}
                onChange={(e) => setNewConn({ ...newConn, name: e.target.value })}
                placeholder="BilalSada VTU"
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">HTTPS Endpoint URL</label>
              <input
                type="url"
                required
                value={newConn.baseUrl}
                onChange={(e) => setNewConn({ ...newConn, baseUrl: e.target.value })}
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 font-mono text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={newConn.providerType}
                onChange={(e) => setNewConn({ ...newConn, providerType: e.target.value as 'VTU' | 'PAYMENT' | 'OTP' })}
                className="min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs bg-white"
              >
                <option value="VTU">VTU</option>
                <option value="PAYMENT">PAYMENT</option>
                <option value="OTP">OTP</option>
              </select>
              <select
                value={newConn.mode}
                onChange={(e) => setNewConn({ ...newConn, mode: e.target.value as 'LIVE' | 'SANDBOX' })}
                className="min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs bg-white"
              >
                <option value="SANDBOX">SANDBOX</option>
                <option value="LIVE">LIVE</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full min-h-[44px] rounded-xl bg-[#0A192F] text-white text-xs font-semibold"
            >
              Save API Connection
            </button>
          </form>
        </div>
      )}

      {/* 6. Broadcast Notifications & Support Desk */}
      {section === 'comms' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form onSubmit={handleBroadcastSubmit} className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-[#0A192F] flex items-center gap-2">
              <Send className="w-4 h-4 text-[#B8921F]" />
              <span>Send Notification to Users</span>
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Recipient</label>
              <select
                value={notifTarget}
                onChange={(e) => setNotifTarget(e.target.value)}
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs bg-white"
              >
                <option value="ALL">All Customers (Broadcast)</option>
                {users.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.fullName} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={notifCategory}
                onChange={(e) => setNotifCategory(e.target.value as 'PROMO' | 'SYSTEM')}
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs bg-white"
              >
                <option value="PROMO">PROMO</option>
                <option value="SYSTEM">SYSTEM</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
              <input
                type="text"
                required
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                placeholder="Weekend MTN SME Price Drop"
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Message</label>
              <textarea
                required
                rows={3}
                value={notifMessage}
                onChange={(e) => setNotifMessage(e.target.value)}
                placeholder="MTN 1GB SME is now ₦265 across all accounts..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full min-h-[44px] rounded-xl bg-[#D4AF37] hover:bg-[#C59B27] text-[#0A192F] text-xs font-bold"
            >
              Send Notification
            </button>
          </form>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#0A192F]" />
              <h2 className="text-lg font-bold text-[#0A192F]">Customer Support Tickets ({tickets.length})</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {tickets.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">No support tickets yet.</p>
              ) : (
                tickets.map((t) => (
                  <div key={t.id} className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[#0A192F]">{t.subject}</p>
                        <p className="text-xs text-slate-500">
                          {t.userName} ({t.userEmail}) · {formatTimestamp(t.createdAt)}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-[#B8921F]">{t.status}</span>
                    </div>
                    <p className="text-sm text-slate-700">{t.message}</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={ticketReplies[t.id] ?? t.adminReply}
                        onChange={(e) => setTicketReplies({ ...ticketReplies, [t.id]: e.target.value })}
                        placeholder="Write resolution reply..."
                        className="flex-1 min-h-[38px] px-3 rounded-xl border border-slate-200 text-xs"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          await onReplyTicket(t.id, ticketReplies[t.id] ?? t.adminReply, 'RESOLVED');
                          notify('Support ticket resolved.');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-[#0A192F] text-white text-xs font-semibold"
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

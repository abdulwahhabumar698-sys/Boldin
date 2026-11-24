import React, { useEffect, useState } from 'react';
import { Check, CreditCard, Phone, ShieldCheck, Wallet, Wifi } from 'lucide-react';
import { DataPlan, NetworkId, PlanCategory, TransactionRecord, UserProfile } from '../types';
import { detectNigerianNetwork, formatNaira } from '../lib/firebase';
import { apiFetch } from '../lib/api';

interface PurchaseViewProps {
  profile: UserProfile;
  plans: DataPlan[];
  initialMode: 'DATA' | 'AIRTIME';
  initialNetwork: NetworkId;
  initialPlanId: string | null;
  onExecuteWalletPurchase: (params: {
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
  }) => Promise<TransactionRecord>;
  onOpenReceipt: (tx: TransactionRecord) => void;
  onGoToWallet: () => void;
}

const NETWORKS: { id: NetworkId; label: string; colorClass: string }[] = [
  { id: 'MTN', label: 'MTN', colorClass: 'border-[#FFCC00] bg-[#FFCC00]/10 text-[#0A192F]' },
  { id: 'AIRTEL', label: 'Airtel', colorClass: 'border-rose-600 bg-rose-50 text-rose-900' },
  { id: 'GLO', label: 'Glo', colorClass: 'border-emerald-600 bg-emerald-50 text-emerald-900' },
  { id: '9MOBILE', label: '9mobile', colorClass: 'border-teal-600 bg-teal-50 text-teal-900' },
];

export const PurchaseView: React.FC<PurchaseViewProps> = ({
  profile,
  plans,
  initialMode,
  initialNetwork,
  initialPlanId,
  onExecuteWalletPurchase,
  onOpenReceipt,
  onGoToWallet,
}) => {
  const [mode, setMode] = useState<'DATA' | 'AIRTIME'>(initialMode);
  const [network, setNetwork] = useState<NetworkId>(initialNetwork);
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | PlanCategory>('ALL');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(initialPlanId);
  const [phoneNumber, setPhoneNumber] = useState(profile.phone || '');
  const [airtimeAmount, setAirtimeAmount] = useState('500');
  const [paymentMethod, setPaymentMethod] = useState<'WALLET' | 'PAYSTACK_CARD'>('WALLET');
  const [autoDetectedNet, setAutoDetectedNet] = useState<NetworkId | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    setNetwork(initialNetwork);
  }, [initialNetwork]);

  useEffect(() => {
    if (initialPlanId) {
      setSelectedPlanId(initialPlanId);
    }
  }, [initialPlanId]);

  const filteredPlans = plans.filter(
    (p) => p.active && p.network === network && (categoryFilter === 'ALL' || p.category === categoryFilter)
  );

  const selectedPlan = filteredPlans.find((p) => p.id === selectedPlanId) || filteredPlans[0] || null;
  const parsedAirtime = Math.max(0, Number(airtimeAmount) || 0);
  const airtimePayable = Math.round(parsedAirtime * 0.98); // 2% discount on Airtime!
  const totalPayable = mode === 'DATA' ? selectedPlan?.sellingPrice || 0 : airtimePayable;

  const handlePhoneChange = (val: string) => {
    setPhoneNumber(val);
    const detected = detectNigerianNetwork(val);
    setAutoDetectedNet(detected);
    if (detected) {
      setNetwork(detected);
    }
  };

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (profile.status === 'suspended') {
      setError('Your account is currently suspended. Contact customer support.');
      return;
    }

    if (mode === 'DATA' && !selectedPlan) {
      setError('Please select a data plan.');
      return;
    }
    if (mode === 'AIRTIME' && (parsedAirtime < 50 || parsedAirtime > 50000)) {
      setError('Airtime amount must be between ₦50 and ₦50,000.');
      return;
    }
    if (paymentMethod === 'WALLET' && profile.walletBalance < totalPayable) {
      setError(`Insufficient wallet balance (${formatNaira(profile.walletBalance)}). Fund your wallet or pay by card.`);
      return;
    }

    setSubmitting(true);
    try {
      const reference = `DB-${mode}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      if (paymentMethod === 'PAYSTACK_CARD') {
        const payInit = await apiFetch<{ reference: string; amount: number }>('/api/payments/initialize', {
          method: 'POST',
          body: JSON.stringify({ amount: totalPayable, method: 'DEBIT_CARD' }),
        });
        await apiFetch<{ confirmed: boolean }>('/api/payments/verify', {
          method: 'POST',
          body: JSON.stringify({ reference: payInit.reference, amount: totalPayable }),
        });
      }

      const vtuResult = await apiFetch<{
        reference: string;
        providerReference: string;
        status: TransactionRecord['status'];
        message: string;
        phoneNumber: string;
      }>('/api/vtu/purchase', {
        method: 'POST',
        body: JSON.stringify({
          type: mode,
          network,
          phoneNumber,
          amount: mode === 'DATA' ? selectedPlan!.sellingPrice : parsedAirtime,
          planCode: mode === 'DATA' ? selectedPlan!.apiPlanCode : undefined,
          planName: mode === 'DATA' ? selectedPlan!.name : `${network} ₦${parsedAirtime} Airtime`,
          reference,
        }),
      });

      const profit =
        mode === 'DATA'
          ? Math.max(0, selectedPlan!.sellingPrice - selectedPlan!.costPrice)
          : Math.round(parsedAirtime * 0.015);

      const savedTx = await onExecuteWalletPurchase({
        type: mode,
        network,
        phoneNumber: vtuResult.phoneNumber,
        amount: totalPayable,
        profit,
        planName: mode === 'DATA' ? selectedPlan!.name : `${network} ₦${parsedAirtime} Airtime (2% Off)`,
        paymentMethod,
        reference: vtuResult.reference,
        providerReference: vtuResult.providerReference,
        status: vtuResult.status,
        apiMessage: vtuResult.message,
      });

      onOpenReceipt(savedTx);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0A192F] tracking-tight">
            Buy Data &amp; Airtime
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Instant VTU delivery across MTN, Airtel, Glo, and 9mobile.
          </p>
        </div>

        <div className="inline-flex p-1 bg-slate-200/70 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setMode('DATA')}
            className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
              mode === 'DATA' ? 'bg-[#0A192F] text-white' : 'text-slate-700 hover:text-[#0A192F]'
            }`}
          >
            <Wifi className="w-4 h-4" />
            <span>Mobile Data</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('AIRTIME')}
            className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
              mode === 'AIRTIME' ? 'bg-[#0A192F] text-white' : 'text-slate-700 hover:text-[#0A192F]'
            }`}
          >
            <Phone className="w-4 h-4" />
            <span>Airtime (2% Off)</span>
          </button>
        </div>
      </div>

      <form onSubmit={handlePurchase} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-6">
          {/* Step 1: Recipient Phone & Network */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <div>
              <label htmlFor="recipient-phone" className="block text-sm font-bold text-[#0A192F] mb-2">
                01. Recipient Phone Number
              </label>
              <input
                id="recipient-phone"
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="0803 123 4567"
                className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-slate-200 font-mono text-base tabular-nums focus:outline-none focus:border-[#0A192F]"
              />
              {autoDetectedNet && (
                <p className="text-xs text-emerald-700 font-medium mt-1.5">
                  Detected {autoDetectedNet} prefix automatically.
                </p>
              )}
            </div>

            <div>
              <span className="block text-sm font-bold text-[#0A192F] mb-2">02. Select Network</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {NETWORKS.map((net) => {
                  const active = network === net.id;
                  return (
                    <button
                      key={net.id}
                      type="button"
                      onClick={() => {
                        setNetwork(net.id);
                        setSelectedPlanId(null);
                      }}
                      className={`min-h-[48px] px-4 py-3 rounded-xl border-2 text-sm font-bold transition-colors flex items-center justify-between ${
                        active
                          ? net.colorClass
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span>{net.label}</span>
                      {active && <Check className="w-4 h-4" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Step 2: Plan or Airtime Amount */}
          {mode === 'DATA' ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-[#0A192F]">03. Choose {network} Data Plan</h2>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit">
                  {(['ALL', 'SME', 'CORPORATE', 'GIFTING'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                        categoryFilter === cat
                          ? 'bg-white text-[#0A192F] shadow-sm'
                          : 'text-slate-600 hover:text-[#0A192F]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {filteredPlans.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">
                  No plans available in this category for {network}. Try switching category to ALL.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredPlans.map((plan) => {
                    const isSelected = selectedPlan?.id === plan.id;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`p-4 rounded-2xl border-2 text-left transition-colors flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'border-[#0A192F] bg-[#0A192F]/5'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="font-semibold text-[#B8921F]">{plan.category}</span>
                            <span>·</span>
                            <span>{plan.validity}</span>
                          </div>
                          <p className="text-lg font-bold text-[#0A192F] mt-0.5">{plan.dataVolume}</p>
                          <p className="text-xs text-slate-600">{plan.name}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-base font-bold text-[#0A192F] tabular-nums">
                            {formatNaira(plan.sellingPrice)}
                          </p>
                          {plan.discountLabel && (
                            <p className="text-xs font-medium text-emerald-700 mt-0.5">{plan.discountLabel}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <label htmlFor="airtime-amount" className="block text-sm font-bold text-[#0A192F]">
                03. Airtime Amount (₦)
              </label>
              <input
                id="airtime-amount"
                type="number"
                min={50}
                max={50000}
                required
                value={airtimeAmount}
                onChange={(e) => setAirtimeAmount(e.target.value)}
                className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-slate-200 font-mono text-lg tabular-nums focus:outline-none focus:border-[#0A192F]"
              />
              <div className="flex flex-wrap gap-2">
                {['100', '200', '500', '1000', '2000', '5000'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAirtimeAmount(preset)}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-lg border text-xs font-mono font-semibold tabular-nums transition-colors ${
                      airtimeAmount === preset
                        ? 'bg-[#0A192F] text-white border-[#0A192F]'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    ₦{Number(preset).toLocaleString()}
                  </button>
                ))}
              </div>
              <p className="text-xs text-emerald-700 font-medium">
                2% automatic cashback discount applied — You pay {formatNaira(airtimePayable)}.
              </p>
            </div>
          )}
        </div>

        {/* Order Summary & Checkout */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 space-y-5 sticky top-24">
          <h2 className="text-lg font-bold text-[#0A192F]">Checkout Summary</h2>

          <dl className="space-y-3 text-sm border-b border-slate-100 pb-4">
            <div className="flex justify-between">
              <dt className="text-slate-500">Service</dt>
              <dd className="font-semibold text-[#0A192F]">
                {mode === 'DATA' ? selectedPlan?.name || 'Select a plan' : `${network} Airtime`}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Recipient</dt>
              <dd className="font-mono text-slate-800 tabular-nums">{phoneNumber || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Total Due</dt>
              <dd className="text-xl font-bold text-[#0A192F] tabular-nums">{formatNaira(totalPayable)}</dd>
            </div>
          </dl>

          <div className="space-y-2.5">
            <span className="block text-xs font-semibold text-slate-700">Payment Method</span>
            <button
              type="button"
              onClick={() => setPaymentMethod('WALLET')}
              className={`w-full p-3.5 rounded-xl border-2 text-left flex items-center justify-between transition-colors ${
                paymentMethod === 'WALLET'
                  ? 'border-[#0A192F] bg-[#0A192F]/5'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <Wallet className="w-5 h-5 text-[#0A192F]" />
                <div>
                  <p className="text-sm font-bold text-[#0A192F]">Wallet Balance</p>
                  <p className="text-xs text-slate-500 tabular-nums">{formatNaira(profile.walletBalance)}</p>
                </div>
              </div>
              {paymentMethod === 'WALLET' && <Check className="w-4 h-4 text-[#0A192F]" />}
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('PAYSTACK_CARD')}
              className={`w-full p-3.5 rounded-xl border-2 text-left flex items-center justify-between transition-colors ${
                paymentMethod === 'PAYSTACK_CARD'
                  ? 'border-[#0A192F] bg-[#0A192F]/5'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-[#B8921F]" />
                <div>
                  <p className="text-sm font-bold text-[#0A192F]">Debit Card / Paystack</p>
                  <p className="text-xs text-slate-500">Instant card verification</p>
                </div>
              </div>
              {paymentMethod === 'PAYSTACK_CARD' && <Check className="w-4 h-4 text-[#0A192F]" />}
            </button>
          </div>

          {paymentMethod === 'WALLET' && profile.walletBalance < totalPayable && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-slate-800 space-y-2">
              <p className="font-medium">Wallet balance is lower than {formatNaira(totalPayable)}.</p>
              <button
                type="button"
                onClick={onGoToWallet}
                className="font-bold text-[#0A192F] underline"
              >
                Fund Wallet Now
              </button>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-xs font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || totalPayable <= 0}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#D4AF37] hover:bg-[#C59B27] text-[#0A192F] font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{submitting ? 'Delivering Instantly...' : `Pay ${formatNaira(totalPayable)} Now`}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

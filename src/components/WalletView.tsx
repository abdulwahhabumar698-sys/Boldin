import React, { useEffect, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Copy,
  CreditCard,
  Gift,
  RefreshCw,
  Search,
  Wallet,
} from 'lucide-react';
import { TransactionRecord, UserProfile } from '../types';
import { formatNaira, formatTimestamp } from '../lib/firebase';
import { apiFetch } from '../lib/api';

interface WalletViewProps {
  profile: UserProfile;
  transactions: TransactionRecord[];
  onCreateDeposit: (params: {
    amount: number;
    method: 'BANK_TRANSFER' | 'DEBIT_CARD' | 'GATEWAY';
    reference: string;
    virtualAccount: string;
  }) => Promise<string>;
  onConfirmDeposit: (params: {
    depositId: string;
    amount: number;
    method: 'BANK_TRANSFER' | 'PAYSTACK_CARD';
    reference: string;
  }) => Promise<TransactionRecord>;
  onConvertBonus: (amount: number) => Promise<void>;
  onOpenReceipt: (tx: TransactionRecord) => void;
  onCheckTxStatus: (tx: TransactionRecord) => Promise<void>;
}

export const WalletView: React.FC<WalletViewProps> = ({
  profile,
  transactions,
  onCreateDeposit,
  onConfirmDeposit,
  onConvertBonus,
  onOpenReceipt,
  onCheckTxStatus,
}) => {
  const [fundMethod, setFundMethod] = useState<'BANK_TRANSFER' | 'DEBIT_CARD'>('BANK_TRANSFER');
  const [amountInput, setAmountInput] = useState('2000');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedAccount, setCopiedAccount] = useState(false);

  const [pendingTransfer, setPendingTransfer] = useState<{
    depositId: string;
    reference: string;
    amount: number;
    bankName: string;
    accountName: string;
    virtualAccount: string;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionRecord['type']>('ALL');

  // Automatic payment confirmation polling for pending bank transfer
  useEffect(() => {
    if (!pendingTransfer) return;
    const timer = setInterval(async () => {
      try {
        const res = await apiFetch<{ confirmed: boolean; amount: number; reference: string }>(
          '/api/payments/verify',
          {
            method: 'POST',
            body: JSON.stringify({
              reference: pendingTransfer.reference,
              amount: pendingTransfer.amount,
            }),
          }
        );
        if (res.confirmed) {
          const tx = await onConfirmDeposit({
            depositId: pendingTransfer.depositId,
            amount: res.amount,
            method: 'BANK_TRANSFER',
            reference: res.reference,
          });
          setPendingTransfer(null);
          setSuccessMsg(`Automatic confirmation succeeded: ${formatNaira(res.amount)} credited to your wallet.`);
          onOpenReceipt(tx);
        }
      } catch {
        // Retry silently on next poll cycle
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [pendingTransfer, onConfirmDeposit, onOpenReceipt]);

  const handleInitializeFunding = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount < 100 || amount > 5000000) {
      setError('Enter a funding amount between ₦100 and ₦5,000,000.');
      return;
    }

    setLoading(true);
    try {
      const init = await apiFetch<{
        reference: string;
        amount: number;
        mode: string;
        bankName?: string;
        accountName?: string;
        virtualAccount?: string;
        authorizationUrl?: string;
      }>('/api/payments/initialize', {
        method: 'POST',
        body: JSON.stringify({ amount, method: fundMethod }),
      });

      const depositId = await onCreateDeposit({
        amount,
        method: fundMethod,
        reference: init.reference,
        virtualAccount: init.virtualAccount || 'PAYSTACK',
      });

      if (fundMethod === 'BANK_TRANSFER') {
        setPendingTransfer({
          depositId,
          reference: init.reference,
          amount,
          bankName: init.bankName || 'Wema Bank (Dr Boldin Settlement)',
          accountName: init.accountName || `DR BOLDIN - ${profile.fullName}`,
          virtualAccount: init.virtualAccount || '9040000000',
        });
      } else {
        const verified = await apiFetch<{ confirmed: boolean; amount: number; reference: string }>(
          '/api/payments/verify',
          {
            method: 'POST',
            body: JSON.stringify({ reference: init.reference, amount }),
          }
        );
        if (verified.confirmed) {
          const tx = await onConfirmDeposit({
            depositId,
            amount: verified.amount,
            method: 'PAYSTACK_CARD',
            reference: verified.reference,
          });
          setSuccessMsg(`${formatNaira(verified.amount)} credited to your wallet via Debit Card.`);
          onOpenReceipt(tx);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to initiate wallet funding.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualConfirmTransfer = async () => {
    if (!pendingTransfer) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ confirmed: boolean; amount: number; reference: string }>(
        '/api/payments/verify',
        {
          method: 'POST',
          body: JSON.stringify({
            reference: pendingTransfer.reference,
            amount: pendingTransfer.amount,
          }),
        }
      );
      if (res.confirmed) {
        const tx = await onConfirmDeposit({
          depositId: pendingTransfer.depositId,
          amount: res.amount,
          method: 'BANK_TRANSFER',
          reference: res.reference,
        });
        setPendingTransfer(null);
        setSuccessMsg(`Bank transfer confirmed: ${formatNaira(res.amount)} added to your wallet.`);
        onOpenReceipt(tx);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirmation pending. Try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  const handleConvertAllBonus = async () => {
    if (profile.bonusBalance <= 0) return;
    setLoading(true);
    setError(null);
    try {
      await onConvertBonus(profile.bonusBalance);
      setSuccessMsg(`Converted ${formatNaira(profile.bonusBalance)} referral bonus into your main wallet.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to convert bonus.');
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    const matchesType = typeFilter === 'ALL' || tx.type === typeFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      tx.planName.toLowerCase().includes(q) ||
      tx.reference.toLowerCase().includes(q) ||
      tx.phoneNumber.toLowerCase().includes(q) ||
      tx.network.toLowerCase().includes(q);
    return matchesType && matchesQuery;
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0A192F] tracking-tight">
          Wallet &amp; Transaction History
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Fund your wallet via automated bank transfer or debit card and review every receipt.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Balances & Bonus Conversion */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#0A192F] text-white rounded-2xl p-6">
            <div className="flex items-center gap-2 text-xs font-medium text-[#E5C158]">
              <Wallet className="w-4 h-4" />
              <span>Main Wallet Balance</span>
            </div>
            <p className="text-3xl sm:text-4xl font-bold tabular-nums mt-2">
              {formatNaira(profile.walletBalance)}
            </p>
            <p className="text-xs text-slate-300 mt-2">
              Account Owner: {profile.fullName}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#B8921F]">
                <Gift className="w-4 h-4" />
                <span>Referral Bonus Wallet</span>
              </div>
              <p className="text-2xl font-bold text-[#0A192F] tabular-nums mt-1">
                {formatNaira(profile.bonusBalance)}
              </p>
            </div>
            <button
              type="button"
              disabled={loading || profile.bonusBalance <= 0}
              onClick={handleConvertAllBonus}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0A192F] text-white text-xs font-semibold hover:bg-[#112240] transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              Move to Wallet
            </button>
          </div>
        </div>

        {/* Fund Wallet Panel */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-[#0A192F]">Fund Wallet</h2>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
              <button
                type="button"
                onClick={() => {
                  setFundMethod('BANK_TRANSFER');
                  setPendingTransfer(null);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  fundMethod === 'BANK_TRANSFER' ? 'bg-white text-[#0A192F] shadow-sm' : 'text-slate-600'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Bank Transfer</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFundMethod('DEBIT_CARD');
                  setPendingTransfer(null);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  fundMethod === 'DEBIT_CARD' ? 'bg-white text-[#0A192F] shadow-sm' : 'text-slate-600'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Debit Card</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl p-3">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {pendingTransfer ? (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#B8921F]">
                  Automated Transfer Instruction · Auto-Confirm Active
                </p>
                <span className="text-xs font-mono text-slate-500">{pendingTransfer.reference}</span>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Bank Name</dt>
                  <dd className="font-semibold text-[#0A192F] mt-0.5">{pendingTransfer.bankName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Account Name</dt>
                  <dd className="font-semibold text-[#0A192F] mt-0.5">{pendingTransfer.accountName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Account Number</dt>
                  <dd className="flex items-center gap-2 font-mono text-lg font-bold text-[#0A192F] tabular-nums mt-0.5">
                    <span>{pendingTransfer.virtualAccount}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(pendingTransfer.virtualAccount);
                        setCopiedAccount(true);
                        setTimeout(() => setCopiedAccount(false), 1800);
                      }}
                      className="text-xs font-sans font-semibold text-[#B8921F] flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedAccount ? 'Copied' : 'Copy'}</span>
                    </button>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Exact Amount to Transfer</dt>
                  <dd className="text-lg font-bold text-[#0A192F] tabular-nums mt-0.5">
                    {formatNaira(pendingTransfer.amount)}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleManualConfirmTransfer}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C59B27] text-[#0A192F] text-sm font-bold transition-colors disabled:opacity-60"
                >
                  {loading ? 'Confirming...' : 'I Have Sent the Transfer'}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingTransfer(null)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleInitializeFunding} className="space-y-4">
              <div>
                <label htmlFor="fund-amount" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Amount to Fund (₦)
                </label>
                <input
                  id="fund-amount"
                  type="number"
                  min={100}
                  max={5000000}
                  required
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-200 font-mono text-lg tabular-nums focus:outline-none focus:border-[#0A192F]"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {['500', '1000', '2000', '5000', '10000'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmountInput(preset)}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-lg border text-xs font-mono font-semibold tabular-nums transition-colors ${
                      amountInput === preset
                        ? 'bg-[#0A192F] text-white border-[#0A192F]'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    ₦{Number(preset).toLocaleString()}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#D4AF37] hover:bg-[#C59B27] text-[#0A192F] font-bold text-sm transition-colors disabled:opacity-60"
              >
                {loading
                  ? 'Processing...'
                  : fundMethod === 'BANK_TRANSFER'
                    ? 'Generate Automated Bank Transfer Account'
                    : `Pay ${formatNaira(Number(amountInput) || 0)} with Debit Card`}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Full Transaction History */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#0A192F]">Transaction History</h2>
            <p className="text-xs text-slate-500">Real-time ledger of every purchase, deposit, and bonus credit.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reference or phone..."
                className="min-h-[40px] pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#0A192F] w-full sm:w-56"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
              {(
                [
                  { id: 'ALL', label: 'All' },
                  { id: 'DATA', label: 'Data' },
                  { id: 'AIRTIME', label: 'Airtime' },
                  { id: 'WALLET_FUND', label: 'Funding' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTypeFilter(tab.id)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                    typeFilter === tab.id ? 'bg-white text-[#0A192F] shadow-sm' : 'text-slate-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No matching transactions found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500 bg-slate-50/70">
                  <th className="py-3 px-5 font-semibold">Item / Plan</th>
                  <th className="py-3 px-4 font-semibold">Recipient</th>
                  <th className="py-3 px-4 font-semibold">Reference</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold text-right">Amount</th>
                  <th className="py-3 px-5 font-semibold text-right">Status &amp; Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-5">
                      <p className="font-semibold text-[#0A192F]">{tx.planName}</p>
                      <p className="text-xs text-slate-500">{tx.network} · {tx.paymentMethod.replace('_', ' ')}</p>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-700 tabular-nums">
                      {tx.phoneNumber || 'Wallet'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">{tx.reference}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {formatTimestamp(tx.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#0A192F] text-right tabular-nums whitespace-nowrap">
                      {tx.type === 'WALLET_FUND' || tx.type === 'BONUS_CLAIM' ? '+' : '-'}
                      {formatNaira(tx.amount)}
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <span
                          className={`text-xs font-semibold ${
                            tx.status === 'SUCCESS'
                              ? 'text-emerald-700'
                              : tx.status === 'FAILED'
                                ? 'text-rose-700'
                                : 'text-amber-700'
                          }`}
                        >
                          {tx.status}
                        </span>
                        {(tx.status === 'PENDING' || tx.status === 'PROCESSING') && (
                          <button
                            type="button"
                            onClick={() => onCheckTxStatus(tx)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                            title="Verify status"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenReceipt(tx)}
                          className="text-xs font-semibold text-[#0A192F] hover:text-[#B8921F] underline"
                        >
                          Receipt
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

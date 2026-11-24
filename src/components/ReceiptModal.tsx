import React, { useState } from 'react';
import { CheckCircle2, Clock, Printer, RefreshCw, X, AlertCircle } from 'lucide-react';
import { TransactionRecord } from '../types';
import { formatNaira, formatTimestamp } from '../lib/firebase';
import { apiFetch } from '../lib/api';

interface ReceiptModalProps {
  transaction: TransactionRecord | null;
  onClose: () => void;
  onStatusUpdated?: (txId: string, status: TransactionRecord['status'], message: string, providerRef?: string) => Promise<void>;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  transaction,
  onClose,
  onStatusUpdated,
}) => {
  const [checking, setChecking] = useState(false);
  const [checkFeedback, setCheckFeedback] = useState<string | null>(null);

  if (!transaction) return null;

  const handleCheckStatus = async () => {
    setChecking(true);
    setCheckFeedback(null);
    try {
      const res = await apiFetch<{
        status: TransactionRecord['status'];
        message: string;
        providerReference?: string;
      }>(`/api/vtu/status/${encodeURIComponent(transaction.reference)}`);
      if (onStatusUpdated && (res.status !== transaction.status || res.message !== transaction.apiMessage)) {
        await onStatusUpdated(transaction.id, res.status, res.message, res.providerReference);
      }
      setCheckFeedback(`Switch Status: ${res.status} — ${res.message}`);
    } catch (err) {
      setCheckFeedback(err instanceof Error ? err.message : 'Unable to verify status right now.');
    } finally {
      setChecking(false);
    }
  };

  const statusConfig = {
    SUCCESS: { label: 'Delivered', icon: CheckCircle2, color: 'text-emerald-700' },
    PROCESSING: { label: 'Processing', icon: Clock, color: 'text-amber-700' },
    PENDING: { label: 'Pending', icon: Clock, color: 'text-amber-700' },
    FAILED: { label: 'Failed', icon: AlertCircle, color: 'text-rose-700' },
  }[transaction.status];

  const StatusIcon = statusConfig.icon;

  return (
    <div className="fixed inset-0 z-50 bg-[#061021]/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full overflow-hidden shadow-xl">
        <div className="bg-[#0A192F] px-6 py-5 flex items-center justify-between text-white">
          <div>
            <p className="text-xs font-medium text-[#E5C158]">DR BOLDIN DATA SUB</p>
            <h3 className="text-lg font-bold tracking-tight mt-0.5">Transaction Receipt</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt"
            className="no-print min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="text-center pb-5 border-b border-slate-100">
            <div className={`inline-flex items-center gap-1.5 text-sm font-semibold ${statusConfig.color} mb-2`}>
              <StatusIcon className="w-4 h-4" />
              <span>{statusConfig.label}</span>
            </div>
            <p className="text-3xl font-bold text-[#0A192F] tabular-nums">
              {formatNaira(transaction.amount)}
            </p>
            <p className="text-xs text-slate-500 mt-1">{transaction.planName}</p>
          </div>

          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Type</dt>
              <dd className="font-medium text-slate-900">{transaction.type.replace('_', ' ')}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Network</dt>
              <dd className="font-medium text-slate-900">{transaction.network}</dd>
            </div>
            {transaction.phoneNumber && (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Recipient</dt>
                <dd className="font-mono text-slate-900 tabular-nums">{transaction.phoneNumber}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Payment Method</dt>
              <dd className="font-medium text-slate-900">{transaction.paymentMethod.replace('_', ' ')}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Reference</dt>
              <dd className="font-mono text-xs text-slate-800 break-all text-right">{transaction.reference}</dd>
            </div>
            {transaction.providerReference && (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Provider Ref</dt>
                <dd className="font-mono text-xs text-slate-800 break-all text-right">
                  {transaction.providerReference}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Date</dt>
              <dd className="text-slate-800 tabular-nums">{formatTimestamp(transaction.createdAt)}</dd>
            </div>
          </dl>

          {transaction.apiMessage && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
              {transaction.apiMessage}
            </div>
          )}

          {checkFeedback && (
            <div className="bg-[#0A192F]/5 border border-[#0A192F]/15 rounded-xl p-3 text-xs font-medium text-[#0A192F]">
              {checkFeedback}
            </div>
          )}

          <div className="no-print flex flex-wrap gap-3 pt-2">
            {(transaction.type === 'DATA' || transaction.type === 'AIRTIME') && (
              <button
                type="button"
                onClick={handleCheckStatus}
                disabled={checking}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
                <span className="whitespace-nowrap">Check Status</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0A192F] text-white text-sm font-semibold hover:bg-[#112240] transition-colors flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span className="whitespace-nowrap">Print Receipt</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { CheckCircle2, Headphones, MessageSquarePlus } from 'lucide-react';
import { SupportTicket, TransactionRecord } from '../types';
import { formatTimestamp } from '../lib/firebase';

interface SupportViewProps {
  tickets: SupportTicket[];
  transactions: TransactionRecord[];
  onSubmitTicket: (params: {
    subject: string;
    transactionRef: string;
    message: string;
  }) => Promise<void>;
}

export const SupportView: React.FC<SupportViewProps> = ({
  tickets,
  transactions,
  onSubmitTicket,
}) => {
  const [subject, setSubject] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      await onSubmitTicket({
        subject: subject.trim(),
        transactionRef: transactionRef.trim(),
        message: message.trim(),
      });
      setSubject('');
      setTransactionRef('');
      setMessage('');
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit support ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0A192F] tracking-tight">
          Customer Support &amp; Complaints
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Report delayed data delivery, unconfirmed bank transfers, or account inquiries directly to our support desk.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2 text-[#0A192F]">
            <MessageSquarePlus className="w-5 h-5 text-[#B8921F]" />
            <h2 className="text-lg font-bold">Open Support Ticket</h2>
          </div>

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Your complaint has been logged. An administrator will respond shortly.</span>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-xs font-medium">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="ticket-subject" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Subject
            </label>
            <input
              id="ticket-subject"
              type="text"
              required
              minLength={3}
              maxLength={140}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Delayed MTN 2GB delivery"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0A192F]"
            />
          </div>

          <div>
            <label htmlFor="ticket-ref" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Transaction Reference (Optional)
            </label>
            <select
              id="ticket-ref"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono bg-white focus:outline-none focus:border-[#0A192F]"
            >
              <option value="">No specific transaction</option>
              {transactions.slice(0, 15).map((tx) => (
                <option key={tx.id} value={tx.reference}>
                  {tx.reference} · {tx.planName} ({tx.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ticket-message" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Describe Your Issue
            </label>
            <textarea
              id="ticket-message"
              required
              minLength={5}
              maxLength={1000}
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Include recipient phone number and details of the transaction..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#0A192F]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#0A192F] hover:bg-[#112240] text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {submitting ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </form>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Headphones className="w-5 h-5 text-[#0A192F]" />
            <h2 className="text-lg font-bold text-[#0A192F]">Your Support Tickets</h2>
          </div>

          {tickets.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No support tickets submitted yet. Use the form on the left if you need help.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {tickets.map((t) => (
                <div key={t.id} className="p-6 space-y-2.5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-[#0A192F]">{t.subject}</h3>
                      <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                        {formatTimestamp(t.createdAt)}
                        {t.transactionRef ? ` · Ref: ${t.transactionRef}` : ''}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold shrink-0 ${
                        t.status === 'RESOLVED'
                          ? 'text-emerald-700'
                          : t.status === 'IN_PROGRESS'
                            ? 'text-amber-700'
                            : 'text-[#0A192F]'
                      }`}
                    >
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-sm text-slate-700 leading-relaxed">{t.message}</p>

                  {t.adminReply && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mt-2">
                      <p className="text-xs font-semibold text-[#B8921F] mb-1">Admin Response</p>
                      <p className="text-sm text-slate-800">{t.adminReply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

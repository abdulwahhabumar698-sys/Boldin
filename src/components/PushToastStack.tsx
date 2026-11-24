import React from 'react';
import { BellRing, Gift, Tag, CheckCircle2, X } from 'lucide-react';
import { InAppPushToast } from '../lib/notifications';
import { AppTab } from '../types';

interface PushToastStackProps {
  toasts: InAppPushToast[];
  onDismiss: (id: string) => void;
  onNavigate: (tab: AppTab) => void;
}

export const PushToastStack: React.FC<PushToastStackProps> = ({
  toasts,
  onDismiss,
  onNavigate,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Live push notifications"
      className="no-print fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col gap-3 max-w-sm w-[calc(100vw-2rem)]"
    >
      {toasts.map((toast) => {
        const Icon =
          toast.category === 'TRANSACTION'
            ? CheckCircle2
            : toast.category === 'REFERRAL'
              ? Gift
              : toast.category === 'PROMO'
                ? Tag
                : BellRing;

        const accentText =
          toast.category === 'TRANSACTION'
            ? 'text-emerald-400'
            : toast.category === 'REFERRAL'
              ? 'text-[#E5C158]'
              : toast.category === 'PROMO'
                ? 'text-[#E5C158]'
                : 'text-sky-300';

        const categoryLabel =
          toast.category === 'TRANSACTION'
            ? 'Data Purchase Alert'
            : toast.category === 'REFERRAL'
              ? 'Referral Bonus Alert'
              : toast.category === 'PROMO'
                ? 'Special Offer'
                : 'System Notice';

        return (
          <div
            key={toast.id}
            className="bg-[#0A192F] text-white border border-white/15 rounded-2xl p-4 shadow-xl flex items-start gap-3 transition-transform"
          >
            <div className={`mt-0.5 shrink-0 ${accentText}`}>
              <Icon className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <p className={`text-[11px] font-semibold ${accentText}`}>{categoryLabel}</p>
              <p className="text-sm font-bold text-white leading-snug mt-0.5">{toast.title}</p>
              <p className="text-xs text-slate-300 leading-relaxed mt-1">{toast.body}</p>
              {toast.targetTab && (
                <button
                  type="button"
                  onClick={() => {
                    onNavigate(toast.targetTab!);
                    onDismiss(toast.id);
                  }}
                  className="mt-2 text-xs font-semibold text-[#E5C158] hover:text-white transition-colors"
                >
                  View Details
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

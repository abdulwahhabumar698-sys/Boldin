import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Lock, Phone, ShieldCheck, Smartphone, Wallet } from 'lucide-react';
import { DataPlan, UserProfile } from '../types';
import { apiFetch } from '../lib/api';
import { formatNaira } from '../lib/firebase';

interface LandingAuthViewProps {
  onGoogleSignIn: (referralCodeInput: string) => Promise<void>;
  signingIn: boolean;
  authError: string | null;
  previewPlans: DataPlan[];
  initialRefCode: string;
}

export const LandingAuthView: React.FC<LandingAuthViewProps> = ({
  onGoogleSignIn,
  signingIn,
  authError,
  previewPlans,
  initialRefCode,
}) => {
  const [refInput, setRefInput] = useState(initialRefCode);
  const displayPlans = previewPlans.slice(0, 4);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-2.5 shrink-0">
            <img
              src="/src/assets/images/brand_emblem_1795477336656.jpg"
              alt="DR BOLDIN DATA SUB emblem"
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-lg object-cover border border-slate-200"
            />
            <span className="font-display font-bold text-lg text-[#0A192F] whitespace-nowrap shrink-0">
              DR BOLDIN DATA SUB
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#networks" className="hover:text-[#0A192F] transition-colors whitespace-nowrap shrink-0">
              Networks
            </a>
            <a href="#rates" className="hover:text-[#0A192F] transition-colors whitespace-nowrap shrink-0">
              Data Rates
            </a>
            <a href="#payments" className="hover:text-[#0A192F] transition-colors whitespace-nowrap shrink-0">
              Wallet Funding
            </a>
            <a href="#referrals" className="hover:text-[#0A192F] transition-colors whitespace-nowrap shrink-0">
              Referrals
            </a>
          </nav>

          <button
            type="button"
            onClick={() => onGoogleSignIn(refInput)}
            disabled={signingIn}
            className="min-h-[40px] px-5 py-2 rounded-xl bg-[#0A192F] text-white text-sm font-semibold hover:bg-[#112240] transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            {signingIn ? 'Connecting...' : 'Sign In'}
          </button>
        </div>
      </header>

      <main>
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-sm font-semibold text-[#B8921F] mb-3">
                Nigeria Mobile Data &amp; Airtime VTU
              </p>
              <h1 className="text-4xl sm:text-5xl font-bold text-[#0A192F] tracking-tight leading-[1.1] [text-wrap:balance] mb-5">
                Your Reliable Data Plug — Fast, Cheap and Reliable.
              </h1>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl mb-8">
                Purchase MTN SME, Airtel Corporate, Glo, and 9mobile data bundles and airtime in seconds.
                Automated wallet funding via bank transfer or debit card with instant delivery receipts.
              </p>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 max-w-md space-y-4">
                <div>
                  <label htmlFor="ref-code-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Referral Code (Optional)
                  </label>
                  <input
                    id="ref-code-input"
                    type="text"
                    value={refInput}
                    onChange={(e) => setRefInput(e.target.value.toUpperCase())}
                    placeholder="e.g. BOLDIN-8421"
                    maxLength={32}
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono uppercase focus:outline-none focus:border-[#0A192F]"
                  />
                </div>

                {authError && (
                  <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                    {authError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => onGoogleSignIn(refInput)}
                  disabled={signingIn}
                  className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#D4AF37] hover:bg-[#C59B27] text-[#0A192F] font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <span>{signingIn ? 'Signing in...' : 'Continue with Google Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-6 flex">
              <div className="relative w-full rounded-3xl overflow-hidden bg-[#0A192F] min-h-[340px] lg:min-h-[460px] flex flex-col justify-end p-6 sm:p-8">
                <img
                  src="/src/assets/images/hero_data_plug_1795477336657.jpg"
                  alt="High-speed fiber and mobile data signal waves in deep navy and gold"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#061021]/95 via-[#0A192F]/55 to-transparent" />
                <div className="relative z-10 text-white space-y-4">
                  <p className="text-xs font-medium text-[#E5C158]">
                    Live Automated VTU Switch · Instant Delivery
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { name: 'MTN', rate: '1GB · ₦265' },
                      { name: 'Airtel', rate: '1GB · ₦285' },
                      { name: 'Glo', rate: '1GB · ₦260' },
                      { name: '9mobile', rate: '1GB · ₦210' },
                    ].map((net) => (
                      <div key={net.name} className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3">
                        <p className="text-xs font-semibold text-[#E5C158]">{net.name}</p>
                        <p className="text-sm font-bold tabular-nums mt-0.5">{net.rate}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="networks" className="border-t border-slate-200 bg-white py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <Smartphone className="w-6 h-6 text-[#0A192F]" />
              <h2 className="text-lg font-bold text-[#0A192F]">All 4 Nigerian Networks</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                MTN SME &amp; Corporate, Airtel Gifting, Glo Corporate, and 9mobile bundles delivered in seconds with automatic prefix detection.
              </p>
            </div>
            <div id="payments" className="space-y-2">
              <Wallet className="w-6 h-6 text-[#B8921F]" />
              <h2 className="text-lg font-bold text-[#0A192F]">Automated Wallet Funding</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Fund instantly via dedicated NUBAN bank transfer or debit card checkout with automated confirmation and printable receipts.
              </p>
            </div>
            <div id="referrals" className="space-y-2">
              <ShieldCheck className="w-6 h-6 text-[#0A192F]" />
              <h2 className="text-lg font-bold text-[#0A192F]">OTP Protected &amp; Rewarding</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Every account is protected with OTP verification and earns ₦150 referral bonuses plus 2.5% commission perks.
              </p>
            </div>
          </div>
        </section>

        {displayPlans.length > 0 && (
          <section id="rates" className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
            <div className="flex items-end justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#0A192F]">Featured Data Subscriptions</h2>
                <p className="text-sm text-slate-600 mt-1">Sign in to purchase any plan directly from your wallet or card.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {displayPlans.map((plan) => (
                <div key={plan.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                      <span className="font-semibold text-[#0A192F]">{plan.network}</span>
                      <span>{plan.category} · {plan.validity}</span>
                    </div>
                    <h3 className="text-lg font-bold text-[#0A192F]">{plan.dataVolume}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{plan.name}</p>
                  </div>
                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xl font-bold text-[#0A192F] tabular-nums">
                      {formatNaira(plan.sellingPrice)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onGoogleSignIn(refInput)}
                      className="text-xs font-semibold text-[#B8921F] hover:text-[#0A192F] transition-colors"
                    >
                      Buy Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

interface OtpVerificationScreenProps {
  profile: UserProfile;
  onVerified: (phone: string) => Promise<void>;
  onSignOut: () => Promise<void>;
}

export const OtpVerificationScreen: React.FC<OtpVerificationScreenProps> = ({
  profile,
  onVerified,
  onSignOut,
}) => {
  const [phone, setPhone] = useState(profile.phone || '');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewNotice, setPreviewNotice] = useState<string | null>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPreviewNotice(null);
    try {
      const res = await apiFetch<{
        sent: boolean;
        phone: string;
        channel: string;
        previewCode?: string;
      }>('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      setPhone(res.phone);
      setStep('code');
      if (res.previewCode) {
        setPreviewNotice(`Verification OTP (${res.channel} test mode): ${res.previewCode}`);
      } else {
        setPreviewNotice(`A 6-digit verification code has been sent via ${res.channel}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ verified: boolean; phone: string }>('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ code: otpCode }),
      });
      if (res.verified) {
        await onVerified(res.phone);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-[#0A192F] px-6 py-6 text-white">
          <div className="flex items-center gap-2 text-[#E5C158] text-xs font-semibold mb-1.5">
            <Lock className="w-4 h-4" />
            <span>Account Security Verification</span>
          </div>
          <h1 className="text-xl font-bold">Verify Your Phone Number</h1>
          <p className="text-xs text-slate-300 mt-1">
            Signed in as {profile.email}. Complete one-time OTP verification to activate your wallet.
          </p>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl p-3">
              {error}
            </div>
          )}

          {previewNotice && (
            <div className="bg-amber-50 border border-amber-200 text-[#0A192F] text-xs font-medium rounded-xl p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#B8921F] shrink-0" />
              <span>{previewNotice}</span>
            </div>
          )}

          {step === 'phone' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label htmlFor="otp-phone" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nigerian Mobile Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="otp-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0803 123 4567"
                    className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono tabular-nums focus:outline-none focus:border-[#0A192F]"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#0A192F] hover:bg-[#112240] text-white text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {loading ? 'Sending OTP...' : 'Send 6-Digit OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label htmlFor="otp-code" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Enter 6-Digit Verification Code for {phone}
                </label>
                <input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-200 text-center text-xl font-mono tracking-[0.35em] tabular-nums focus:outline-none focus:border-[#0A192F]"
                />
              </div>
              <button
                type="submit"
                disabled={loading || otpCode.length !== 6}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#D4AF37] hover:bg-[#C59B27] text-[#0A192F] text-sm font-bold transition-colors disabled:opacity-60"
              >
                {loading ? 'Verifying...' : 'Verify & Activate Wallet'}
              </button>
              <button
                type="button"
                onClick={() => setStep('phone')}
                className="w-full min-h-[40px] text-xs font-medium text-slate-500 hover:text-[#0A192F]"
              >
                Change phone number or resend code
              </button>
            </form>
          )}

          <div className="pt-3 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={onSignOut}
              className="text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Sign out and switch account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

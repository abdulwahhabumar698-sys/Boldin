import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Gift,
  Percent,
  Share2,
  Users,
  Wallet,
} from 'lucide-react';
import { ReferralRecord, UserProfile } from '../types';
import { formatNaira, formatTimestamp } from '../lib/firebase';

interface ReferralViewProps {
  profile: UserProfile;
  referrals: ReferralRecord[];
  onClaimPendingBonuses: () => Promise<number>;
  onConvertBonusToWallet: (amount: number) => Promise<void>;
  onApplyReferralCode: (code: string) => Promise<void>;
}

export const ReferralView: React.FC<ReferralViewProps> = ({
  profile,
  referrals,
  onClaimPendingBonuses,
  onConvertBonusToWallet,
  onApplyReferralCode,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [friendCode, setFriendCode] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'credited' | 'pending'>('ALL');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inviteUrl = `${window.location.origin}/?ref=${encodeURIComponent(profile.referralCode)}`;

  const totalReferrals = referrals.length;
  const creditedBonuses = referrals
    .filter((r) => r.status === 'credited')
    .reduce((sum, r) => sum + r.bonusAmount, 0);
  const pendingReferrals = referrals.filter((r) => r.status === 'pending');
  const pendingBonusTotal = pendingReferrals.reduce((sum, r) => sum + r.bonusAmount, 0);

  const filteredReferrals = referrals.filter(
    (r) => statusFilter === 'ALL' || r.status === statusFilter
  );

  const handleCopyCode = () => {
    navigator.clipboard.writeText(profile.referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(
    `Buy cheap MTN, Airtel, Glo & 9mobile data on DR BOLDIN DATA SUB! Use my referral code ${profile.referralCode} when signing in: ${inviteUrl}`
  )}`;

  const handleClaimPending = async () => {
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const claimed = await onClaimPendingBonuses();
      if (claimed > 0) {
        setFeedback(`Successfully claimed ${formatNaira(claimed)} into your Referral Bonus balance.`);
      } else {
        setFeedback('No pending referral bonuses ready to claim right now.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to claim bonuses.');
    } finally {
      setBusy(false);
    }
  };

  const handleMoveToWallet = async () => {
    if (profile.bonusBalance <= 0) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const amount = profile.bonusBalance;
      await onConvertBonusToWallet(amount);
      setFeedback(`${formatNaira(amount)} moved from your Bonus Wallet to your Main Wallet.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to transfer bonus to wallet.');
    } finally {
      setBusy(false);
    }
  };

  const handleApplyFriendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendCode.trim()) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      await onApplyReferralCode(friendCode.trim().toUpperCase());
      setFriendCode('');
      setFeedback('Referral code linked successfully. Your referrer has been awarded their bonus.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid referral code.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Hero Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-[#0A192F] text-white rounded-3xl p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold text-[#E5C158]">DR BOLDIN Referral Program</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight [text-wrap:balance] mt-2">
              Invite Friends, Earn Instant Cash &amp; Data Bonuses
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed mt-3 max-w-xl">
              Share your unique DR BOLDIN DATA SUB code with friends, classmates, and business resellers.
              Every verified sign-up earns you instant Naira bonuses you can spend on any network or convert to your wallet.
            </p>
          </div>

          {/* Unique Referral Code Box */}
          <div className="mt-8 bg-white/10 border border-white/15 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs text-slate-300">Your Unique Referral Code</p>
                <p className="text-2xl sm:text-3xl font-mono font-bold tracking-wider text-[#E5C158] mt-1">
                  {profile.referralCode}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#C59B27] text-[#0A192F] text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCode ? 'Code Copied' : 'Copy Code'}</span>
                </button>
                <a
                  href={whatsappShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share Invite</span>
                </a>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-xs font-mono text-slate-300 truncate">{inviteUrl}</p>
              <button
                type="button"
                onClick={handleCopyLink}
                className="text-xs font-semibold text-[#E5C158] hover:text-white transition-colors shrink-0 text-left sm:text-right"
              >
                {copiedLink ? 'Invite Link Copied' : 'Copy Referral Link'}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-3xl overflow-hidden border border-slate-200 bg-white flex flex-col">
          <div className="relative h-48 sm:h-56">
            <img
              src="/src/assets/images/referral_rewards_banner_1795477337086.jpg"
              alt="Dual luxury navy and gold referral reward cards"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
            <div>
              <h2 className="text-lg font-bold text-[#0A192F]">Bonus Wallet Overview</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Claim pending referral rewards or transfer available bonus straight into your main wallet.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">Available Bonus</p>
                <p className="text-2xl font-bold text-[#0A192F] tabular-nums mt-0.5">
                  {formatNaira(profile.bonusBalance)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Pending Claims</p>
                <p className="text-2xl font-bold text-[#B8921F] tabular-nums mt-0.5">
                  {formatNaira(pendingBonusTotal)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {pendingReferrals.length > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleClaimPending}
                  className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C59B27] text-[#0A192F] text-xs font-bold transition-colors disabled:opacity-60 whitespace-nowrap"
                >
                  Claim {formatNaira(pendingBonusTotal)}
                </button>
              )}
              <button
                type="button"
                disabled={busy || profile.bonusBalance <= 0}
                onClick={handleMoveToWallet}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0A192F] hover:bg-[#112240] text-white text-xs font-semibold transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Wallet className="w-4 h-4" />
                <span>Convert to Wallet</span>
              </button>
            </div>
          </div>
        </div>
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

      {/* Program Benefits Breakdown */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2.5">
          <Gift className="w-6 h-6 text-[#B8921F]" />
          <h2 className="text-base font-bold text-[#0A192F]">01. ₦150 Instant Sign-Up Bonus</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Earn ₦150 immediately for every friend who registers using your unique referral code and completes OTP verification.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2.5">
          <Percent className="w-6 h-6 text-[#0A192F]" />
          <h2 className="text-base font-bold text-[#0A192F]">02. 2.5% Lifetime Partner Perk</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Unlock reseller-grade commission tiers as your network grows across MTN SME, Airtel Corporate, Glo, and 9mobile bundles.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2.5">
          <Wallet className="w-6 h-6 text-[#B8921F]" />
          <h2 className="text-base font-bold text-[#0A192F]">03. Zero-Fee Wallet Conversion</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            No minimum withdrawal lockups. Transfer your earned referral bonuses straight into your main wallet anytime with one click.
          </p>
        </div>
      </section>

      {/* Metrics Summary Strip + Optional Link Referrer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 grid grid-cols-3 gap-4 items-center">
          <div>
            <p className="text-xs text-slate-500">Successful Referrals</p>
            <p className="text-2xl sm:text-3xl font-bold text-[#0A192F] tabular-nums mt-1">
              {totalReferrals}
            </p>
          </div>
          <div className="border-l border-slate-100 pl-4">
            <p className="text-xs text-slate-500">Credited Bonuses</p>
            <p className="text-2xl sm:text-3xl font-bold text-emerald-700 tabular-nums mt-1">
              {formatNaira(creditedBonuses)}
            </p>
          </div>
          <div className="border-l border-slate-100 pl-4">
            <p className="text-xs text-slate-500">Pending Approval</p>
            <p className="text-2xl sm:text-3xl font-bold text-[#B8921F] tabular-nums mt-1">
              {formatNaira(pendingBonusTotal)}
            </p>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-center">
          {profile.referredBy ? (
            <div>
              <p className="text-xs text-slate-500">Linked Referrer Code</p>
              <p className="text-lg font-mono font-bold text-[#0A192F] mt-1">{profile.referredBy}</p>
              <p className="text-xs text-emerald-700 mt-1">Your account is linked to a sponsor.</p>
            </div>
          ) : (
            <form onSubmit={handleApplyFriendCode} className="space-y-2.5">
              <label htmlFor="apply-friend-code" className="block text-xs font-semibold text-[#0A192F]">
                Were you invited? Enter Sponsor Code
              </label>
              <div className="flex gap-2">
                <input
                  id="apply-friend-code"
                  type="text"
                  value={friendCode}
                  onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
                  placeholder="BOLDIN-XXXX"
                  maxLength={32}
                  className="flex-1 min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono uppercase focus:outline-none focus:border-[#0A192F]"
                />
                <button
                  type="submit"
                  disabled={busy || !friendCode.trim()}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0A192F] text-white text-xs font-semibold hover:bg-[#112240] disabled:opacity-50 inline-flex items-center gap-1"
                >
                  <span>Apply</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* History of Successful Referrals & Earned Bonuses */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[#0A192F]" />
            <div>
              <h2 className="text-lg font-bold text-[#0A192F]">Referral &amp; Bonus History</h2>
              <p className="text-xs text-slate-500">Track every friend invited and every Naira bonus earned.</p>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            {(
              [
                { id: 'ALL', label: 'All' },
                { id: 'credited', label: 'Credited' },
                { id: 'pending', label: 'Pending' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                  statusFilter === tab.id ? 'bg-white text-[#0A192F] shadow-sm' : 'text-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredReferrals.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-medium text-slate-700">
              No referrals recorded yet.
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Copy your referral code <strong className="font-mono text-[#0A192F]">{profile.referralCode}</strong> and share it on WhatsApp or with friends to start earning ₦150 per referral.
            </p>
            <button
              type="button"
              onClick={handleCopyCode}
              className="min-h-[42px] px-5 py-2 rounded-xl bg-[#D4AF37] text-[#0A192F] text-xs font-bold hover:bg-[#C59B27] transition-colors"
            >
              Copy My Referral Code
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500 bg-slate-50/70">
                  <th className="py-3 px-6 font-semibold">Referred User</th>
                  <th className="py-3 px-4 font-semibold">Code Used</th>
                  <th className="py-3 px-4 font-semibold">Date Joined</th>
                  <th className="py-3 px-4 font-semibold">Commission Tier</th>
                  <th className="py-3 px-4 font-semibold text-right">Bonus Earned</th>
                  <th className="py-3 px-6 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredReferrals.map((ref) => (
                  <tr key={ref.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-6 font-semibold text-[#0A192F]">
                      {ref.referredUserName}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">{ref.referralCode}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 tabular-nums">
                      {formatTimestamp(ref.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 tabular-nums">
                      {ref.commissionRate}% Partner Tier
                    </td>
                    <td className="py-3.5 px-4 font-bold text-emerald-700 text-right tabular-nums">
                      +{formatNaira(ref.bonusAmount)}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <span
                        className={`text-xs font-semibold capitalize ${
                          ref.status === 'credited' ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {ref.status}
                      </span>
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

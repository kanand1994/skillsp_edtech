import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, Share2, Gift, Trophy, Sparkles, Users, Coins, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

export default function Refer() {
  const [data, setData] = useState(null);
  const [board, setBoard] = useState([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [me, lb] = await Promise.all([
          api.get("/referrals/me"),
          api.get("/referrals/leaderboard"),
        ]);
        setData(me.data);
        setBoard(lb.data || []);
      } catch (err) {
        toast.error(getErrorMessage(err, "Failed to load referrals"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" data-testid="refer-loading">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }
  if (!data) return null;

  const link = `${window.location.origin}/register?ref=${data.code}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Referral link copied");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Copy failed — long-press to copy manually");
    }
  };

  const share = async () => {
    const shareData = {
      title: "Join me on SkillSphere",
      text: `I'm learning on SkillSphere — use my link to get ${data.referee_discount_pct}% off premium when you upgrade.`,
      url: link,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 sm:px-10 py-14" data-testid="refer-page">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">/ Refer a friend</div>
        <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tighter-x mt-3">
          Give <span className="text-indigo-400">{data.referee_discount_pct}% off</span>.<br />
          Earn <span className="text-amber-400">{data.xp_per_referral} XP</span> per friend.
        </h1>
        <p className="text-zinc-400 mt-4 max-w-2xl">
          Share your link. When a friend joins and makes their first payment, you climb the leaderboard and unlock XP toward your next level.
        </p>
      </motion.div>

      {/* Share card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="mt-10 bg-gradient-to-br from-indigo-500/10 via-zinc-900 to-fuchsia-500/10 border border-indigo-500/30 rounded-xl p-6 sm:p-8"
        data-testid="refer-share-card"
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <Gift className="h-5 w-5 text-indigo-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-zinc-400">Your referral link</div>
            <div className="mt-2 flex flex-col sm:flex-row gap-2">
              <div className="flex-1 px-4 py-2.5 rounded-md bg-zinc-950 border border-white/10 font-mono text-sm text-zinc-200 truncate" data-testid="refer-link">
                {link}
              </div>
              <Button
                onClick={copyLink}
                className="bg-indigo-500 hover:bg-indigo-400 h-11"
                data-testid="refer-copy-btn"
              >
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
              <Button
                onClick={share}
                variant="outline"
                className="border-white/10 hover:bg-white/5 h-11"
                data-testid="refer-share-btn"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-500">Your code:</span>
              <span className="font-mono text-sm font-semibold tracking-wider text-indigo-300" data-testid="refer-code">{data.code}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
        <Stat icon={Users} label="Friends invited" value={data.pending + data.completed} testid="stat-invited" />
        <Stat icon={Check} label="Completed" value={data.completed} accent="text-emerald-400" testid="stat-completed" />
        <Stat icon={Sparkles} label="Pending" value={data.pending} accent="text-amber-400" testid="stat-pending" />
        <Stat icon={Coins} label="XP earned" value={data.xp_earned} accent="text-indigo-300" testid="stat-xp" />
      </div>

      {/* My referrals + Leaderboard */}
      <div className="grid lg:grid-cols-2 gap-6 mt-10">
        <div className="bg-zinc-900 border border-white/5 rounded-xl p-6" data-testid="refer-my-list">
          <h2 className="font-heading text-xl font-semibold mb-4">My invites</h2>
          {data.referrals.length === 0 ? (
            <p className="text-sm text-zinc-500">No invites yet. Share your link to get started.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {data.referrals.map((r) => (
                <li key={r.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white">{r.referee_name}</div>
                    <div className="text-xs text-zinc-500">{new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === "completed" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
                    {r.status === "completed" ? `+${r.xp_awarded} XP` : "Pending"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-zinc-900 border border-white/5 rounded-xl p-6" data-testid="refer-leaderboard">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-5 w-5 text-amber-400" />
            <h2 className="font-heading text-xl font-semibold">Top referrers</h2>
          </div>
          {board.length === 0 ? (
            <p className="text-sm text-zinc-500">Be the first to climb the leaderboard.</p>
          ) : (
            <ul className="space-y-2">
              {board.map((row, i) => (
                <li key={row.user_id} className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-white/5">
                  <div className="flex items-center gap-3">
                    <span className={`h-6 w-6 rounded flex items-center justify-center text-xs font-semibold ${i === 0 ? "bg-amber-400/20 text-amber-300" : i === 1 ? "bg-zinc-400/20 text-zinc-200" : i === 2 ? "bg-orange-400/20 text-orange-300" : "bg-zinc-800 text-zinc-400"}`}>
                      {i + 1}
                    </span>
                    <span className="text-sm text-white truncate">{row.name}</span>
                  </div>
                  <div className="text-xs text-zinc-400">
                    {row.completed} <span className="text-zinc-600">invites</span> · <span className="text-indigo-300">{row.xp_earned} XP</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-12 text-center text-xs text-zinc-500">
        XP is credited when your friend completes their first paid checkout. Self-referrals are not eligible.
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent = "text-white", testid }) {
  return (
    <div className="bg-zinc-900 border border-white/5 rounded-xl p-5" data-testid={testid}>
      <Icon className={`h-5 w-5 ${accent}`} />
      <div className="text-2xl font-heading font-semibold tracking-tighter-x mt-2">{value}</div>
      <div className="text-xs text-zinc-500 mt-1">{label}</div>
    </div>
  );
}

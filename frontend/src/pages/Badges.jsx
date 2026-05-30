import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { Trophy, Flame, Sparkles, Lock } from "lucide-react";

const TIER_STYLES = {
  bronze:   { ring: "ring-amber-700/60",    bg: "from-amber-900/30 to-amber-950/40",  text: "text-amber-400" },
  silver:   { ring: "ring-zinc-400/60",     bg: "from-zinc-700/30 to-zinc-900/40",    text: "text-zinc-200" },
  gold:     { ring: "ring-yellow-400/60",   bg: "from-yellow-700/30 to-yellow-950/40", text: "text-yellow-300" },
  platinum: { ring: "ring-fuchsia-400/60",  bg: "from-fuchsia-700/30 to-indigo-900/40", text: "text-fuchsia-300" },
};

export default function Badges() {
  const [data, setData] = useState(null);
  const [board, setBoard] = useState([]);

  useEffect(() => {
    api.get("/gamification/me").then((r) => setData(r.data)).catch(() => {});
    api.get("/gamification/leaderboard").then((r) => setBoard(r.data || [])).catch(() => {});
  }, []);

  if (!data) return <div className="max-w-[1600px] mx-auto px-6 sm:px-10 py-20 text-zinc-500">Loading…</div>;

  const pct = data.level_total ? Math.round((data.level_progress / data.level_total) * 100) : 0;
  const owned = new Set(data.badges.map((b) => b.id));

  return (
    <div className="max-w-[1600px] mx-auto px-6 sm:px-10 py-10" data-testid="badges-page">
      <div className="mb-10">
        <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">/ Achievements</div>
        <h1 className="font-heading text-4xl font-semibold tracking-tighter-x mt-3">Your progress</h1>
        <p className="text-zinc-400 mt-2">Earn XP, level up, and unlock badges as you learn.</p>
      </div>

      {/* Hero stats */}
      <div className="grid md:grid-cols-3 gap-4 mb-10">
        <div className="bg-gradient-to-br from-indigo-500/15 to-zinc-900 border border-indigo-500/20 rounded-lg p-6" data-testid="stat-level">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-300">
            <Sparkles className="h-3.5 w-3.5" /> Level
          </div>
          <div className="font-heading text-5xl font-semibold mt-3">{data.level}</div>
          <div className="mt-4 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-xs text-zinc-500 mt-1.5">{data.level_progress} / {data.level_total} XP to next level</div>
        </div>
        <div className="bg-zinc-900 border border-white/5 rounded-lg p-6" data-testid="stat-xp">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400">
            <Trophy className="h-3.5 w-3.5" /> Total XP
          </div>
          <div className="font-heading text-5xl font-semibold mt-3 text-yellow-300">{data.xp.toLocaleString()}</div>
          <div className="text-xs text-zinc-500 mt-1.5">All-time earnings</div>
        </div>
        <div className="bg-zinc-900 border border-white/5 rounded-lg p-6" data-testid="stat-streak">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400">
            <Flame className="h-3.5 w-3.5" /> Streak
          </div>
          <div className="font-heading text-5xl font-semibold mt-3 text-orange-400">{data.streak} <span className="text-2xl text-zinc-500">days</span></div>
          <div className="text-xs text-zinc-500 mt-1.5">Keep it going — log in tomorrow</div>
        </div>
      </div>

      {/* Badge grid */}
      <div className="mb-10">
        <h2 className="font-heading text-2xl font-semibold mb-4">Badges ({data.badges.length} / {data.all_badges.length})</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {data.all_badges.map((b) => {
            const unlocked = owned.has(b.id);
            const t = TIER_STYLES[b.tier] || TIER_STYLES.bronze;
            return (
              <motion.div
                key={b.id}
                whileHover={unlocked ? { scale: 1.03 } : {}}
                data-testid={`badge-${b.id}`}
                className={`relative bg-gradient-to-br ${t.bg} border border-white/5 rounded-lg p-4 text-center transition ${unlocked ? "ring-1 " + t.ring : "opacity-40 grayscale"}`}
              >
                {!unlocked && <Lock className="absolute top-2 right-2 h-3 w-3 text-zinc-500" />}
                <div className="text-4xl mb-2" style={{ fontFamily: "Apple Color Emoji, Segoe UI Emoji" }}>{b.icon}</div>
                <div className={`text-sm font-medium ${t.text}`}>{b.name}</div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 mt-1">{b.tier}</div>
                <div className="text-xs text-zinc-400 mt-2 leading-snug">{b.desc}</div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Leaderboard */}
      <div>
        <h2 className="font-heading text-2xl font-semibold mb-4">Global leaderboard</h2>
        {board.length === 0 ? (
          <div className="bg-zinc-900 border border-white/5 rounded-lg p-8 text-center text-zinc-500 text-sm">No one has earned XP yet — be the first!</div>
        ) : (
          <div className="bg-zinc-900 border border-white/5 rounded-lg overflow-hidden" data-testid="leaderboard">
            {board.map((u, i) => (
              <div key={u.user_id} className={`flex items-center gap-4 px-5 py-3 ${i % 2 ? "bg-zinc-950/40" : ""} ${i === 0 ? "bg-yellow-500/5" : ""}`}>
                <div className={`font-heading text-lg w-8 ${i === 0 ? "text-yellow-300" : i === 1 ? "text-zinc-300" : i === 2 ? "text-amber-600" : "text-zinc-600"}`}>#{i + 1}</div>
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-sm font-semibold">
                  {u.name?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{u.name}</div>
                  <div className="text-xs text-zinc-500">Level {u.level} • {u.badges_count} badges</div>
                </div>
                <div className="font-heading text-lg text-yellow-300">{u.xp.toLocaleString()} <span className="text-xs text-zinc-500">XP</span></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

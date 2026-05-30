import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { Send, Loader2, RotateCcw, Bot, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import Markdown from "@/components/Markdown";

const ROLES = ["Software Engineer", "Frontend Engineer", "Backend Engineer", "Data Scientist", "ML Engineer", "Product Manager", "DevOps Engineer"];
const TYPES = [
  { id: "behavioral", label: "Behavioral" },
  { id: "technical", label: "Technical" },
  { id: "system_design", label: "System Design" },
];

export default function MockInterview() {
  const nav = useNavigate();
  const [setup, setSetup] = useState({ role: "Software Engineer", type: "behavioral", difficulty: "mid" });
  const [session, setSession] = useState(null);  // { session_id, question, turn, total, completed, report }
  const [history, setHistory] = useState([]);     // [{role:'ai'|'me', content}]
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const start = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/ai/mock-interview/start", setup);
      setSession({ session_id: data.session_id, turn: 1, total: 5, completed: false });
      setHistory([{ role: "ai", content: data.question }]);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to start interview"));
    } finally { setLoading(false); }
  };

  const answer = async () => {
    if (!input.trim() || !session) return;
    const my = input;
    setInput("");
    setHistory((h) => [...h, { role: "me", content: my }]);
    setLoading(true);
    try {
      const { data } = await api.post("/ai/mock-interview/answer", { session_id: session.session_id, answer: my });
      setHistory((h) => [...h, { role: "ai", content: data.reply }]);
      setSession((s) => ({ ...s, turn: data.turn, completed: data.completed, report: data.report }));
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to send answer"));
    } finally { setLoading(false); }
  };

  const reset = () => { setSession(null); setHistory([]); setInput(""); };

  return (
    <div className="max-w-[1100px] mx-auto px-6 sm:px-10 py-10" data-testid="mock-interview-page">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">/ AI Mock Interview</div>
        <h1 className="font-heading text-4xl font-semibold tracking-tighter-x mt-3">Practice live with an AI interviewer.</h1>
        <p className="text-zinc-400 mt-2">Five questions, real-time evaluation, a final hire/no-hire report.</p>
      </div>

      {!session && (
        <div className="bg-zinc-900 border border-white/5 rounded-lg p-8 space-y-6">
          <div>
            <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Target role</label>
            <select className="mt-2 w-full bg-zinc-950 border border-white/10 rounded-md px-3 py-2 text-sm" value={setup.role} onChange={(e) => setSetup({ ...setup, role: e.target.value })} data-testid="mock-role">
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Interview type</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {TYPES.map((t) => (
                <button key={t.id} onClick={() => setSetup({ ...setup, type: t.id })} data-testid={`mock-type-${t.id}`} className={`px-3 py-2 rounded-md text-sm border ${setup.type === t.id ? "bg-indigo-500/20 border-indigo-500/50 text-white" : "bg-zinc-950 border-white/10 text-zinc-400 hover:text-white"}`}>{t.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Difficulty</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {["junior", "mid", "senior"].map((d) => (
                <button key={d} onClick={() => setSetup({ ...setup, difficulty: d })} data-testid={`mock-diff-${d}`} className={`px-3 py-2 rounded-md text-sm border capitalize ${setup.difficulty === d ? "bg-indigo-500/20 border-indigo-500/50 text-white" : "bg-zinc-950 border-white/10 text-zinc-400 hover:text-white"}`}>{d}</button>
              ))}
            </div>
          </div>
          <Button onClick={start} disabled={loading} className="w-full bg-indigo-500 hover:bg-indigo-400 text-white" data-testid="mock-start">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bot className="h-4 w-4 mr-2" />}
            Start interview
          </Button>
        </div>
      )}

      {session && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-zinc-900 border border-white/5 rounded-lg px-5 py-3">
            <div className="text-sm">
              <span className="text-zinc-500">Question</span>{" "}
              <span className="font-mono">{Math.min(session.turn, session.total)} / {session.total}</span>
              {session.completed && <span className="ml-3 text-emerald-400 inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Complete</span>}
            </div>
            <button onClick={reset} className="text-xs text-zinc-400 hover:text-white inline-flex items-center gap-1" data-testid="mock-reset"><RotateCcw className="h-3 w-3" /> New session</button>
          </div>

          <div className="space-y-3">
            {history.map((m, i) => (
              <div key={i} className={`p-4 rounded-lg border ${m.role === "ai" ? "bg-zinc-900 border-white/5" : "bg-indigo-500/5 border-indigo-500/30 ml-12"}`} data-testid={`mock-turn-${i}`}>
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">{m.role === "ai" ? "Interviewer" : "You"}</div>
                <Markdown content={m.content} />
              </div>
            ))}
          </div>

          {!session.completed && (
            <div className="flex gap-2 sticky bottom-4">
              <textarea
                className="flex-1 bg-zinc-950 border border-white/10 rounded-md px-3 py-2 text-sm min-h-[80px]"
                placeholder="Type your answer…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                data-testid="mock-answer-input"
              />
              <Button onClick={answer} disabled={loading || !input.trim()} className="bg-indigo-500 hover:bg-indigo-400 self-end" data-testid="mock-answer-send">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          )}

          {session.completed && (
            <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-lg p-6 mt-4" data-testid="mock-report">
              <div className="text-xs uppercase tracking-wider text-emerald-400 font-semibold mb-3">Final report</div>
              <Markdown content={session.report || "Report ready in conversation above."} />
              <div className="mt-4 flex gap-2">
                <Button onClick={reset} variant="outline" className="border-white/10">New interview</Button>
                <Button onClick={() => nav("/badges")} className="bg-indigo-500 hover:bg-indigo-400">View badges</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

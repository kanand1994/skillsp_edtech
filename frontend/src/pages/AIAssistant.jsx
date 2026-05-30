import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Send, Loader2, Bot, User as UserIcon, FileText, Map, Briefcase, GraduationCap } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";

const MODES = [
  { id: "doubt", label: "Doubt Solver", icon: Sparkles, prompt: "Ask any technical or conceptual question..." },
  { id: "code", label: "Code Assistant", icon: GraduationCap, prompt: "Paste code or describe what to build..." },
  { id: "resume", label: "Resume Reviewer", icon: FileText, prompt: "Paste your resume text and target role..." },
  { id: "interview", label: "Interview Prep", icon: Briefcase, prompt: "Tell me the role you're preparing for..." },
  { id: "roadmap", label: "Roadmap", icon: Map, prompt: "What do you want to learn (with current level)..." },
  { id: "career", label: "Career", icon: GraduationCap, prompt: "Ask for career guidance..." },
];

export default function AIAssistant() {
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const [mode, setMode] = useState(sp.get("mode") || "doubt");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    api.get("/ai/sessions").then((r) => setSessions(r.data || [])).catch(() => {});
  }, [messages]);

  useEffect(() => {
    setMessages([]); setSessionId(null);
    setSp({ mode });
  }, [mode]);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input };
    setMessages((m) => [...m, userMsg]);
    const txt = input; setInput(""); setLoading(true);
    try {
      const { data } = await api.post("/ai/chat", { mode, message: txt, session_id: sessionId });
      setSessionId(data.session_id);
      setMessages((m) => [...m, { role: "assistant", content: data.reply, provider: data.provider, model: data.model }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: `Error: ${err?.response?.data?.detail || err.message}`, error: true }]);
    } finally { setLoading(false); }
  };

  const loadSession = async (sid, m) => {
    setMode(m);
    setSessionId(sid);
    const { data } = await api.get(`/ai/sessions/${sid}/messages`);
    setMessages(data.map((d) => ({ role: d.role, content: d.content, provider: d.provider, model: d.model })));
  };

  const currentMode = MODES.find((m) => m.id === mode);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px,1fr] h-[calc(100vh-4rem)] bg-zinc-950" data-testid="ai-assistant">
      <aside className="border-r border-white/5 hidden lg:flex flex-col">
        <div className="p-4 border-b border-white/5">
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">Modes</div>
        </div>
        <div className="p-2 space-y-0.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              data-testid={`mode-${m.id}`}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${mode === m.id ? "bg-indigo-500/15 text-white border border-indigo-500/30" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"}`}
            >
              <m.icon className="h-4 w-4" />
              {m.label}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-white/5 mt-4">
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold mb-3">Recent sessions</div>
          <div className="space-y-1 overflow-y-auto max-h-64">
            {sessions.length === 0 && <div className="text-xs text-zinc-600">No history</div>}
            {sessions.map((s) => (
              <button key={s.session_id} onClick={() => loadSession(s.session_id, s.mode)} className="w-full text-left p-2 rounded-md text-xs text-zinc-400 hover:bg-zinc-900 hover:text-white">
                <div className="truncate">{s.last_message}</div>
                <div className="text-[10px] text-zinc-600 mt-0.5">{s.mode}</div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="flex flex-col">
        <div className="border-b border-white/5 p-4 bg-zinc-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <currentMode.icon className="h-5 w-5 text-indigo-400" />
            <h1 className="font-heading text-lg font-medium">{currentMode.label}</h1>
          </div>
          <Badge className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-mono text-[10px]">GPT-5.2 → Claude → Gemini</Badge>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="max-w-2xl mx-auto pt-12 text-center">
              <div className="inline-flex h-16 w-16 rounded-2xl bg-indigo-500/15 items-center justify-center mb-6">
                <currentMode.icon className="h-7 w-7 text-indigo-400" />
              </div>
              <h2 className="font-heading text-2xl font-semibold tracking-tight">How can I help, {user?.name?.split(" ")[0]}?</h2>
              <p className="text-zinc-400 mt-2">{currentMode.prompt}</p>
              {mode === "roadmap" && <SpecialRoadmap onResult={(m) => setMessages([{ role: "assistant", content: m, provider: "ai" }])} />}
              {mode === "resume" && <SpecialResume onResult={(m) => setMessages([{ role: "assistant", content: m, provider: "ai" }])} />}
              {mode === "interview" && <SpecialInterview onResult={(m) => setMessages([{ role: "assistant", content: m, provider: "ai" }])} />}
            </div>
          )}
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "assistant" && (
                <div className="h-8 w-8 rounded-md bg-indigo-500/15 border border-indigo-500/30 flex-shrink-0 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-indigo-300" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-lg p-4 text-sm ${m.role === "user" ? "bg-indigo-500 text-white" : m.error ? "bg-red-500/10 border border-red-500/30 text-red-300" : "bg-zinc-900 border border-white/5"}`}>
                <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                {m.provider && <div className="text-[10px] text-zinc-500 mt-2 font-mono">{m.provider} • {m.model}</div>}
              </div>
              {m.role === "user" && (
                <div className="h-8 w-8 rounded-md bg-zinc-800 flex-shrink-0 flex items-center justify-center">
                  <UserIcon className="h-4 w-4 text-zinc-400" />
                </div>
              )}
            </motion.div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-md bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
                <Bot className="h-4 w-4 text-indigo-300" />
              </div>
              <div className="bg-zinc-900 border border-white/5 rounded-lg p-4 text-sm flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-white/5 p-4">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={currentMode.prompt}
              rows={1}
              className="flex-1 bg-zinc-900 border border-white/10 rounded-md p-3 text-sm resize-none focus:border-indigo-500 outline-none"
              data-testid="ai-input"
            />
            <Button onClick={send} disabled={loading || !input.trim()} className="bg-indigo-500 hover:bg-indigo-400" data-testid="ai-send">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecialRoadmap({ onResult }) {
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState("Beginner");
  const [weeks, setWeeks] = useState(12);
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/ai/roadmap", { goal, current_level: level, weeks: Number(weeks) });
      onResult(data.roadmap);
    } finally { setLoading(false); }
  };
  return (
    <div className="mt-8 bg-zinc-900 border border-white/5 rounded-lg p-6 max-w-xl mx-auto text-left">
      <input className="w-full p-3 bg-zinc-950 border border-white/10 rounded-md mb-3 text-sm" placeholder="e.g., Become a Senior React Engineer" value={goal} onChange={(e) => setGoal(e.target.value)} />
      <div className="grid grid-cols-2 gap-3 mb-3">
        <select className="p-3 bg-zinc-950 border border-white/10 rounded-md text-sm" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option>Beginner</option><option>Intermediate</option><option>Advanced</option>
        </select>
        <input type="number" className="p-3 bg-zinc-950 border border-white/10 rounded-md text-sm" value={weeks} onChange={(e) => setWeeks(e.target.value)} />
      </div>
      <Button onClick={submit} disabled={!goal || loading} className="w-full bg-indigo-500 hover:bg-indigo-400" data-testid="roadmap-gen">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate roadmap"}
      </Button>
    </div>
  );
}
function SpecialResume({ onResult }) {
  const [text, setText] = useState("");
  const [role, setRole] = useState("Software Engineer");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/ai/resume-review", { resume_text: text, target_role: role });
      onResult(data.review);
    } finally { setLoading(false); }
  };
  return (
    <div className="mt-8 bg-zinc-900 border border-white/5 rounded-lg p-6 max-w-xl mx-auto text-left">
      <input className="w-full p-3 bg-zinc-950 border border-white/10 rounded-md mb-3 text-sm" placeholder="Target role" value={role} onChange={(e) => setRole(e.target.value)} />
      <textarea className="w-full p-3 bg-zinc-950 border border-white/10 rounded-md mb-3 text-sm" rows={6} placeholder="Paste resume text here..." value={text} onChange={(e) => setText(e.target.value)} />
      <Button onClick={submit} disabled={!text || loading} className="w-full bg-indigo-500 hover:bg-indigo-400" data-testid="resume-gen">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Get review"}
      </Button>
    </div>
  );
}
function SpecialInterview({ onResult }) {
  const [role, setRole] = useState("Frontend Engineer");
  const [type, setType] = useState("behavioral");
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/ai/interview-prep", { role, type, count: Number(count) });
      onResult(data.questions);
    } finally { setLoading(false); }
  };
  return (
    <div className="mt-8 bg-zinc-900 border border-white/5 rounded-lg p-6 max-w-xl mx-auto text-left">
      <input className="w-full p-3 bg-zinc-950 border border-white/10 rounded-md mb-3 text-sm" placeholder="Role" value={role} onChange={(e) => setRole(e.target.value)} />
      <div className="grid grid-cols-2 gap-3 mb-3">
        <select className="p-3 bg-zinc-950 border border-white/10 rounded-md text-sm" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="behavioral">Behavioral</option><option value="technical">Technical</option><option value="system_design">System Design</option>
        </select>
        <input type="number" className="p-3 bg-zinc-950 border border-white/10 rounded-md text-sm" value={count} onChange={(e) => setCount(e.target.value)} />
      </div>
      <Button onClick={submit} disabled={loading} className="w-full bg-indigo-500 hover:bg-indigo-400" data-testid="interview-gen">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate questions"}
      </Button>
    </div>
  );
}

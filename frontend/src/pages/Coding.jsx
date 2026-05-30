import React, { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Code2, Play, CheckCircle2, XCircle, Loader2, Trophy, Terminal } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

export function CodingChallenges() {
  const [items, setItems] = useState([]);
  const [difficulty, setDifficulty] = useState("all");
  useEffect(() => {
    const params = difficulty !== "all" ? { difficulty } : {};
    api.get("/coding/challenges", { params }).then((r) => setItems(r.data || []));
  }, [difficulty]);

  const colors = { Easy: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5", Medium: "text-amber-400 border-amber-500/30 bg-amber-500/5", Hard: "text-red-400 border-red-500/30 bg-red-500/5" };

  return (
    <div className="max-w-[1400px] mx-auto px-6 sm:px-10 py-12" data-testid="coding-page">
      <div className="flex items-end justify-between mb-10">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">/ Coding</div>
          <h1 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tighter-x mt-3">Coding challenges</h1>
          <p className="text-zinc-400 mt-2">{items.length} sandboxed challenges • Python + JavaScript</p>
        </div>
        <Select value={difficulty} onValueChange={setDifficulty}>
          <SelectTrigger className="w-40 bg-zinc-900 border-white/10" data-testid="filter-difficulty"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-zinc-950 border-white/10">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="Easy">Easy</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Hard">Hard</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3">
        {items.map((c) => (
          <Link key={c.id} to={`/coding/${c.id}`} data-testid={`challenge-${c.id}`} className="bg-zinc-900 border border-white/5 rounded-lg p-6 hover:border-indigo-500/40 transition-all">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Code2 className="h-4 w-4 text-indigo-400" />
                  <Badge className={`border ${colors[c.difficulty] || ""}`}>{c.difficulty}</Badge>
                  <span className="text-xs text-zinc-500 uppercase tracking-wider">{c.language}</span>
                </div>
                <div className="font-heading text-lg font-medium">{c.title}</div>
                <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{c.description}</p>
                {c.tags?.length > 0 && (
                  <div className="flex gap-1 mt-2">{c.tags.map((t) => <Badge key={t} className="bg-zinc-800 text-zinc-300 text-xs">{t}</Badge>)}</div>
                )}
              </div>
              <div className="text-right text-xs text-zinc-500">{c.time_limit_min} min</div>
            </div>
          </Link>
        ))}
        {items.length === 0 && <p className="text-zinc-500 text-center py-16">No challenges found.</p>}
      </div>
    </div>
  );
}

export function CodingChallenge() {
  const { id } = useParams();
  const nav = useNavigate();
  const [ch, setCh] = useState(null);
  const [code, setCode] = useState("");
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState(null);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [board, setBoard] = useState([]);

  useEffect(() => {
    api.get(`/coding/challenges/${id}`).then((r) => { setCh(r.data); setCode(r.data.starter_code || ""); });
    api.get(`/coding/challenges/${id}/leaderboard`).then((r) => setBoard(r.data || []));
  }, [id]);

  const run = async () => {
    setRunning(true); setOutput(null);
    try {
      const { data } = await api.post("/coding/run", { language: ch.language, code, stdin });
      setOutput(data);
    } catch (err) {
      toast.error(getErrorMessage(err, "Run failed"));
    } finally { setRunning(false); }
  };

  const submit = async () => {
    setSubmitting(true); setResult(null);
    try {
      const { data } = await api.post(`/coding/challenges/${id}/submit`, { code });
      setResult(data);
      const lb = await api.get(`/coding/challenges/${id}/leaderboard`);
      setBoard(lb.data || []);
      if (data.score === 100) toast.success("All tests passed! 🎉");
      else toast.message(`${data.passed}/${data.total} tests passed (${data.score}%)`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Submit failed"));
    } finally { setSubmitting(false); }
  };

  if (!ch) return <div className="p-12 text-zinc-500">Loading…</div>;

  return (
    <div className="max-w-[1700px] mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-4rem)]" data-testid="coding-challenge">
      <div className="bg-zinc-900 border border-white/5 rounded-lg p-6 overflow-y-auto">
        <div className="flex items-center gap-2 mb-3">
          <Badge className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">{ch.difficulty}</Badge>
          <Badge className="bg-zinc-800 text-zinc-300">{ch.language}</Badge>
          <span className="text-xs text-zinc-500">{ch.time_limit_min} min</span>
        </div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight mb-2" data-testid="challenge-title">{ch.title}</h1>
        <p className="text-zinc-300 leading-relaxed whitespace-pre-line mb-4">{ch.description}</p>
        {ch.test_cases?.length > 0 && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Sample test cases</div>
            <div className="space-y-2">
              {ch.test_cases.map((tc, i) => (
                <div key={i} className="bg-zinc-950 border border-white/5 rounded-md p-3 text-xs font-mono">
                  <div className="text-zinc-500">{tc.description || `Test ${i + 1}`}</div>
                  {tc.stdin && <div className="mt-1"><span className="text-zinc-500">stdin:</span> <pre className="inline whitespace-pre-wrap text-zinc-300">{tc.stdin}</pre></div>}
                </div>
              ))}
            </div>
          </div>
        )}
        {board.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-1"><Trophy className="h-3 w-3" /> Leaderboard</h3>
            <div className="space-y-1">
              {board.slice(0, 5).map((b, i) => (
                <div key={b.id} className="flex justify-between text-sm bg-zinc-950 border border-white/5 rounded p-2">
                  <span className="text-zinc-400"><span className="font-mono text-zinc-600 mr-2">#{i+1}</span>{b.user_name}</span>
                  <span className="text-indigo-400">{b.score}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 h-full">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          data-testid="code-editor"
          className="flex-1 bg-zinc-950 border border-white/10 rounded-lg p-4 font-mono text-sm text-zinc-100 focus:border-indigo-500 outline-none resize-none min-h-[300px]"
          placeholder="// your code"
        />
        <div className="flex gap-2 flex-wrap">
          <Button onClick={run} disabled={running} variant="outline" className="border-white/10" data-testid="code-run">
            {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />} Run
          </Button>
          <Button onClick={submit} disabled={submitting} className="bg-indigo-500 hover:bg-indigo-400" data-testid="code-submit">
            {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />} Submit
          </Button>
          <input className="flex-1 min-w-[200px] bg-zinc-900 border border-white/10 rounded-md px-3 text-sm font-mono" placeholder="optional stdin (for Run)" value={stdin} onChange={(e) => setStdin(e.target.value)} data-testid="code-stdin" />
        </div>
        {output && (
          <div className="bg-black border border-white/5 rounded-lg p-4 font-mono text-xs space-y-2 max-h-48 overflow-y-auto" data-testid="run-output">
            <div className="flex items-center gap-1 text-zinc-500"><Terminal className="h-3 w-3" /> output (exit={output.exit_code})</div>
            {output.stdout && <pre className="text-emerald-300 whitespace-pre-wrap">{output.stdout}</pre>}
            {output.stderr && <pre className="text-red-300 whitespace-pre-wrap">{output.stderr}</pre>}
          </div>
        )}
        {result && (
          <div className="bg-zinc-900 border border-white/5 rounded-lg p-4 max-h-72 overflow-y-auto" data-testid="submit-result">
            <div className="flex items-center justify-between mb-2">
              <div className="font-heading text-lg">{result.passed}/{result.total} passed</div>
              <Badge className={result.score === 100 ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" : "bg-amber-500/10 text-amber-300 border border-amber-500/30"}>{result.score}%</Badge>
            </div>
            <div className="space-y-2">
              {result.results.map((r, i) => (
                <div key={i} className={`p-2 rounded border ${r.passed ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                  <div className="flex items-center gap-2 text-sm">
                    {r.passed ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-red-400" />}
                    <span>{r.description || `Test ${i+1}`}</span>
                  </div>
                  {!r.passed && (
                    <div className="mt-1 font-mono text-[10px] text-zinc-500">
                      <div>expected: {r.expected.slice(0, 80)}</div>
                      <div>got: {r.actual.slice(0, 80)}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

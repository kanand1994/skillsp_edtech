import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Wand2, Loader2, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/context/AuthContext";

export default function AIQuizGenerator() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({
    source: "course",   // course | text
    course_id: "",
    source_text: "",
    title: "",
    num_questions: 5,
    difficulty: "Medium",
    save: true,
  });
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (user?.role === "trainer" || user?.role === "admin") {
      api.get(`/courses?trainer_id=${user.id}`).then((r) => setCourses(r.data || []));
    }
  }, [user]);

  const generate = async () => {
    setLoading(true); setPreview(null);
    try {
      const payload = {
        num_questions: Number(form.num_questions),
        difficulty: form.difficulty,
        title: form.title || undefined,
        save: form.save,
      };
      if (form.source === "course") {
        if (!form.course_id) { toast.error("Pick a course"); setLoading(false); return; }
        payload.course_id = form.course_id;
      } else {
        if (!form.source_text.trim()) { toast.error("Paste some content"); setLoading(false); return; }
        payload.source_text = form.source_text;
      }
      const { data } = await api.post("/ai-quiz/generate", payload);
      setPreview(data);
      toast.success(`Generated ${data.questions.length} questions via ${data.provider}`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Generation failed"));
    } finally { setLoading(false); }
  };

  if (user?.role !== "trainer" && user?.role !== "admin") {
    return <div className="max-w-2xl mx-auto p-12 text-center text-zinc-400">Only trainers and admins can generate quizzes.</div>;
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 sm:px-10 py-12" data-testid="ai-quiz-page">
      <div className="mb-10">
        <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">/ AI Tools</div>
        <h1 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tighter-x mt-3 flex items-center gap-3">
          <Wand2 className="h-8 w-8 text-indigo-400" />
          AI quiz generator
        </h1>
        <p className="text-zinc-400 mt-2">Auto-generate MCQ quizzes from your course content using the GPT-5.2 → Claude → Gemini fallback chain.</p>
      </div>

      <div className="grid lg:grid-cols-[1fr,1.2fr] gap-6">
        <div className="bg-zinc-900 border border-white/5 rounded-lg p-8 space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Source</div>
            <div className="flex gap-2">
              <button onClick={() => setForm({ ...form, source: "course" })} className={`flex-1 p-3 rounded-md text-sm border ${form.source === "course" ? "border-indigo-500/40 bg-indigo-500/10" : "border-white/10 bg-zinc-950"}`} data-testid="src-course">From a course</button>
              <button onClick={() => setForm({ ...form, source: "text" })} className={`flex-1 p-3 rounded-md text-sm border ${form.source === "text" ? "border-indigo-500/40 bg-indigo-500/10" : "border-white/10 bg-zinc-950"}`} data-testid="src-text">From custom text</button>
            </div>
          </div>

          {form.source === "course" ? (
            <div>
              <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Course</div>
              <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })}>
                <SelectTrigger className="bg-zinc-950 border-white/10" data-testid="select-course"><SelectValue placeholder="Choose a course you teach" /></SelectTrigger>
                <SelectContent className="bg-zinc-950 border-white/10">
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
              {courses.length === 0 && <p className="text-xs text-zinc-500 mt-2">You don't have any courses yet — switch to custom text below.</p>}
            </div>
          ) : (
            <div>
              <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Source text</div>
              <textarea value={form.source_text} onChange={(e) => setForm({ ...form, source_text: e.target.value })} rows={8} placeholder="Paste a textbook chapter, blog post, or lesson notes here..." className="w-full p-3 bg-zinc-950 border border-white/10 rounded-md text-sm" data-testid="src-text-input" />
              <p className="text-xs text-zinc-500 mt-1">Up to 12,000 characters. Longer content will be truncated.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Difficulty</div>
              <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
                <SelectTrigger className="bg-zinc-950 border-white/10" data-testid="select-difficulty"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-950 border-white/10">
                  <SelectItem value="Easy">Easy</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Questions</div>
              <Input type="number" min={1} max={20} value={form.num_questions} onChange={(e) => setForm({ ...form, num_questions: e.target.value })} className="bg-zinc-950 border-white/10" data-testid="num-questions" />
            </div>
          </div>

          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Optional quiz title" className="bg-zinc-950 border-white/10" />

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.save} onChange={(e) => setForm({ ...form, save: e.target.checked })} className="rounded" data-testid="save-quiz" />
            <span className="text-zinc-300">Save as a real quiz (students can take it)</span>
          </label>

          <Button onClick={generate} disabled={loading} className="w-full bg-indigo-500 hover:bg-indigo-400 h-11" data-testid="ai-quiz-generate">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating with LLM…</> : <><Sparkles className="h-4 w-4 mr-2" /> Generate quiz</>}
          </Button>
        </div>

        <div className="bg-zinc-900 border border-white/5 rounded-lg p-8 min-h-[400px]">
          {!preview ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500">
              <Wand2 className="h-10 w-10 mb-4 text-zinc-700" />
              <p>Generated questions will appear here.</p>
              <p className="text-xs mt-2">Powered by GPT-5.2 → Claude Sonnet 4.5 → Gemini 3 fallback.</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
                <div>
                  <h2 className="font-heading text-xl font-medium">{preview.title}</h2>
                  <div className="text-xs text-zinc-500 mt-1 font-mono">via {preview.provider} · {preview.model}</div>
                </div>
                {preview.saved && (
                  <Button onClick={() => nav(`/quiz/${preview.quiz_id}`)} variant="outline" className="border-white/10" data-testid="open-quiz">
                    Open quiz <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {preview.questions.map((q, i) => (
                  <div key={q.id} className="bg-zinc-950 border border-white/5 rounded-md p-4">
                    <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Q{i + 1}</div>
                    <div className="font-medium mb-3">{q.question}</div>
                    <div className="space-y-1.5">
                      {q.options.map((opt, oi) => (
                        <div key={oi} className={`text-sm p-2 rounded ${oi === q.correct_index ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30" : "text-zinc-400"}`}>
                          <span className="font-mono text-zinc-500 mr-2">{String.fromCharCode(65 + oi)}.</span> {opt}
                          {oi === q.correct_index && <Badge className="ml-2 bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[9px]">correct</Badge>}
                        </div>
                      ))}
                    </div>
                    {q.explanation && <p className="text-xs text-zinc-500 mt-2 italic">{q.explanation}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

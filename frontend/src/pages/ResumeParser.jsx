import React, { useState } from "react";
import { api } from "@/lib/api";
import { Upload, Loader2, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

export default function ResumeParser() {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState(null);
  const [loading, setLoading] = useState(false);

  const parse = async () => {
    if (!text.trim()) { toast.error("Paste your resume first"); return; }
    setLoading(true);
    try {
      const { data } = await api.post("/ai/resume-parse", { resume_text: text });
      setParsed(data.parsed);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to parse"));
    } finally { setLoading(false); }
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const t = await file.text();
    setText(t);
  };

  return (
    <div className="max-w-[1300px] mx-auto px-6 sm:px-10 py-10" data-testid="resume-parser-page">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">/ Resume Parser</div>
        <h1 className="font-heading text-4xl font-semibold tracking-tighter-x mt-3">AI-powered resume breakdown.</h1>
        <p className="text-zinc-400 mt-2">Paste your resume — get a structured ATS score, skills inventory, and actionable feedback.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Input */}
        <div className="bg-zinc-900 border border-white/5 rounded-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">Your resume (plain text)</div>
            <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300" data-testid="resume-upload-label">
              <Upload className="h-3 w-3" /> Upload .txt
              <input type="file" accept=".txt,.md" className="hidden" onChange={onFile} />
            </label>
          </div>
          <textarea
            className="w-full bg-zinc-950 border border-white/10 rounded-md p-3 text-sm min-h-[400px] font-mono"
            placeholder="Paste your resume text here…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            data-testid="resume-text"
          />
          <Button onClick={parse} disabled={loading || !text} className="w-full mt-3 bg-indigo-500 hover:bg-indigo-400" data-testid="resume-parse-btn">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            Parse resume
          </Button>
        </div>

        {/* Output */}
        <div className="bg-zinc-900 border border-white/5 rounded-lg p-6" data-testid="resume-output">
          {!parsed && (
            <div className="text-zinc-500 text-sm text-center py-32">Paste your resume and click <span className="text-indigo-400">Parse resume</span> to see the breakdown.</div>
          )}
          {parsed && parsed.error && (
            <div className="text-red-400 text-sm">Failed to parse the LLM response. Raw: {parsed.raw}</div>
          )}
          {parsed && !parsed.error && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-indigo-500/20 to-emerald-500/20 border-2 border-indigo-500/40 flex items-center justify-center" data-testid="resume-ats-score">
                  <div className="text-center">
                    <div className="font-heading text-2xl font-semibold text-emerald-400">{parsed.ats_score ?? "—"}</div>
                    <div className="text-[9px] uppercase tracking-wider text-zinc-500">ATS</div>
                  </div>
                </div>
                <div>
                  <div className="font-heading text-xl font-semibold">{parsed.name || "Candidate"}</div>
                  <div className="text-xs text-zinc-500">{parsed.email} {parsed.phone && `• ${parsed.phone}`}</div>
                  {parsed.summary && <div className="text-sm text-zinc-300 mt-1.5 line-clamp-2">{parsed.summary}</div>}
                </div>
              </div>

              {parsed.skills?.length > 0 && (
                <Section title="Skills">
                  <div className="flex flex-wrap gap-1.5">
                    {parsed.skills.map((s) => (
                      <span key={s} className="px-2 py-0.5 bg-indigo-500/15 border border-indigo-500/30 rounded-md text-xs text-indigo-300">{s}</span>
                    ))}
                  </div>
                </Section>
              )}

              {parsed.experience?.length > 0 && (
                <Section title="Experience">
                  <div className="space-y-2.5">
                    {parsed.experience.map((e, i) => (
                      <div key={i} className="border-l-2 border-indigo-500/30 pl-3">
                        <div className="text-sm font-medium">{e.title} <span className="text-zinc-500 font-normal">@ {e.company}</span></div>
                        <div className="text-xs text-zinc-500">{e.duration}</div>
                        {e.highlights?.length > 0 && (
                          <ul className="text-xs text-zinc-400 mt-1 list-disc list-inside">
                            {e.highlights.map((h, j) => <li key={j}>{h}</li>)}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {parsed.education?.length > 0 && (
                <Section title="Education">
                  {parsed.education.map((ed, i) => (
                    <div key={i} className="text-sm">{ed.degree} <span className="text-zinc-500">— {ed.institution}, {ed.year}</span></div>
                  ))}
                </Section>
              )}

              {parsed.strengths?.length > 0 && (
                <Section title="Strengths">
                  <ul className="space-y-1">{parsed.strengths.map((s, i) => <li key={i} className="text-sm text-emerald-300 flex gap-2"><CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /> {s}</li>)}</ul>
                </Section>
              )}

              {parsed.improvements?.length > 0 && (
                <Section title="Improvements">
                  <ul className="space-y-1">{parsed.improvements.map((s, i) => <li key={i} className="text-sm text-amber-300">→ {s}</li>)}</ul>
                </Section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-2">{title}</div>
      {children}
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, MapPin, Briefcase, DollarSign, Clock, Building2, Sparkles, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import FileUpload from "@/components/FileUpload";

export function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const load = () => {
    const params = {};
    if (q) params.q = q;
    if (type !== "all") params.job_type = type;
    api.get("/jobs", { params }).then((r) => setJobs(r.data || []));
  };
  useEffect(() => { load(); }, [q, type]);

  return (
    <div className="max-w-[1600px] mx-auto px-6 sm:px-10 py-12" data-testid="jobs-page">
      <div className="mb-10">
        <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">/ Career portal</div>
        <h1 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tighter-x mt-3">
          Jobs &amp; internships
        </h1>
        <p className="text-zinc-400 mt-2">{jobs.length} open roles</p>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-10">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input data-testid="jobs-search" placeholder="Search jobs, companies, skills..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 bg-zinc-900 border-white/10" />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="md:w-48 bg-zinc-900 border-white/10" data-testid="filter-job-type"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-zinc-950 border-white/10">
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="Full-time">Full-time</SelectItem>
            <SelectItem value="Part-time">Part-time</SelectItem>
            <SelectItem value="Internship">Internship</SelectItem>
            <SelectItem value="Contract">Contract</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3">
        {jobs.map((j) => (
          <motion.div
            key={j.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            data-testid={`job-card-${j.id}`}
          >
            <Link to={`/jobs/${j.id}`} className="block bg-zinc-900 border border-white/5 rounded-lg p-6 hover:border-indigo-500/40 hover:bg-zinc-900/70 transition-all group">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-zinc-500" />
                    <span className="text-sm text-zinc-400">{j.company}</span>
                    <Badge variant="outline" className="border-white/10 text-zinc-400">{j.job_type}</Badge>
                  </div>
                  <h3 className="font-heading text-xl font-medium group-hover:text-indigo-300 transition-colors">{j.title}</h3>
                  <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {j.location}</span>
                    {j.salary_min > 0 && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> {j.salary_min/1000}k - {j.salary_max/1000}k</span>}
                    <span>{j.applicants_count} applicants</span>
                  </div>
                  {j.skills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {j.skills.slice(0, 6).map((s) => <Badge key={s} className="bg-zinc-800 text-zinc-300 text-xs">{s}</Badge>)}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
        {jobs.length === 0 && <p className="text-center py-16 text-zinc-500">No jobs match your search.</p>}
      </div>
    </div>
  );
}

export function JobDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [applied, setApplied] = useState(false);
  const [resumeUrl, setResumeUrl] = useState("");
  const [cover, setCover] = useState("");
  const [showApply, setShowApply] = useState(false);
  const [applications, setApplications] = useState([]);
  const [match, setMatch] = useState(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [showMatch, setShowMatch] = useState(false);
  const [showCover, setShowCover] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [coverLoading, setCoverLoading] = useState(false);
  const [coverTone, setCoverTone] = useState("professional");

  useEffect(() => {
    api.get(`/jobs/${id}`).then((r) => setJob(r.data));
    if (user?.role === "student") {
      api.get("/jobs/me/applications").then((r) => {
        const a = (r.data || []).find((x) => x.job_id === id);
        if (a) setApplied(true);
      });
    }
    if (user?.role === "recruiter") {
      api.get(`/jobs/${id}/applications`).then((r) => setApplications(r.data || [])).catch(() => {});
    }
  }, [id, user]);

  const runMatch = async () => {
    if (!resumeText.trim()) { toast.error("Paste your resume first"); return; }
    setMatchLoading(true);
    try {
      const { data } = await api.post("/ai/job-match", { job_id: id, resume_text: resumeText });
      setMatch(data.match);
    } catch (err) {
      toast.error(getErrorMessage(err, "Match failed"));
    } finally { setMatchLoading(false); }
  };

  const runCoverLetter = async () => {
    setCoverLoading(true);
    try {
      const { data } = await api.post("/ai/cover-letter", { job_id: id, resume_text: resumeText, tone: coverTone });
      setCoverLetter(data.letter);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to generate"));
    } finally { setCoverLoading(false); }
  };

  const copyLetter = () => {
    navigator.clipboard.writeText(coverLetter);
    toast.success("Cover letter copied to clipboard");
  };

  const apply = async () => {
    try {
      await api.post(`/jobs/${id}/apply`, { resume_url: resumeUrl, cover_letter: cover });
      toast.success("Application submitted!");
      setApplied(true); setShowApply(false);
    } catch (err) { toast.error(getErrorMessage(err, "Failed")); }
  };

  if (!job) return <div className="p-12 text-zinc-500">Loading…</div>;
  return (
    <div className="max-w-[1200px] mx-auto px-6 sm:px-10 py-12" data-testid="job-detail">
      <div className="bg-zinc-900 border border-white/5 rounded-lg p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-zinc-500" />
              <span className="text-zinc-400">{job.company}</span>
            </div>
            <h1 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tighter-x">{job.title}</h1>
            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-zinc-400">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {job.location}</span>
              <Badge variant="outline" className="border-white/10">{job.job_type}</Badge>
              {job.salary_min > 0 && <span>{job.salary_min/1000}k - {job.salary_max/1000}k</span>}
              <span>{job.applicants_count} applicants</span>
            </div>
          </div>
          {user?.role === "student" && (
            <div className="flex flex-col gap-2 items-end">
              {applied ? (
                <Button disabled className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Applied ✓</Button>
              ) : (
                <Button onClick={() => user ? setShowApply(true) : nav("/login")} className="bg-indigo-500 hover:bg-indigo-400" data-testid="apply-btn">Apply now</Button>
              )}
              <Button onClick={() => setShowMatch(true)} variant="outline" size="sm" className="border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10" data-testid="match-toggle">
                <Sparkles className="h-3 w-3 mr-1.5" /> AI Job-Match Score
              </Button>
              <Button onClick={() => setShowCover(true)} variant="outline" size="sm" className="border-fuchsia-500/30 text-fuchsia-300 hover:bg-fuchsia-500/10" data-testid="cover-toggle">
                <Sparkles className="h-3 w-3 mr-1.5" /> AI Cover Letter
              </Button>
            </div>
          )}
        </div>
        <div className="mt-8 grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <div>
              <h2 className="font-heading text-lg font-medium mb-3">About the role</h2>
              <p className="text-zinc-300 leading-relaxed whitespace-pre-line">{job.description}</p>
            </div>
            {job.requirements.length > 0 && (
              <div>
                <h2 className="font-heading text-lg font-medium mb-3">Requirements</h2>
                <ul className="space-y-2 text-zinc-300">{job.requirements.map((r) => <li key={r} className="flex gap-2"><span className="text-indigo-400">•</span> {r}</li>)}</ul>
              </div>
            )}
          </div>
          <div className="space-y-4">
            {job.skills.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-zinc-500 mb-3">Skills</div>
                <div className="flex flex-wrap gap-1.5">{job.skills.map((s) => <Badge key={s} className="bg-zinc-800 text-zinc-300">{s}</Badge>)}</div>
              </div>
            )}
            <div className="bg-zinc-950 border border-white/5 rounded-md p-4">
              <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Posted by</div>
              <div className="text-sm">{job.recruiter_name}</div>
              {user?.id !== job.recruiter_id && user && (
                <Link to={`/chat/${job.recruiter_id}`}><Button variant="outline" size="sm" className="mt-3 border-white/10">Message recruiter</Button></Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Job-Match panel */}
      {showMatch && user?.role === "student" && (
        <div className="mt-6 bg-zinc-900 border border-indigo-500/30 rounded-lg p-6" data-testid="match-panel">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-xl font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-400" /> AI Job-Match Score
            </h2>
            <button onClick={() => { setShowMatch(false); setMatch(null); }} className="text-zinc-500 hover:text-white text-sm" data-testid="match-close">Close</button>
          </div>
          {!match && (
            <>
              <p className="text-sm text-zinc-400 mb-3">Paste your resume — get an instant fit score against this job and a list of skill gaps.</p>
              <textarea
                className="w-full bg-zinc-950 border border-white/10 rounded-md p-3 text-sm font-mono min-h-[180px]"
                placeholder="Paste your resume text here…"
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                data-testid="match-resume-input"
              />
              <Button onClick={runMatch} disabled={matchLoading || !resumeText} className="mt-3 bg-indigo-500 hover:bg-indigo-400" data-testid="match-run-btn">
                {matchLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Calculate match score
              </Button>
            </>
          )}
          {match && match.error && (
            <div className="text-red-400 text-sm">Couldn't parse the AI response. Try a cleaner resume text.</div>
          )}
          {match && !match.error && (
            <div className="grid md:grid-cols-3 gap-6" data-testid="match-result">
              <div className="md:col-span-1 flex flex-col items-center justify-center text-center">
                <div className={`relative h-32 w-32 rounded-full flex items-center justify-center font-heading text-5xl font-semibold ${match.match_score >= 75 ? "bg-emerald-500/15 border-2 border-emerald-500/50 text-emerald-300" : match.match_score >= 50 ? "bg-amber-500/15 border-2 border-amber-500/50 text-amber-300" : "bg-red-500/15 border-2 border-red-500/50 text-red-300"}`} data-testid="match-score-circle">
                  {match.match_score}<span className="text-xl ml-0.5">%</span>
                </div>
                <div className="mt-3 text-xs uppercase tracking-wider text-zinc-500">{(match.verdict || "").replace(/_/g, " ")}</div>
                <p className="text-sm text-zinc-300 mt-3 italic">"{match.summary}"</p>
              </div>
              <div className="md:col-span-2 space-y-4 text-sm">
                {match.matching_skills?.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-emerald-400 font-semibold mb-2">✓ Matching skills ({match.matching_skills.length})</div>
                    <div className="flex flex-wrap gap-1.5">
                      {match.matching_skills.map((s) => <Badge key={`m-${s}`} className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">{s}</Badge>)}
                    </div>
                  </div>
                )}
                {match.missing_skills?.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-red-400 font-semibold mb-2">✗ Missing skills ({match.missing_skills.length})</div>
                    <div className="flex flex-wrap gap-1.5">
                      {match.missing_skills.map((s) => <Badge key={`x-${s}`} className="bg-red-500/10 border border-red-500/30 text-red-300">{s}</Badge>)}
                    </div>
                  </div>
                )}
                {match.gaps?.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-amber-400 font-semibold mb-2">⚠ Gaps</div>
                    <ul className="space-y-1 text-zinc-300">{match.gaps.map((g) => <li key={`g-${g.slice(0, 40)}`}>→ {g}</li>)}</ul>
                  </div>
                )}
                {match.improvements?.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-indigo-400 font-semibold mb-2">💡 How to improve your match</div>
                    <ul className="space-y-1 text-zinc-300">{match.improvements.map((g) => <li key={`i-${g.slice(0, 40)}`}>• {g}</li>)}</ul>
                  </div>
                )}
                <button onClick={() => { setMatch(null); setResumeText(""); }} className="text-xs text-zinc-500 hover:text-white underline" data-testid="match-reset">Try with different resume</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Cover Letter panel */}
      {showCover && user?.role === "student" && (
        <div className="mt-6 bg-zinc-900 border border-fuchsia-500/30 rounded-lg p-6" data-testid="cover-panel">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-xl font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-fuchsia-400" /> AI Cover Letter Generator
            </h2>
            <button onClick={() => { setShowCover(false); setCoverLetter(""); }} className="text-zinc-500 hover:text-white text-sm" data-testid="cover-close">Close</button>
          </div>
          {!coverLetter && (
            <>
              <p className="text-sm text-zinc-400 mb-3">Paste your resume below (optional) — we'll tailor a cover letter for this exact role and company.</p>
              <textarea
                className="w-full bg-zinc-950 border border-white/10 rounded-md p-3 text-sm font-mono min-h-[140px] mb-3"
                placeholder="Paste your resume (optional — improves quality)"
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                data-testid="cover-resume-input"
              />
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="text-xs uppercase tracking-wider text-zinc-500 font-semibold self-center mr-2">Tone:</span>
                {["professional", "enthusiastic", "concise"].map((t) => (
                  <button key={t} onClick={() => setCoverTone(t)} data-testid={`cover-tone-${t}`}
                    className={`px-3 py-1 rounded-full text-xs capitalize border ${coverTone === t ? "bg-fuchsia-500/20 border-fuchsia-500/50 text-white" : "bg-zinc-950 border-white/10 text-zinc-400 hover:text-white"}`}>{t}</button>
                ))}
              </div>
              <Button onClick={runCoverLetter} disabled={coverLoading} className="bg-fuchsia-500 hover:bg-fuchsia-400" data-testid="cover-generate-btn">
                {coverLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Generate cover letter
              </Button>
            </>
          )}
          {coverLetter && (
            <div data-testid="cover-result">
              <div className="bg-zinc-950 border border-white/10 rounded-md p-5 max-h-[500px] overflow-y-auto">
                <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-zinc-100 leading-relaxed">{coverLetter}</div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button onClick={copyLetter} variant="outline" size="sm" className="border-white/10" data-testid="cover-copy">Copy to clipboard</Button>
                <Button onClick={() => setCoverLetter("")} variant="outline" size="sm" className="border-white/10" data-testid="cover-regenerate">Try different tone</Button>
              </div>
            </div>
          )}
        </div>
      )}
      {user?.role === "recruiter" && job.recruiter_id === user.id && (
        <div className="mt-8 bg-zinc-900 border border-white/5 rounded-lg p-8" data-testid="applicants-section">
          <h2 className="font-heading text-xl font-medium mb-6">Applicants ({applications.length})</h2>
          <div className="space-y-3">
            {applications.map((a) => (
              <div key={a.id} className="bg-zinc-950 border border-white/5 rounded-md p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{a.user_name}</div>
                  <div className="text-xs text-zinc-500">{a.user_email} • Applied {new Date(a.created_at).toLocaleDateString()}</div>
                  {a.cover_letter && <p className="text-sm text-zinc-400 mt-2 line-clamp-2">{a.cover_letter}</p>}
                </div>
                <div className="flex gap-2">
                  <select value={a.status} onChange={async (e) => {
                    await api.put(`/jobs/applications/${a.id}/status`, { status: e.target.value });
                    setApplications((prev) => prev.map((x) => x.id === a.id ? { ...x, status: e.target.value } : x));
                  }} className="bg-zinc-800 border border-white/10 rounded-md text-sm p-2">
                    <option value="applied">Applied</option>
                    <option value="shortlisted">Shortlisted</option>
                    <option value="interview">Interview</option>
                    <option value="rejected">Rejected</option>
                    <option value="hired">Hired</option>
                  </select>
                  <Link to={`/chat/${a.user_id}`}><Button variant="outline" size="sm" className="border-white/10">Chat</Button></Link>
                </div>
              </div>
            ))}
            {applications.length === 0 && <p className="text-zinc-500">No applications yet.</p>}
          </div>
        </div>
      )}

      {showApply && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowApply(false)}>
          <div className="bg-zinc-950 border border-white/10 rounded-lg w-full max-w-lg p-8 my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-heading text-2xl font-semibold mb-6">Apply to {job.title}</h2>
            <div className="space-y-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Resume</div>
                <FileUpload
                  category="resume"
                  accept={{ "application/pdf": [".pdf"], "application/msword": [".doc"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] }}
                  currentUrl={resumeUrl}
                  hint="PDF or DOCX, max 15MB"
                  testId="upload-resume"
                  onUploaded={(r) => setResumeUrl(r?.full_url || "")}
                  maxMB={15}
                />
                <Input data-testid="apply-resume" placeholder="...or paste a resume URL (Drive/LinkedIn/portfolio)" value={resumeUrl} onChange={(e) => setResumeUrl(e.target.value)} className="bg-zinc-900 border-white/10 mt-2" />
              </div>
              <textarea data-testid="apply-cover" placeholder="Cover letter (optional)" rows={5} value={cover} onChange={(e) => setCover(e.target.value)} className="w-full p-3 bg-zinc-900 border border-white/10 rounded-md text-sm" />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="ghost" onClick={() => setShowApply(false)}>Cancel</Button>
              <Button onClick={apply} className="bg-indigo-500 hover:bg-indigo-400" data-testid="apply-submit">Submit application</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import {
  BookOpen, Trophy, Award, TrendingUp, Briefcase, DollarSign,
  Users, FileText, Plus, Activity, Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import AdminConsole from "@/components/AdminConsole";

export default function Dashboard() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === "student") return <StudentDashboard />;
  if (user.role === "trainer") return <TrainerDashboard />;
  if (user.role === "recruiter") return <RecruiterDashboard />;
  if (user.role === "admin") return <AdminDashboard />;
  return null;
}

// ============ STUDENT ============
function StudentDashboard() {
  const { user } = useAuth();
  const [enrolled, setEnrolled] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [certs, setCerts] = useState([]);
  const [applications, setApplications] = useState([]);
  const [game, setGame] = useState(null);

  useEffect(() => {
    api.get("/courses/me/enrolled").then((r) => setEnrolled(r.data || []));
    api.get("/quizzes/me/attempts").then((r) => setAttempts(r.data || []));
    api.get("/courses/me/certificates").then((r) => setCerts(r.data || []));
    api.get("/jobs/me/applications").then((r) => setApplications(r.data || []));
    // Trigger daily-login and fetch gamification state
    api.post("/gamification/daily-login").catch(() => {});
    api.get("/gamification/me").then((r) => setGame(r.data)).catch(() => {});
  }, []);

  const lvlPct = game?.level_total ? Math.round((game.level_progress / game.level_total) * 100) : 0;

  return (
    <div className="max-w-[1600px] mx-auto px-6 sm:px-10 py-10" data-testid="student-dashboard">
      <div className="mb-10">
        <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">/ Student</div>
        <h1 className="font-heading text-4xl font-semibold tracking-tighter-x mt-3">
          Welcome back, <span className="text-indigo-400">{(user?.name || user?.email || "there").split(" ")[0]}</span>
        </h1>
        <p className="text-zinc-400 mt-2">Pick up where you left off, or explore new courses.</p>
      </div>

      {game && (
        <Link to="/badges" className="block mb-6 group" data-testid="game-banner">
          <div className="bg-gradient-to-r from-indigo-500/10 via-fuchsia-500/5 to-zinc-900 border border-indigo-500/30 rounded-lg p-5 flex items-center gap-6 hover:border-indigo-500/60 transition-colors">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">Level</div>
              <div className="font-heading text-3xl font-semibold">{game.level}</div>
            </div>
            <div className="flex-1">
              <div className="text-sm text-zinc-300">{game.xp.toLocaleString()} XP earned</div>
              <div className="mt-2 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" style={{ width: `${lvlPct}%` }} />
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">{game.level_progress} / {game.level_total} XP to level {game.level + 1}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-orange-300 font-semibold">Streak</div>
              <div className="font-heading text-3xl font-semibold text-orange-400">{game.streak}🔥</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-yellow-300 font-semibold">Badges</div>
              <div className="font-heading text-3xl font-semibold text-yellow-300">{game.badges.length}</div>
            </div>
            <div className="text-sm text-indigo-400 group-hover:text-indigo-300">View →</div>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={BookOpen} label="Enrolled" value={enrolled.length} testid="stat-enrolled" />
        <StatCard icon={Trophy} label="Quizzes taken" value={attempts.length} testid="stat-quizzes" />
        <StatCard icon={Award} label="Certificates" value={certs.length} testid="stat-certs" />
        <StatCard icon={Briefcase} label="Applications" value={applications.length} testid="stat-apps" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-zinc-900 border border-white/5 rounded-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-xl font-medium">Continue learning</h2>
            <Link to="/courses" className="text-sm text-indigo-400 hover:text-indigo-300">Browse all →</Link>
          </div>
          {enrolled.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-zinc-500 mb-4">No enrolled courses yet</p>
              <Link to="/courses"><Button className="bg-indigo-500 hover:bg-indigo-400">Explore courses</Button></Link>
            </div>
          ) : (
            <div className="space-y-3">
              {enrolled.slice(0, 5).map((c) => (
                <CourseRow key={c.id} course={c} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-zinc-900 border border-white/5 rounded-lg p-6">
            <h2 className="font-heading text-lg font-medium mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-400" /> AI Tools
            </h2>
            <div className="space-y-2">
              {[
                { to: "/ai?mode=doubt", label: "Doubt solver" },
                { to: "/resume-parser", label: "Resume parser" },
                { to: "/mock-interview", label: "AI mock interview" },
                { to: "/ai?mode=roadmap", label: "Learning roadmap" },
                { to: "/ai?mode=interview", label: "Interview prep" },
              ].map((t) => (
                <Link key={t.to} to={t.to} className="block px-3 py-2 rounded-md text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors" data-testid={`ai-link-${t.label.toLowerCase().replace(" ", "-")}`}>
                  {t.label} →
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900 border border-white/5 rounded-lg p-6">
            <h2 className="font-heading text-lg font-medium mb-4">Recent quiz scores</h2>
            {attempts.length === 0 ? (
              <p className="text-sm text-zinc-500">No quiz attempts yet.</p>
            ) : (
              <div className="space-y-3">
                {attempts.slice(0, 5).map((a) => (
                  <div key={a.id} className="flex justify-between text-sm">
                    <span className="text-zinc-400 truncate">Quiz attempt</span>
                    <span className={`font-medium ${a.score >= 70 ? "text-emerald-400" : "text-amber-400"}`}>{a.score}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {certs.length > 0 && (
        <div className="mt-8 bg-zinc-900 border border-white/5 rounded-lg p-8">
          <h2 className="font-heading text-xl font-medium mb-6 flex items-center gap-2"><Award className="h-5 w-5 text-amber-400" /> Certificates</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {certs.map((c) => (
              <div key={c.id} className="bg-zinc-950 border border-amber-500/20 rounded-md p-5">
                <Award className="h-6 w-6 text-amber-400 mb-3" />
                <div className="font-medium">{c.course_title}</div>
                <div className="text-xs text-zinc-500 mt-1 font-mono">{c.credential_id}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CourseRow({ course }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    api.get(`/courses/${course.id}/progress`).then((r) => setPct(r.data.progress_pct || 0));
  }, [course.id]);
  return (
    <Link to={`/courses/${course.id}`} className="block group" data-testid={`enrolled-${course.id}`}>
      <div className="flex items-center gap-4 p-3 rounded-md hover:bg-zinc-800 transition-colors">
        <img src={course.thumbnail || "https://static.prod-images.emergentagent.com/jobs/dc290901-7081-495e-be3b-755453cb236d/images/e4af241411c508ddbfc4a9a29ad6e4cdf0b55c0984adaf621b7a026d6fef898e.png"} className="h-14 w-24 object-cover rounded" alt="" />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate group-hover:text-indigo-300">{course.title}</div>
          <div className="text-xs text-zinc-500 mb-1.5">{course.lessons?.length || 0} lessons</div>
          <div className="h-1 bg-zinc-800 rounded">
            <div className="h-full bg-indigo-500 rounded" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="text-sm text-zinc-400">{pct}%</div>
      </div>
    </Link>
  );
}

function StatCard({ icon: Icon, label, value, testid }) {
  return (
    <div className="bg-zinc-900 border border-white/5 rounded-lg p-6" data-testid={testid}>
      <Icon className="h-5 w-5 text-indigo-400 mb-3" />
      <div className="text-3xl font-heading font-semibold tracking-tight">{value}</div>
      <div className="text-xs uppercase tracking-wider text-zinc-500 mt-1">{label}</div>
    </div>
  );
}

// ============ TRAINER ============
function TrainerDashboard() {
  const { user } = useAuth();
  const [myCourses, setMyCourses] = useState([]);
  useEffect(() => {
    api.get(`/courses?trainer_id=${user.id}`).then((r) => setMyCourses(r.data || []));
  }, [user]);
  const totalStudents = myCourses.reduce((s, c) => s + (c.students_count || 0), 0);
  const totalRev = myCourses.reduce((s, c) => s + (c.students_count || 0) * (c.price || 0), 0);
  return (
    <div className="max-w-[1600px] mx-auto px-6 sm:px-10 py-10" data-testid="trainer-dashboard">
      <div className="flex items-end justify-between mb-10">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">/ Trainer</div>
          <h1 className="font-heading text-4xl font-semibold tracking-tighter-x mt-3">Your studio</h1>
        </div>
        <Link to="/courses"><Button className="bg-indigo-500 hover:bg-indigo-400"><Plus className="h-4 w-4 mr-1" /> New course</Button></Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={BookOpen} label="Courses" value={myCourses.length} testid="stat-courses" />
        <StatCard icon={Users} label="Students" value={totalStudents} testid="stat-students" />
        <StatCard icon={DollarSign} label="Revenue" value={`$${totalRev.toFixed(0)}`} testid="stat-revenue" />
        <StatCard icon={TrendingUp} label="Avg rating" value={(myCourses.reduce((s,c) => s + c.rating, 0) / (myCourses.length || 1)).toFixed(1)} testid="stat-rating" />
      </div>
      <div className="bg-zinc-900 border border-white/5 rounded-lg p-8">
        <h2 className="font-heading text-xl font-medium mb-6">My courses</h2>
        {myCourses.length === 0 ? <p className="text-zinc-500">You haven't published any courses yet. Click "New course" to begin.</p> : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myCourses.map((c) => (
              <Link key={c.id} to={`/courses/${c.id}`} className="bg-zinc-950 border border-white/5 rounded-md p-5 hover:border-indigo-500/30">
                <div className="font-medium">{c.title}</div>
                <div className="text-xs text-zinc-500 mt-1">{c.students_count} students • ★ {c.rating.toFixed(1)}</div>
                <div className="text-indigo-400 text-sm mt-3">${((c.students_count||0)*(c.price||0)).toFixed(0)} revenue</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ RECRUITER ============
function RecruiterDashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const load = () => api.get(`/jobs?recruiter_id=${user.id}`).then((r) => setJobs(r.data || []));
  useEffect(() => { load(); }, [user]);
  const totalApps = jobs.reduce((s, j) => s + (j.applicants_count || 0), 0);
  return (
    <div className="max-w-[1600px] mx-auto px-6 sm:px-10 py-10" data-testid="recruiter-dashboard">
      <div className="flex items-end justify-between mb-10">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">/ Recruiter</div>
          <h1 className="font-heading text-4xl font-semibold tracking-tighter-x mt-3">Hiring hub</h1>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-indigo-500 hover:bg-indigo-400" data-testid="post-job-btn"><Plus className="h-4 w-4 mr-1" /> Post job</Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Briefcase} label="Open jobs" value={jobs.length} testid="stat-jobs" />
        <StatCard icon={FileText} label="Applications" value={totalApps} testid="stat-apps" />
        <StatCard icon={Activity} label="Avg/job" value={(totalApps/(jobs.length||1)).toFixed(0)} testid="stat-avg" />
        <StatCard icon={Users} label="Pipeline" value={totalApps} testid="stat-pipeline" />
      </div>
      <div className="bg-zinc-900 border border-white/5 rounded-lg p-8">
        <h2 className="font-heading text-xl font-medium mb-6">My job postings</h2>
        {jobs.length === 0 ? <p className="text-zinc-500">No jobs posted yet.</p> : (
          <div className="space-y-3">
            {jobs.map((j) => (
              <Link key={j.id} to={`/jobs/${j.id}`} className="flex justify-between items-center p-4 bg-zinc-950 border border-white/5 rounded-md hover:border-indigo-500/30 transition-colors">
                <div>
                  <div className="font-medium">{j.title}</div>
                  <div className="text-xs text-zinc-500 mt-1">{j.company} • {j.location} • {j.job_type}</div>
                </div>
                <Badge className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">{j.applicants_count} applicants</Badge>
              </Link>
            ))}
          </div>
        )}
      </div>
      {showCreate && <JobCreateModal onClose={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function JobCreateModal({ onClose }) {
  const [form, setForm] = useState({
    title: "", company: "", location: "Remote", job_type: "Full-time",
    experience: "Entry", salary_min: 0, salary_max: 0,
    description: "", requirements: "", skills: "",
  });
  const submit = async () => {
    try {
      await api.post("/jobs", {
        ...form,
        salary_min: Number(form.salary_min), salary_max: Number(form.salary_max),
        requirements: form.requirements.split("\n").filter(Boolean),
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
      });
      toast.success("Job posted!");
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed"));
    }
  };
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-zinc-950 border border-white/10 rounded-lg w-full max-w-2xl my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-8">
          <h2 className="font-heading text-2xl font-semibold mb-6">Post a new job</h2>
          <div className="space-y-3">
            <input className="w-full p-3 bg-zinc-900 border border-white/10 rounded-md" placeholder="Job title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="job-title" />
            <input className="w-full p-3 bg-zinc-900 border border-white/10 rounded-md" placeholder="Company name" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} data-testid="job-company" />
            <div className="grid grid-cols-2 gap-3">
              <input className="w-full p-3 bg-zinc-900 border border-white/10 rounded-md" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              <select className="w-full p-3 bg-zinc-900 border border-white/10 rounded-md" value={form.job_type} onChange={(e) => setForm({ ...form, job_type: e.target.value })}>
                <option>Full-time</option><option>Part-time</option><option>Internship</option><option>Contract</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input className="w-full p-3 bg-zinc-900 border border-white/10 rounded-md" placeholder="Salary min" type="number" value={form.salary_min} onChange={(e) => setForm({ ...form, salary_min: e.target.value })} />
              <input className="w-full p-3 bg-zinc-900 border border-white/10 rounded-md" placeholder="Salary max" type="number" value={form.salary_max} onChange={(e) => setForm({ ...form, salary_max: e.target.value })} />
            </div>
            <textarea className="w-full p-3 bg-zinc-900 border border-white/10 rounded-md" rows={4} placeholder="Job description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="job-description" />
            <textarea className="w-full p-3 bg-zinc-900 border border-white/10 rounded-md" rows={3} placeholder="Requirements (one per line)" value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} />
            <input className="w-full p-3 bg-zinc-900 border border-white/10 rounded-md" placeholder="Skills (comma-separated)" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} className="bg-indigo-500 hover:bg-indigo-400" data-testid="job-submit">Post job</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ ADMIN ============
function AdminDashboard() {
  const apiBase = useMemo(() => {
    const inst = axios.create({ baseURL: `${process.env.REACT_APP_BACKEND_URL}/api/admin` });
    inst.interceptors.request.use((cfg) => {
      const tok = localStorage.getItem("skl_token");
      if (tok) cfg.headers.Authorization = `Bearer ${tok}`;
      return cfg;
    });
    return inst;
  }, []);
  return (
    <AdminConsole
      apiBase={apiBase}
      canCreate={{ users: true, courses: true, jobs: true, threads: true, challenges: true, quizzes: true }}
      title="Admin Console"
      subtitle="Platform moderation & analytics"
      accent="indigo"
    />
  );
}

/* end of Dashboard */

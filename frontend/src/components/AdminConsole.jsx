/**
 * Shared interactive admin dashboard.
 *
 * Drives BOTH the Admin and SuperAdmin consoles by accepting:
 *   - apiBase: axios instance with baseURL + auth headers pre-wired
 *   - canCreate: object {users, courses, jobs, threads, challenges, quizzes}
 *                — SuperAdmin gets all true, Admin gets all false (edit/delete only)
 *   - title, subtitle, accent (visual differentiation)
 *
 * Tabs: Overview (charts) | Users | Courses | Jobs | Forum | Challenges | Quizzes | Payments | Audit (SA only)
 */
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
  LayoutDashboard, Users, BookOpen, Briefcase, MessageSquare,
  Code2, FileQuestion, DollarSign, Activity, Plus, Trash2, Edit2, Ban,
  CheckCircle2, Lock, Pin, Search,
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

const COLORS = ["#6366F1", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6", "#06B6D4"];

export default function AdminConsole({ apiBase, canCreate, title = "Admin Console", subtitle = "Platform administration", accent = "indigo", showAudit = false }) {
  const [tab, setTab] = useState("overview");
  const accentBg = accent === "red" ? "bg-red-500" : "bg-indigo-500";
  const accentText = accent === "red" ? "text-red-400" : "text-indigo-400";
  const accentBorder = accent === "red" ? "border-red-500/30" : "border-indigo-500/30";

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "users", label: "Users", icon: Users },
    { id: "courses", label: "Courses", icon: BookOpen },
    { id: "jobs", label: "Jobs", icon: Briefcase },
    { id: "threads", label: "Forum", icon: MessageSquare },
    { id: "challenges", label: "Challenges", icon: Code2 },
    { id: "quizzes", label: "Quizzes", icon: FileQuestion },
    { id: "payments", label: "Payments", icon: DollarSign },
    ...(showAudit ? [{ id: "audit", label: "Audit", icon: Activity }] : []),
  ];

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-10" data-testid="admin-console">
      <div className="mb-8 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className={`text-xs uppercase tracking-[0.2em] ${accentText} font-semibold`}>/ {accent === "red" ? "SuperAdmin" : "Admin"}</div>
          <h1 className="font-heading text-4xl font-semibold tracking-tighter-x mt-2">{title}</h1>
          <p className="text-zinc-400 mt-1">{subtitle}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto border-b border-white/5 pb-px">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} data-testid={`tab-${t.id}`}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap inline-flex items-center gap-1.5 border-b-2 ${tab === t.id ? `${accentText} border-current` : "text-zinc-500 border-transparent hover:text-zinc-300"}`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview apiBase={apiBase} accentBg={accentBg} />}
      {tab === "users" && <UsersTab apiBase={apiBase} canCreate={canCreate.users} accentBg={accentBg} accentBorder={accentBorder} />}
      {tab === "courses" && <CoursesTab apiBase={apiBase} canCreate={canCreate.courses} accentBg={accentBg} accentBorder={accentBorder} />}
      {tab === "jobs" && <JobsTab apiBase={apiBase} canCreate={canCreate.jobs} accentBg={accentBg} accentBorder={accentBorder} />}
      {tab === "threads" && <ThreadsTab apiBase={apiBase} canCreate={canCreate.threads} accentBg={accentBg} accentBorder={accentBorder} />}
      {tab === "challenges" && <ChallengesTab apiBase={apiBase} canCreate={canCreate.challenges} accentBg={accentBg} accentBorder={accentBorder} />}
      {tab === "quizzes" && <QuizzesTab apiBase={apiBase} canCreate={canCreate.quizzes} accentBg={accentBg} accentBorder={accentBorder} />}
      {tab === "payments" && <PaymentsTab apiBase={apiBase} />}
      {tab === "audit" && showAudit && <AuditTab apiBase={apiBase} />}
    </div>
  );
}

/* ===== Overview ===== */
function Overview({ apiBase, accentBg }) {
  const [data, setData] = useState(null);
  useEffect(() => { apiBase.get("/analytics").then((r) => setData(r.data)).catch(() => {}); }, [apiBase]);
  if (!data) return <div className="text-zinc-500">Loading analytics…</div>;
  const s = data.stats;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Users" value={s.users.total} sublabel={`${s.users.students}S · ${s.users.trainers}T · ${s.users.recruiters}R · ${s.users.admins}A`} testid="stat-users" />
        <Stat label="Courses" value={s.courses} sublabel={`${s.enrollments} enrollments`} testid="stat-courses" />
        <Stat label="Jobs" value={s.jobs} sublabel={`${s.applications} applications`} testid="stat-jobs" />
        <Stat label="Revenue" value={`$${(s.revenue || 0).toFixed(0)}`} sublabel={`${s.transactions} transactions`} testid="stat-revenue" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartCard title="User signups (last 30 days)">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.user_growth} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
              <YAxis stroke="#71717a" fontSize={10} />
              <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a" }} />
              <Line type="monotone" dataKey="count" stroke="#6366F1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Users by role">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data.users_by_role} dataKey="count" nameKey="role" innerRadius={50} outerRadius={90}>
                {data.users_by_role.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Courses by category">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.courses_by_category}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="category" stroke="#71717a" fontSize={10} />
              <YAxis stroke="#71717a" fontSize={10} />
              <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a" }} />
              <Bar dataKey="count" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Revenue (last 30 days)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.revenue_by_day}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
              <YAxis stroke="#71717a" fontSize={10} />
              <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #27272a" }} formatter={(v) => `$${v}`} />
              <Bar dataKey="amount" fill="#F59E0B" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function Stat({ label, value, sublabel, testid }) {
  return (
    <div className="bg-zinc-900 border border-white/5 rounded-lg p-5" data-testid={testid}>
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="font-heading text-3xl font-semibold mt-2">{value}</div>
      <div className="text-xs text-zinc-500 mt-1">{sublabel}</div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-zinc-900 border border-white/5 rounded-lg p-5">
      <div className="text-sm font-medium mb-4">{title}</div>
      {children}
    </div>
  );
}

/* ===== Users ===== */
function UsersTab({ apiBase, canCreate, accentBg, accentBorder }) {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [modal, setModal] = useState(null); // { mode: 'create'|'edit', user }

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (role) params.set("role", role);
    apiBase.get(`/users?${params}`).then((r) => setRows(r.data || []));
  }, [apiBase, q, role]);

  useEffect(() => { load(); }, [load]);

  const banToggle = async (u) => {
    await apiBase.post(`/users/${u.id}/${u.banned ? "unban" : "ban"}`);
    toast.success(u.banned ? "Unbanned" : "Banned");
    load();
  };
  const remove = async (u) => {
    if (!confirm(`Delete ${u.email}?`)) return;
    await apiBase.delete(`/users/${u.id}`); toast.success("Deleted"); load();
  };
  const saveUser = async (payload, isCreate) => {
    try {
      if (isCreate) await apiBase.post("/users", payload);
      else await apiBase.patch(`/users/${modal.user.id}`, payload);
      toast.success(isCreate ? "User created" : "Updated"); setModal(null); load();
    } catch (e) { toast.error(getErrorMessage(e)); }
  };

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" /><Input data-testid="user-search" placeholder="Search email or name…" className="bg-zinc-950 border-white/10 pl-8" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="bg-zinc-950 border border-white/10 rounded-md px-3 text-sm" data-testid="user-role-filter">
          <option value="">All roles</option><option value="student">Student</option><option value="trainer">Trainer</option><option value="recruiter">Recruiter</option><option value="admin">Admin</option>
        </select>
        {canCreate && <Button onClick={() => setModal({ mode: "create", user: { role: "student" } })} className={`${accentBg} hover:opacity-90`} data-testid="user-add"><Plus className="h-4 w-4 mr-1" /> Add user</Button>}
      </div>
      <Table headers={["Email", "Name", "Role", "Status", "Created", ""]}>
        {rows.map((u) => (
          <tr key={u.id} className="border-t border-white/5">
            <td className="px-4 py-2 text-sm">{u.email}</td>
            <td className="px-4 py-2 text-sm">{u.name}</td>
            <td className="px-4 py-2"><span className="text-xs uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">{u.role}</span></td>
            <td className="px-4 py-2 text-xs">{u.banned ? <span className="text-red-400">Banned</span> : <span className="text-emerald-400">Active</span>}</td>
            <td className="px-4 py-2 text-xs text-zinc-500">{(u.created_at || "").slice(0, 10)}</td>
            <td className="px-4 py-2 text-right whitespace-nowrap">
              <IconBtn onClick={() => setModal({ mode: "edit", user: u })} testid={`edit-user-${u.id}`}><Edit2 className="h-3.5 w-3.5" /></IconBtn>
              <IconBtn onClick={() => banToggle(u)} testid={`ban-user-${u.id}`}><Ban className={`h-3.5 w-3.5 ${u.banned ? "text-emerald-400" : "text-amber-400"}`} /></IconBtn>
              <IconBtn onClick={() => remove(u)} testid={`delete-user-${u.id}`}><Trash2 className="h-3.5 w-3.5 text-red-400" /></IconBtn>
            </td>
          </tr>
        ))}
      </Table>
      {modal && <UserModal mode={modal.mode} initial={modal.user} onClose={() => setModal(null)} onSave={saveUser} />}
    </div>
  );
}

function UserModal({ mode, initial, onClose, onSave }) {
  const [form, setForm] = useState({ email: initial.email || "", name: initial.name || "", role: initial.role || "student", password: "", is_premium: initial.is_premium || false });
  const isCreate = mode === "create";
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-white/10">
        <DialogHeader><DialogTitle>{isCreate ? "Add user" : `Edit ${initial.email}`}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {isCreate && <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-zinc-900 border-white/10" data-testid="modal-email" />}
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-zinc-900 border-white/10" data-testid="modal-name" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm" data-testid="modal-role">
            <option value="student">Student</option><option value="trainer">Trainer</option><option value="recruiter">Recruiter</option><option value="admin">Admin</option>
          </select>
          {isCreate && <Input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="bg-zinc-900 border-white/10" data-testid="modal-password" />}
          <label className="flex items-center gap-2 text-sm text-zinc-400"><input type="checkbox" checked={form.is_premium} onChange={(e) => setForm({ ...form, is_premium: e.target.checked })} /> Premium</label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-white/10">Cancel</Button>
          <Button onClick={() => { const p = { ...form }; if (!isCreate) { delete p.email; delete p.password; } onSave(p, isCreate); }} className="bg-indigo-500 hover:bg-indigo-400" data-testid="modal-save">{isCreate ? "Create" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ===== Courses ===== */
function CoursesTab({ apiBase, canCreate, accentBg }) {
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(null);
  const load = useCallback(() => apiBase.get("/courses").then((r) => setRows(r.data || [])), [apiBase]);
  useEffect(() => { load(); }, [load]);
  const remove = async (c) => { if (!confirm(`Delete "${c.title}"?`)) return; await apiBase.delete(`/courses/${c.id}`); toast.success("Deleted"); load(); };
  const save = async (p, isCreate) => {
    try {
      if (isCreate) await apiBase.post("/courses", p); else await apiBase.patch(`/courses/${modal.row.id}`, p);
      toast.success(isCreate ? "Created" : "Updated"); setModal(null); load();
    } catch (e) { toast.error(getErrorMessage(e)); }
  };
  return (
    <div>
      <div className="mb-4 flex justify-between items-center"><div className="text-sm text-zinc-400">{rows.length} courses</div>{canCreate && <Button onClick={() => setModal({ mode: "create", row: {} })} className={`${accentBg} hover:opacity-90`} data-testid="course-add"><Plus className="h-4 w-4 mr-1" /> Add course</Button>}</div>
      <Table headers={["", "Title", "Category", "Level", "Price", "Students", ""]}>
        {rows.map((c) => (
          <tr key={c.id} className="border-t border-white/5">
            <td className="px-3 py-2 w-12">{c.thumbnail ? <img src={c.thumbnail} alt="" className="h-8 w-12 object-cover rounded" /> : <div className="h-8 w-12 bg-zinc-800 rounded" />}</td>
            <td className="px-4 py-2 text-sm font-medium">{c.title}</td>
            <td className="px-4 py-2 text-xs text-zinc-400">{c.category}</td>
            <td className="px-4 py-2 text-xs">{c.level}</td>
            <td className="px-4 py-2 text-xs">{c.price > 0 ? `$${c.price}` : <span className="text-emerald-400">Free</span>}</td>
            <td className="px-4 py-2 text-xs">{c.students_count || 0}</td>
            <td className="px-4 py-2 text-right whitespace-nowrap">
              <IconBtn onClick={() => setModal({ mode: "edit", row: c })} testid={`edit-course-${c.id}`}><Edit2 className="h-3.5 w-3.5" /></IconBtn>
              <IconBtn onClick={() => remove(c)} testid={`delete-course-${c.id}`}><Trash2 className="h-3.5 w-3.5 text-red-400" /></IconBtn>
            </td>
          </tr>
        ))}
      </Table>
      {modal && <CourseModal mode={modal.mode} initial={modal.row} onClose={() => setModal(null)} onSave={save} apiBase={apiBase} />}
    </div>
  );
}

function CourseModal({ mode, initial, onClose, onSave, apiBase }) {
  const [f, setF] = useState({
    title: initial.title || "", description: initial.description || "",
    category: initial.category || "Web Development", level: initial.level || "Beginner",
    price: initial.price || 0, thumbnail: initial.thumbnail || "",
  });
  const [uploading, setUploading] = useState(false);
  const isCreate = mode === "create";

  // Upload uses the same axios instance to inherit auth headers (admin = Bearer, SA = X-SuperAdmin-*)
  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be < 5MB"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // Use the global /api/uploads endpoint (needs Bearer JWT — works for admin, NOT for SA since SA has no JWT user).
      // For SA, fall back to inline base64 so the photo still persists.
      const tok = localStorage.getItem("skl_token");
      if (tok) {
        const { data } = await axios.post(
          `${process.env.REACT_APP_BACKEND_URL}/api/uploads?category=thumbnail`,
          fd,
          { headers: { Authorization: `Bearer ${tok}`, "Content-Type": "multipart/form-data" } },
        );
        const url = `${process.env.REACT_APP_BACKEND_URL}${data.url}`;
        setF((p) => ({ ...p, thumbnail: url }));
        toast.success("Photo uploaded");
      } else {
        // SA fallback — inline data URL (no backend storage)
        const reader = new FileReader();
        reader.onload = () => {
          setF((p) => ({ ...p, thumbnail: reader.result }));
          toast.success("Photo attached (inline)");
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Upload failed"));
    } finally { setUploading(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-white/10">
        <DialogHeader><DialogTitle>{isCreate ? "New course" : `Edit "${initial.title}"`}</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          <Input placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="bg-zinc-900 border-white/10" data-testid="course-title" />
          <textarea placeholder="Description" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm" data-testid="course-desc" />
          <Input placeholder="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="bg-zinc-900 border-white/10" />
          <select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} className="w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm"><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select>
          <Input type="number" placeholder="Price (0 = free)" value={f.price} onChange={(e) => setF({ ...f, price: parseFloat(e.target.value || 0) })} className="bg-zinc-900 border-white/10" data-testid="course-price" />

          {/* Photo */}
          <div>
            <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Course photo</label>
            <div className="mt-1.5 flex gap-3 items-start">
              {f.thumbnail ? (
                <img src={f.thumbnail} alt="thumb" className="h-20 w-32 object-cover rounded-md border border-white/10" data-testid="course-thumb-preview" />
              ) : (
                <div className="h-20 w-32 bg-zinc-900 border border-dashed border-white/10 rounded-md flex items-center justify-center text-zinc-600 text-xs">No image</div>
              )}
              <div className="flex-1 space-y-1.5">
                <label className="inline-block cursor-pointer text-xs px-3 py-1.5 bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 rounded hover:bg-indigo-500/25" data-testid="course-photo-upload-label">
                  {uploading ? "Uploading…" : (f.thumbnail ? "Replace photo" : "Upload photo")}
                  <input type="file" accept="image/*" className="hidden" onChange={uploadPhoto} disabled={uploading} data-testid="course-photo-input" />
                </label>
                <Input placeholder="Or paste image URL" value={f.thumbnail.startsWith("data:") ? "" : f.thumbnail} onChange={(e) => setF({ ...f, thumbnail: e.target.value })} className="bg-zinc-900 border-white/10 text-xs" data-testid="course-thumb-url" />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose} className="border-white/10">Cancel</Button><Button onClick={() => onSave(f, isCreate)} className="bg-indigo-500 hover:bg-indigo-400" data-testid="course-save">{isCreate ? "Create" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ===== Jobs ===== */
function JobsTab({ apiBase, canCreate, accentBg }) {
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(null);
  const load = useCallback(() => apiBase.get("/jobs").then((r) => setRows(r.data || [])), [apiBase]);
  useEffect(() => { load(); }, [load]);
  const remove = async (j) => { if (!confirm(`Delete "${j.title}"?`)) return; await apiBase.delete(`/jobs/${j.id}`); toast.success("Deleted"); load(); };
  const save = async (p) => { try { await apiBase.post("/jobs", p); toast.success("Created"); setModal(null); load(); } catch (e) { toast.error(getErrorMessage(e)); } };
  return (
    <div>
      <div className="mb-4 flex justify-between items-center"><div className="text-sm text-zinc-400">{rows.length} jobs</div>{canCreate && <Button onClick={() => setModal({})} className={`${accentBg} hover:opacity-90`} data-testid="job-add"><Plus className="h-4 w-4 mr-1" /> Add job</Button>}</div>
      <Table headers={["Title", "Company", "Type", "Location", "Salary", ""]}>
        {rows.map((j) => (
          <tr key={j.id} className="border-t border-white/5">
            <td className="px-4 py-2 text-sm font-medium">{j.title}</td>
            <td className="px-4 py-2 text-xs">{j.company}</td>
            <td className="px-4 py-2 text-xs text-zinc-400">{j.job_type || j.type || "—"}</td>
            <td className="px-4 py-2 text-xs">{j.location}</td>
            <td className="px-4 py-2 text-xs">${j.salary_min}-${j.salary_max}</td>
            <td className="px-4 py-2 text-right"><IconBtn onClick={() => remove(j)} testid={`delete-job-${j.id}`}><Trash2 className="h-3.5 w-3.5 text-red-400" /></IconBtn></td>
          </tr>
        ))}
      </Table>
      {modal && <JobModal onClose={() => setModal(null)} onSave={save} />}
    </div>
  );
}

function JobModal({ onClose, onSave }) {
  const [f, setF] = useState({ title: "", company: "", description: "", location: "Remote", job_type: "Full-time", experience: "Entry", salary_min: 0, salary_max: 0, skills: "", apply_url: "" });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-white/10">
        <DialogHeader><DialogTitle>New job</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="bg-zinc-900 border-white/10" data-testid="job-title" />
          <Input placeholder="Company" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} className="bg-zinc-900 border-white/10" />
          <textarea placeholder="Description" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Location" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} className="bg-zinc-900 border-white/10" />
            <select value={f.job_type} onChange={(e) => setF({ ...f, job_type: e.target.value })} className="bg-zinc-900 border border-white/10 rounded-md px-3 text-sm"><option>Full-time</option><option>Part-time</option><option>Internship</option><option>Contract</option></select>
            <select value={f.experience} onChange={(e) => setF({ ...f, experience: e.target.value })} className="bg-zinc-900 border border-white/10 rounded-md px-3 text-sm"><option>Entry</option><option>Mid</option><option>Senior</option><option>Lead</option></select>
            <Input placeholder="Apply URL (optional)" value={f.apply_url} onChange={(e) => setF({ ...f, apply_url: e.target.value })} className="bg-zinc-900 border-white/10" />
            <Input type="number" placeholder="Min salary" value={f.salary_min} onChange={(e) => setF({ ...f, salary_min: +e.target.value })} className="bg-zinc-900 border-white/10" />
            <Input type="number" placeholder="Max salary" value={f.salary_max} onChange={(e) => setF({ ...f, salary_max: +e.target.value })} className="bg-zinc-900 border-white/10" />
          </div>
          <Input placeholder="Skills (comma-separated)" value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} className="bg-zinc-900 border-white/10" />
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose} className="border-white/10">Cancel</Button><Button onClick={() => onSave({ ...f, skills: f.skills.split(",").map((s) => s.trim()).filter(Boolean) })} className="bg-indigo-500 hover:bg-indigo-400" data-testid="job-save">Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ===== Forum Threads ===== */
function ThreadsTab({ apiBase, canCreate, accentBg }) {
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(false);
  const load = useCallback(() => apiBase.get("/threads").then((r) => setRows(r.data || [])), [apiBase]);
  useEffect(() => { load(); }, [load]);
  const toggle = async (t, field) => { await apiBase.patch(`/threads/${t.id}`, { [field]: !t[field] }); load(); };
  const remove = async (t) => { if (!confirm(`Delete "${t.title}"?`)) return; await apiBase.delete(`/threads/${t.id}`); toast.success("Deleted"); load(); };
  const save = async (p) => { try { await apiBase.post("/threads", p); toast.success("Created"); setModal(false); load(); } catch (e) { toast.error(getErrorMessage(e)); } };
  return (
    <div>
      <div className="mb-4 flex justify-between items-center"><div className="text-sm text-zinc-400">{rows.length} threads</div>{canCreate && <Button onClick={() => setModal(true)} className={`${accentBg} hover:opacity-90`} data-testid="thread-add"><Plus className="h-4 w-4 mr-1" /> Add thread</Button>}</div>
      <Table headers={["Title", "Category", "Author", "Replies", "Flags", ""]}>
        {rows.map((t) => (
          <tr key={t.id} className="border-t border-white/5">
            <td className="px-4 py-2 text-sm font-medium">{t.title}</td>
            <td className="px-4 py-2 text-xs text-zinc-400">{t.category}</td>
            <td className="px-4 py-2 text-xs">{t.author_name}</td>
            <td className="px-4 py-2 text-xs">{t.replies_count || 0}</td>
            <td className="px-4 py-2 text-xs">{t.pinned && <span className="text-amber-400 mr-2">📌</span>}{t.locked && <span className="text-red-400">🔒</span>}</td>
            <td className="px-4 py-2 text-right whitespace-nowrap">
              <IconBtn onClick={() => toggle(t, "pinned")} testid={`pin-${t.id}`}><Pin className={`h-3.5 w-3.5 ${t.pinned ? "text-amber-400" : ""}`} /></IconBtn>
              <IconBtn onClick={() => toggle(t, "locked")} testid={`lock-${t.id}`}><Lock className={`h-3.5 w-3.5 ${t.locked ? "text-red-400" : ""}`} /></IconBtn>
              <IconBtn onClick={() => remove(t)} testid={`delete-thread-${t.id}`}><Trash2 className="h-3.5 w-3.5 text-red-400" /></IconBtn>
            </td>
          </tr>
        ))}
      </Table>
      {modal && <ThreadModal onClose={() => setModal(false)} onSave={save} />}
    </div>
  );
}

function ThreadModal({ onClose, onSave }) {
  const [f, setF] = useState({ title: "", content: "", category: "Discussion", pinned: false });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-white/10">
        <DialogHeader><DialogTitle>New thread</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="bg-zinc-900 border-white/10" data-testid="thread-title" />
          <textarea placeholder="Content (markdown supported)" rows={5} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} className="w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm" />
          <Input placeholder="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="bg-zinc-900 border-white/10" />
          <label className="flex items-center gap-2 text-sm text-zinc-400"><input type="checkbox" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} /> Pin to top</label>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose} className="border-white/10">Cancel</Button><Button onClick={() => onSave(f)} className="bg-indigo-500 hover:bg-indigo-400" data-testid="thread-save">Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ===== Challenges ===== */
function ChallengesTab({ apiBase, canCreate, accentBg }) {
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(null);
  const load = useCallback(() => apiBase.get("/challenges").then((r) => setRows(r.data || [])), [apiBase]);
  useEffect(() => { load(); }, [load]);
  const remove = async (c) => { if (!confirm(`Delete "${c.title}"?`)) return; await apiBase.delete(`/challenges/${c.id}`); toast.success("Deleted"); load(); };
  const save = async (p, isCreate) => {
    try { if (isCreate) await apiBase.post("/challenges", p); else await apiBase.patch(`/challenges/${modal.row.id}`, p);
    toast.success(isCreate ? "Created" : "Updated"); setModal(null); load(); } catch (e) { toast.error(getErrorMessage(e)); }
  };
  return (
    <div>
      <div className="mb-4 flex justify-between items-center"><div className="text-sm text-zinc-400">{rows.length} challenges</div>{canCreate && <Button onClick={() => setModal({ mode: "create", row: {} })} className={`${accentBg} hover:opacity-90`} data-testid="challenge-add"><Plus className="h-4 w-4 mr-1" /> Add challenge</Button>}</div>
      <Table headers={["Title", "Difficulty", "Language", "Tests", ""]}>
        {rows.map((c) => (
          <tr key={c.id} className="border-t border-white/5">
            <td className="px-4 py-2 text-sm font-medium">{c.title}</td>
            <td className="px-4 py-2 text-xs"><span className={`px-2 py-0.5 rounded ${c.difficulty === "easy" ? "bg-emerald-500/15 text-emerald-300" : c.difficulty === "medium" ? "bg-amber-500/15 text-amber-300" : "bg-red-500/15 text-red-300"}`}>{c.difficulty}</span></td>
            <td className="px-4 py-2 text-xs">{c.language}</td>
            <td className="px-4 py-2 text-xs">{(c.test_cases || []).length}</td>
            <td className="px-4 py-2 text-right whitespace-nowrap">
              <IconBtn onClick={() => setModal({ mode: "edit", row: c })} testid={`edit-challenge-${c.id}`}><Edit2 className="h-3.5 w-3.5" /></IconBtn>
              <IconBtn onClick={() => remove(c)} testid={`delete-challenge-${c.id}`}><Trash2 className="h-3.5 w-3.5 text-red-400" /></IconBtn>
            </td>
          </tr>
        ))}
      </Table>
      {modal && <ChallengeModal mode={modal.mode} initial={modal.row} onClose={() => setModal(null)} onSave={save} />}
    </div>
  );
}

function ChallengeModal({ mode, initial, onClose, onSave }) {
  const [f, setF] = useState({
    title: initial.title || "", description: initial.description || "",
    difficulty: initial.difficulty || "easy", language: initial.language || "python",
    starter_code: initial.starter_code || "",
    test_cases_text: JSON.stringify(initial.test_cases || [{ input: "", expected_output: "" }], null, 2),
  });
  const isCreate = mode === "create";
  const submit = () => {
    let test_cases;
    try { test_cases = JSON.parse(f.test_cases_text); } catch { toast.error("Invalid test cases JSON"); return; }
    onSave({ title: f.title, description: f.description, difficulty: f.difficulty, language: f.language, starter_code: f.starter_code, test_cases }, isCreate);
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-white/10 max-w-2xl">
        <DialogHeader><DialogTitle>{isCreate ? "New challenge" : `Edit "${initial.title}"`}</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          <Input placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="bg-zinc-900 border-white/10" data-testid="challenge-title" />
          <textarea placeholder="Description (markdown)" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <select value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })} className="bg-zinc-900 border border-white/10 rounded-md px-3 text-sm"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select>
            <select value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })} className="bg-zinc-900 border border-white/10 rounded-md px-3 text-sm"><option>python</option><option>javascript</option></select>
          </div>
          <textarea placeholder="Starter code" rows={4} value={f.starter_code} onChange={(e) => setF({ ...f, starter_code: e.target.value })} className="w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm font-mono" />
          <textarea placeholder='[{"input":"5","expected_output":"25"}]' rows={5} value={f.test_cases_text} onChange={(e) => setF({ ...f, test_cases_text: e.target.value })} className="w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm font-mono" />
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose} className="border-white/10">Cancel</Button><Button onClick={submit} className="bg-indigo-500 hover:bg-indigo-400" data-testid="challenge-save">{isCreate ? "Create" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ===== Quizzes ===== */
function QuizzesTab({ apiBase, canCreate, accentBg }) {
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(false);
  const load = useCallback(() => apiBase.get("/quizzes").then((r) => setRows(r.data || [])), [apiBase]);
  useEffect(() => { load(); }, [load]);
  const remove = async (q) => { if (!confirm(`Delete "${q.title}"?`)) return; await apiBase.delete(`/quizzes/${q.id}`); toast.success("Deleted"); load(); };
  const save = async (p) => { try { await apiBase.post("/quizzes", p); toast.success("Created"); setModal(false); load(); } catch (e) { toast.error(getErrorMessage(e)); } };
  return (
    <div>
      <div className="mb-4 flex justify-between items-center"><div className="text-sm text-zinc-400">{rows.length} quizzes</div>{canCreate && <Button onClick={() => setModal(true)} className={`${accentBg} hover:opacity-90`} data-testid="quiz-add"><Plus className="h-4 w-4 mr-1" /> Add quiz</Button>}</div>
      <Table headers={["Title", "Duration", "Questions", "Course", ""]}>
        {rows.map((q) => (
          <tr key={q.id} className="border-t border-white/5">
            <td className="px-4 py-2 text-sm font-medium">{q.title}</td>
            <td className="px-4 py-2 text-xs">{q.duration_min}m</td>
            <td className="px-4 py-2 text-xs">{(q.questions || []).length}</td>
            <td className="px-4 py-2 text-xs text-zinc-500">{(q.course_id || "—").slice(0, 12)}</td>
            <td className="px-4 py-2 text-right"><IconBtn onClick={() => remove(q)} testid={`delete-quiz-${q.id}`}><Trash2 className="h-3.5 w-3.5 text-red-400" /></IconBtn></td>
          </tr>
        ))}
      </Table>
      {modal && <QuizModal onClose={() => setModal(false)} onSave={save} />}
    </div>
  );
}

function QuizModal({ onClose, onSave }) {
  const [f, setF] = useState({ title: "", description: "", duration_min: 10, course_id: "", questions_text: '[{"question":"What is 2+2?","options":["3","4","5","6"],"correct":1}]' });
  const submit = () => {
    let questions;
    try { questions = JSON.parse(f.questions_text); } catch { toast.error("Invalid questions JSON"); return; }
    onSave({ title: f.title, description: f.description, duration_min: +f.duration_min, course_id: f.course_id, questions });
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-white/10 max-w-2xl">
        <DialogHeader><DialogTitle>New quiz</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          <Input placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="bg-zinc-900 border-white/10" data-testid="quiz-title" />
          <Input placeholder="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="bg-zinc-900 border-white/10" />
          <Input type="number" placeholder="Duration (min)" value={f.duration_min} onChange={(e) => setF({ ...f, duration_min: e.target.value })} className="bg-zinc-900 border-white/10" />
          <Input placeholder="Course ID (optional)" value={f.course_id} onChange={(e) => setF({ ...f, course_id: e.target.value })} className="bg-zinc-900 border-white/10" />
          <div className="text-xs text-zinc-500">Questions JSON: [{`{"question":"...","options":["A","B","C","D"],"correct":0}`}]</div>
          <textarea rows={6} value={f.questions_text} onChange={(e) => setF({ ...f, questions_text: e.target.value })} className="w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm font-mono" />
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose} className="border-white/10">Cancel</Button><Button onClick={submit} className="bg-indigo-500 hover:bg-indigo-400" data-testid="quiz-save">Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ===== Payments ===== */
function PaymentsTab({ apiBase }) {
  const [rows, setRows] = useState([]);
  useEffect(() => { apiBase.get("/payments").then((r) => setRows(r.data || [])); }, [apiBase]);
  return (
    <div>
      <div className="mb-4 text-sm text-zinc-400">{rows.length} transactions · <span className="text-amber-300">view-only on free tier</span></div>
      <Table headers={["Session", "User", "Amount", "Status", "When"]}>
        {rows.map((p) => (
          <tr key={p.session_id || p.id} className="border-t border-white/5">
            <td className="px-4 py-2 text-xs font-mono text-zinc-500">{(p.session_id || "").slice(0, 16)}</td>
            <td className="px-4 py-2 text-xs">{p.email || p.user_id}</td>
            <td className="px-4 py-2 text-sm">${p.amount || 0}</td>
            <td className="px-4 py-2 text-xs"><span className={`px-2 py-0.5 rounded ${p.payment_status === "paid" ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-700 text-zinc-400"}`}>{p.payment_status || "pending"}</span></td>
            <td className="px-4 py-2 text-xs text-zinc-500">{(p.created_at || "").slice(0, 16)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

/* ===== Audit (SA only) ===== */
function AuditTab({ apiBase }) {
  const [rows, setRows] = useState([]);
  useEffect(() => { apiBase.get("/audit").then((r) => setRows(r.data || [])); }, [apiBase]);
  return (
    <Table headers={["Event", "Details", "When"]}>
      {rows.map((r, i) => (
        <tr key={`${r.at}-${i}`} className="border-t border-white/5">
          <td className="px-4 py-2 text-sm font-medium">{r.event}</td>
          <td className="px-4 py-2 text-xs text-zinc-400 font-mono">{Object.entries(r).filter(([k]) => !["event", "at"].includes(k)).map(([k, v]) => `${k}=${v}`).join(" · ")}</td>
          <td className="px-4 py-2 text-xs text-zinc-500">{r.at}</td>
        </tr>
      ))}
    </Table>
  );
}

/* ===== Generic UI ===== */
function Table({ headers, children }) {
  return (
    <div className="bg-zinc-900 border border-white/5 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[640px]">
          <thead className="bg-zinc-950/50">
            <tr>{headers.map((h) => <th key={h} className="px-4 py-2 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, testid }) {
  return <button onClick={onClick} data-testid={testid} className="p-1.5 hover:bg-zinc-800 rounded transition-colors mx-0.5">{children}</button>;
}

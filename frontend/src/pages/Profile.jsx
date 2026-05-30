import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Crown, User as UserIcon, Plus, ExternalLink, Award, Linkedin } from "lucide-react";
import { Link } from "react-router-dom";
import FileUpload, { fileUrl } from "@/components/FileUpload";

export default function Profile() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({ name: "", bio: "", avatar: "" });
  const [projects, setProjects] = useState([]);
  const [certs, setCerts] = useState([]);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (user) setForm({ name: user.name || "", bio: user.bio || "", avatar: user.avatar || "" });
    api.get(`/projects?user_id=${user?.id}`).then((r) => setProjects(r.data || []));
    api.get("/certificates/me").then((r) => setCerts(r.data || [])).catch(() => {});
  }, [user?.id]);

  const save = async () => {
    await api.put("/auth/me", form);
    await refresh();
    toast.success("Profile updated");
  };

  if (!user) return null;
  return (
    <div className="max-w-4xl mx-auto px-6 py-12" data-testid="profile-page">
      <div className="bg-zinc-900 border border-white/5 rounded-lg p-8 mb-6">
        <div className="flex items-center gap-6 mb-8">
          {form.avatar ? (
            <img src={form.avatar} alt="" className="h-20 w-20 rounded-lg object-cover" data-testid="profile-avatar-img" />
          ) : (
            <div className="h-20 w-20 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-2xl font-heading font-semibold">
              {user.name[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <h1 className="font-heading text-3xl font-semibold tracking-tight">{user.name}</h1>
            <div className="text-zinc-400 mt-1">{user.email}</div>
            <div className="flex items-center gap-2 mt-2">
              <Badge className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 capitalize">{user.role}</Badge>
              {user.is_premium && <Badge className="bg-amber-500/10 border border-amber-500/30 text-amber-300"><Crown className="h-3 w-3 mr-1" /> Premium</Badge>}
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Avatar</div>
            <FileUpload
              category="avatar"
              accept={{ "image/*": [".png", ".jpg", ".jpeg", ".webp"] }}
              currentUrl={form.avatar}
              hint="PNG, JPG, WEBP up to 5MB"
              testId="upload-avatar"
              onUploaded={(r) => setForm({ ...form, avatar: r?.full_url || "" })}
              maxMB={5}
            />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Display name</div>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-zinc-950 border-white/10" data-testid="profile-name" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Bio</div>
            <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} className="w-full p-3 bg-zinc-950 border border-white/10 rounded-md text-sm" data-testid="profile-bio" />
          </div>
          <Button onClick={save} className="bg-indigo-500 hover:bg-indigo-400" data-testid="profile-save">Save changes</Button>
        </div>
      </div>

      {user.role === "student" && (
        <div className="bg-zinc-900 border border-white/5 rounded-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-xl font-medium">Project Portfolio</h2>
            <Button size="sm" onClick={() => setShowAdd(true)} className="bg-indigo-500 hover:bg-indigo-400" data-testid="add-project-btn"><Plus className="h-4 w-4 mr-1" /> Add</Button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {projects.map((p) => (
              <div key={p.id} className="bg-zinc-950 border border-white/5 rounded-md p-5" data-testid={`project-${p.id}`}>
                {p.image_url && <img src={p.image_url} alt="" className="w-full aspect-video object-cover rounded mb-3" />}
                <div className="font-medium">{p.title}</div>
                <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{p.description}</p>
                <div className="flex gap-2 mt-3 text-xs">
                  {p.github_url && <a href={p.github_url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300">GitHub <ExternalLink className="inline h-3 w-3" /></a>}
                  {p.live_url && <a href={p.live_url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300">Live demo <ExternalLink className="inline h-3 w-3" /></a>}
                </div>
                {p.tech_stack.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {p.tech_stack.map((t) => <Badge key={t} className="bg-zinc-800 text-zinc-300 text-xs">{t}</Badge>)}
                  </div>
                )}
              </div>
            ))}
            {projects.length === 0 && <p className="text-zinc-500 col-span-full text-sm">No projects yet — add your first one to build your portfolio.</p>}
          </div>
        </div>
      )}

      {showAdd && <ProjectModal onClose={() => { setShowAdd(false); api.get(`/projects?user_id=${user.id}`).then((r) => setProjects(r.data || [])); }} />}

      {/* Certificates */}
      <div className="bg-zinc-900 border border-white/5 rounded-lg p-8 mt-6" data-testid="profile-certificates">
        <div className="flex items-center gap-3 mb-6">
          <Award className="h-5 w-5 text-amber-400" />
          <h2 className="font-heading text-xl font-semibold">Certificates</h2>
          <span className="text-xs text-zinc-500 ml-auto">{certs.length} earned</span>
        </div>
        {certs.length === 0 ? (
          <p className="text-zinc-500 text-sm">No certificates yet. Complete a course or score 70%+ on a quiz to earn one.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {certs.map((c) => {
              const certUrl = `${window.location.origin}/certificate/${c.id}`;
              const liUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(certUrl)}`;
              return (
                <div key={c.id} className="bg-zinc-950 border border-white/5 rounded-md p-4 flex flex-col gap-2" data-testid={`cert-card-${c.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold">{c.source_type === "quiz" ? "Quiz" : "Course"}</div>
                      <div className="font-medium truncate">{c.source_title}</div>
                      <div className="text-xs text-zinc-500 mt-0.5 font-mono">{c.credential_id}</div>
                    </div>
                    {c.score != null && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-xs font-semibold flex-shrink-0">{c.score}%</span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-1">
                    <Link to={`/certificate/${c.id}`} className="flex-1" data-testid={`cert-view-${c.id}`}>
                      <Button variant="outline" className="w-full h-9 border-white/10 hover:bg-white/5 text-xs">
                        View & Share
                      </Button>
                    </Link>
                    <a href={liUrl} target="_blank" rel="noreferrer" data-testid={`cert-li-${c.id}`}>
                      <Button className="h-9 bg-[#0a66c2] hover:bg-[#084e93] text-xs">
                        <Linkedin className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectModal({ onClose }) {
  const [form, setForm] = useState({ title: "", description: "", github_url: "", live_url: "", image_url: "", tech_stack: "" });
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-zinc-950 border border-white/10 rounded-lg w-full max-w-lg p-8 my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-heading text-2xl font-semibold mb-6">Add project</h2>
        <div className="space-y-3">
          <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="bg-zinc-900 border-white/10" data-testid="project-title" />
          <textarea placeholder="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full p-3 bg-zinc-900 border border-white/10 rounded-md text-sm" data-testid="project-desc" />
          <Input placeholder="GitHub URL" value={form.github_url} onChange={(e) => setForm({ ...form, github_url: e.target.value })} className="bg-zinc-900 border-white/10" />
          <Input placeholder="Live demo URL" value={form.live_url} onChange={(e) => setForm({ ...form, live_url: e.target.value })} className="bg-zinc-900 border-white/10" />
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Project image</div>
            <FileUpload
              category="project"
              accept={{ "image/*": [".png", ".jpg", ".jpeg", ".webp"] }}
              currentUrl={form.image_url}
              hint="Screenshot or hero image (PNG/JPG, max 5MB)"
              testId="upload-project-image"
              onUploaded={(r) => setForm({ ...form, image_url: r?.full_url || "" })}
              maxMB={5}
            />
          </div>
          <Input placeholder="Tech stack (comma-separated)" value={form.tech_stack} onChange={(e) => setForm({ ...form, tech_stack: e.target.value })} className="bg-zinc-900 border-white/10" />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={async () => {
            await api.post("/projects", { ...form, tech_stack: form.tech_stack.split(",").map((s) => s.trim()).filter(Boolean) });
            toast.success("Project added"); onClose();
          }} className="bg-indigo-500 hover:bg-indigo-400" data-testid="project-save">Add project</Button>
        </div>
      </div>
    </div>
  );
}

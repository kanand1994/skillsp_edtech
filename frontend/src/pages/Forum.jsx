import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageCircle, ChevronUp, Pin, Lock, CheckCircle2, Plus, Search, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import Markdown from "@/components/Markdown";

const CATEGORIES = ["General", "Q&A", "Announcements", "Showcase", "Help"];

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

export function Forum() {
  const [threads, setThreads] = useState([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("recent");
  const [showNew, setShowNew] = useState(false);
  const { user } = useAuth();
  const nav = useNavigate();

  const load = () => {
    const params = { sort };
    if (q) params.q = q;
    if (category !== "all") params.category = category;
    api.get("/forum", { params }).then((r) => setThreads(r.data || []));
  };
  useEffect(() => { load(); }, [q, category, sort]);

  return (
    <div className="max-w-[1300px] mx-auto px-6 sm:px-10 py-12" data-testid="forum-page">
      <div className="flex items-end justify-between gap-4 mb-10 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">/ Community</div>
          <h1 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tighter-x mt-3">Discussions</h1>
          <p className="text-zinc-400 mt-2">{threads.length} threads · ask questions, share wins, help peers.</p>
        </div>
        {user && (
          <Button onClick={() => setShowNew(true)} className="bg-indigo-500 hover:bg-indigo-400" data-testid="new-thread-btn">
            <Plus className="h-4 w-4 mr-1" /> New thread
          </Button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input data-testid="forum-search" placeholder="Search threads..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 bg-zinc-900 border-white/10" />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="md:w-44 bg-zinc-900 border-white/10" data-testid="forum-category"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-zinc-950 border-white/10">
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="md:w-40 bg-zinc-900 border-white/10" data-testid="forum-sort"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-zinc-950 border-white/10">
            <SelectItem value="recent">Recent</SelectItem>
            <SelectItem value="top">Top voted</SelectItem>
            <SelectItem value="unanswered">Unanswered</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {threads.length === 0 && <p className="text-zinc-500 text-center py-16">No threads found. Be the first to post.</p>}
        {threads.map((t) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 5 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} data-testid={`thread-${t.id}`}>
            <Link to={`/forum/${t.id}`} className="block bg-zinc-900 border border-white/5 rounded-lg p-5 hover:border-indigo-500/40 hover:bg-zinc-900/70 transition-all">
              <div className="flex gap-4">
                <div className="flex flex-col items-center justify-start gap-1 min-w-[44px]">
                  <div className="font-heading text-xl font-medium text-indigo-300">{t.upvotes}</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">votes</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {t.is_pinned && <Pin className="h-3 w-3 text-amber-400" />}
                    {t.is_locked && <Lock className="h-3 w-3 text-zinc-500" />}
                    <Badge variant="outline" className="border-white/10 text-zinc-400 text-[10px]">{t.category}</Badge>
                    {t.replies_count === 0 && <Badge className="bg-zinc-800 text-zinc-400 text-[10px]">Unanswered</Badge>}
                  </div>
                  <h3 className="font-heading text-lg font-medium line-clamp-1 hover:text-indigo-300 transition-colors">{t.title}</h3>
                  <p className="text-sm text-zinc-500 line-clamp-1 mt-1">{t.body}</p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
                    <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {t.replies_count}</span>
                    <span>{t.author_name} <Badge className="bg-zinc-800 text-zinc-400 text-[9px] ml-1 capitalize">{t.author_role}</Badge></span>
                    <span>· {timeAgo(t.last_activity_at)}</span>
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {showNew && <NewThreadModal onClose={(created) => { setShowNew(false); if (created) { load(); nav(`/forum/${created.id}`); } }} />}
    </div>
  );
}

function NewThreadModal({ onClose }) {
  const [form, setForm] = useState({ title: "", body: "", category: "General", tags: "" });
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/forum", {
        ...form, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      toast.success("Thread posted");
      onClose(data);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to post"));
    } finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => onClose()}>
      <div className="bg-zinc-950 border border-white/10 rounded-lg w-full max-w-2xl my-8 p-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-heading text-2xl font-semibold mb-6">Start a new discussion</h2>
        <div className="space-y-3">
          <Input data-testid="new-thread-title" placeholder="Title (be specific — like a question)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="bg-zinc-900 border-white/10" />
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger className="bg-zinc-900 border-white/10" data-testid="new-thread-category"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-zinc-950 border-white/10">
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <textarea data-testid="new-thread-body" placeholder="Share details — markdown supported (use ```python for code blocks)" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={8} className="w-full p-3 bg-zinc-900 border border-white/10 rounded-md text-sm font-mono" />
          {form.body && (
            <div className="bg-zinc-950 border border-white/5 rounded-md p-4 max-h-64 overflow-y-auto">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Preview</div>
              <Markdown>{form.body}</Markdown>
            </div>
          )}
          <Input placeholder="Tags (comma-separated)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="bg-zinc-900 border-white/10" />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={() => onClose()}>Cancel</Button>
          <Button onClick={submit} disabled={loading || !form.title || !form.body} className="bg-indigo-500 hover:bg-indigo-400" data-testid="new-thread-submit">
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Post
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ThreadDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [thread, setThread] = useState(null);
  const [replies, setReplies] = useState([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [t, r] = await Promise.all([
      api.get(`/forum/${id}`),
      api.get(`/forum/${id}/replies`),
    ]);
    setThread(t.data);
    setReplies(r.data || []);
  };
  useEffect(() => { load(); }, [id]);

  const vote = async (rid) => {
    if (rid) {
      await api.post(`/forum/replies/${rid}/vote`);
    } else {
      await api.post(`/forum/${id}/vote`);
    }
    load();
  };

  const post = async () => {
    if (!body.trim()) return;
    setLoading(true);
    try {
      await api.post(`/forum/${id}/replies`, { body });
      setBody("");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to reply"));
    } finally { setLoading(false); }
  };

  const accept = async (rid) => { await api.post(`/forum/replies/${rid}/accept`); load(); };

  if (!thread) return <div className="p-12 text-zinc-500">Loading…</div>;
  const isAuthor = user?.id === thread.author_id;

  return (
    <div className="max-w-[1000px] mx-auto px-6 py-12" data-testid="thread-detail">
      <Link to="/forum" className="text-sm text-zinc-500 hover:text-white">← Back to discussions</Link>
      <div className="mt-6 bg-zinc-900 border border-white/5 rounded-lg p-8">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {thread.is_pinned && <Badge className="bg-amber-500/10 border border-amber-500/30 text-amber-300"><Pin className="h-3 w-3 mr-1" /> Pinned</Badge>}
          {thread.is_locked && <Badge className="bg-zinc-800 text-zinc-400"><Lock className="h-3 w-3 mr-1" /> Locked</Badge>}
          <Badge variant="outline" className="border-white/10 text-zinc-400">{thread.category}</Badge>
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tighter-x">{thread.title}</h1>
        <div className="flex items-center gap-3 mt-4 text-sm text-zinc-400">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-xs font-semibold">{thread.author_name[0]}</div>
          <span>{thread.author_name}</span>
          <Badge className="bg-zinc-800 text-zinc-300 text-[10px] capitalize">{thread.author_role}</Badge>
          <span>· {timeAgo(thread.created_at)}</span>
        </div>
        <div className="mt-6 text-zinc-300 leading-relaxed">
          <Markdown>{thread.body}</Markdown>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => vote()} className="border-white/10" data-testid="thread-upvote">
            <ChevronUp className="h-4 w-4 mr-1" /> {thread.upvotes}
          </Button>
          <span className="text-xs text-zinc-500">{thread.replies_count} replies</span>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <h2 className="font-heading text-lg font-medium mb-2">Replies</h2>
        {replies.map((r) => (
          <div key={r.id} className={`bg-zinc-900 border rounded-lg p-6 ${r.is_accepted ? "border-emerald-500/40" : "border-white/5"}`} data-testid={`reply-${r.id}`}>
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center gap-1">
                <button onClick={() => vote(r.id)} className="text-zinc-400 hover:text-indigo-300" data-testid={`reply-upvote-${r.id}`}>
                  <ChevronUp className="h-5 w-5" />
                </button>
                <span className="text-sm font-medium">{r.upvotes}</span>
              </div>
              <div className="flex-1">
                {r.is_accepted && (
                  <div className="mb-2 flex items-center gap-1 text-emerald-400 text-xs font-medium">
                    <CheckCircle2 className="h-3 w-3" /> Accepted answer
                  </div>
                )}
                <div className="text-zinc-300 leading-relaxed">
                  <Markdown>{r.body}</Markdown>
                </div>
                <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="text-xs text-zinc-500 flex items-center gap-2">
                    <span>{r.author_name}</span>
                    <Badge className="bg-zinc-800 text-zinc-300 text-[9px] capitalize">{r.author_role}</Badge>
                    <span>· {timeAgo(r.created_at)}</span>
                  </div>
                  {isAuthor && !r.is_accepted && (
                    <button onClick={() => accept(r.id)} className="text-xs text-emerald-400 hover:text-emerald-300" data-testid={`accept-${r.id}`}>
                      Mark as accepted answer
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        {replies.length === 0 && <p className="text-zinc-500 text-sm">No replies yet — be the first to help.</p>}
      </div>

      {!thread.is_locked && user && (
        <div className="mt-8 bg-zinc-900 border border-white/5 rounded-lg p-6">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Write a reply..." className="w-full p-3 bg-zinc-950 border border-white/10 rounded-md text-sm font-mono" data-testid="reply-input" />
          <Button onClick={post} disabled={loading || !body.trim()} className="mt-3 bg-indigo-500 hover:bg-indigo-400" data-testid="reply-submit">
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Post reply
          </Button>
        </div>
      )}
    </div>
  );
}

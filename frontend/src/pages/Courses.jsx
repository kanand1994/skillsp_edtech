import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Star, Users, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/context/AuthContext";
import FileUpload from "@/components/FileUpload";

const FALLBACK_THUMB = "https://static.prod-images.emergentagent.com/jobs/dc290901-7081-495e-be3b-755453cb236d/images/e4af241411c508ddbfc4a9a29ad6e4cdf0b55c0984adaf621b7a026d6fef898e.png";

export default function Courses() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [level, setLevel] = useState("all");
  const [courses, setCourses] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    const params = {};
    if (q) params.q = q;
    if (category !== "all") params.category = category;
    if (level !== "all") params.level = level;
    const { data } = await api.get("/courses", { params });
    setCourses(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [q, category, level]);
  useEffect(() => { api.get("/courses/categories").then((r) => setCats(r.data.categories || [])); }, []);

  return (
    <div className="max-w-[1600px] mx-auto px-6 sm:px-10 py-12" data-testid="courses-page">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">/ Catalog</div>
          <h1 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tighter-x mt-3">
            All courses
          </h1>
          <p className="text-zinc-400 mt-2">Browse {courses.length} courses across {cats.length} categories.</p>
        </div>
        {user?.role === "trainer" && (
          <Button onClick={() => setShowCreate(true)} className="bg-indigo-500 hover:bg-indigo-400" data-testid="new-course-btn">
            + New course
          </Button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-10">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            data-testid="courses-search"
            placeholder="Search courses..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 bg-zinc-900 border-white/10"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="md:w-48 bg-zinc-900 border-white/10" data-testid="filter-category"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent className="bg-zinc-950 border-white/10">
            <SelectItem value="all">All categories</SelectItem>
            {cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className="md:w-40 bg-zinc-900 border-white/10" data-testid="filter-level"><SelectValue placeholder="Level" /></SelectTrigger>
          <SelectContent className="bg-zinc-950 border-white/10">
            <SelectItem value="all">All levels</SelectItem>
            <SelectItem value="Beginner">Beginner</SelectItem>
            <SelectItem value="Intermediate">Intermediate</SelectItem>
            <SelectItem value="Advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1,2,3,4,5,6].map((i) => <div key={i} className="bg-zinc-900 border border-white/5 rounded-lg h-72 shimmer" />)}
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-24 text-zinc-500" data-testid="courses-empty">No courses found. Try adjusting filters.</div>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {courses.map((c) => (
            <motion.div
              key={c.id}
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
              data-testid={`course-card-${c.id}`}
            >
              <Link to={`/courses/${c.id}`} className="block group">
                <div className="bg-zinc-900 border border-white/5 rounded-lg overflow-hidden hover:border-indigo-500/40 transition-all">
                  <div className="aspect-video overflow-hidden bg-zinc-800">
                    <img src={c.thumbnail || FALLBACK_THUMB} alt={c.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="border-white/10 text-zinc-400">{c.category}</Badge>
                      <Badge variant="outline" className="border-white/10 text-zinc-400">{c.level}</Badge>
                      {c.is_premium && <Badge className="bg-amber-500/10 border border-amber-500/30 text-amber-300">Premium</Badge>}
                    </div>
                    <h3 className="font-heading text-lg font-medium mb-1 line-clamp-2 group-hover:text-indigo-300 transition-colors">{c.title}</h3>
                    <p className="text-sm text-zinc-500 mb-4 line-clamp-2">{c.description}</p>
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-400" /> {c.rating.toFixed(1)}</span>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {c.students_count}</span>
                      </div>
                      <span className="text-white font-medium">{c.price > 0 ? `$${c.price}` : "Free"}</span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}

      {showCreate && <CourseCreateModal onClose={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function CourseCreateModal({ onClose }) {
  const [form, setForm] = useState({
    title: "", description: "", category: "Web Development", level: "Beginner",
    price: 0, thumbnail: "", tags: "", is_premium: false,
    lessons: [{ title: "", description: "", video_url: "", duration_min: 10, resource_url: "" }],
  });

  const submit = async () => {
    try {
      await api.post("/courses", {
        ...form,
        price: Number(form.price),
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      toast.success("Course created!");
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to create"));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-zinc-950 border border-white/10 rounded-lg w-full max-w-2xl my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-8">
          <h2 className="font-heading text-2xl font-semibold mb-6">Create new course</h2>
          <div className="space-y-4">
            <Input data-testid="course-form-title" placeholder="Course title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="bg-zinc-900 border-white/10" />
            <textarea placeholder="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full p-3 bg-zinc-900 border border-white/10 rounded-md text-sm" data-testid="course-form-description" />
            <div className="grid grid-cols-2 gap-3">
              <Input data-testid="course-form-category" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="bg-zinc-900 border-white/10" />
              <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                <SelectTrigger className="bg-zinc-900 border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-950 border-white/10">
                  <SelectItem value="Beginner">Beginner</SelectItem>
                  <SelectItem value="Intermediate">Intermediate</SelectItem>
                  <SelectItem value="Advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Price ($)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="bg-zinc-900 border-white/10" />
              <Input placeholder="Or paste thumbnail URL" value={form.thumbnail} onChange={(e) => setForm({ ...form, thumbnail: e.target.value })} className="bg-zinc-900 border-white/10" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Course thumbnail</div>
              <FileUpload
                category="thumbnail"
                accept={{ "image/*": [".png", ".jpg", ".jpeg", ".webp"] }}
                currentUrl={form.thumbnail}
                hint="16:9 image recommended, max 5MB"
                testId="upload-thumbnail"
                onUploaded={(r) => setForm({ ...form, thumbnail: r?.full_url || "" })}
                maxMB={5}
              />
            </div>
            <Input placeholder="Tags (comma-separated)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="bg-zinc-900 border-white/10" />

            <div className="text-xs uppercase tracking-wider text-zinc-500 mt-6 mb-2">Lessons</div>
            {form.lessons.map((l, i) => (
              <div key={i} className="bg-zinc-900 border border-white/5 rounded-md p-4 space-y-2">
                <Input placeholder={`Lesson ${i+1} title`} value={l.title} onChange={(e) => {
                  const arr = [...form.lessons]; arr[i].title = e.target.value; setForm({ ...form, lessons: arr });
                }} className="bg-zinc-950 border-white/10" />
                <Input placeholder="Video URL (YouTube/Vimeo or upload below)" value={l.video_url} onChange={(e) => {
                  const arr = [...form.lessons]; arr[i].video_url = e.target.value; setForm({ ...form, lessons: arr });
                }} className="bg-zinc-950 border-white/10" />
                <FileUpload
                  category="video"
                  accept={{ "video/*": [".mp4", ".webm", ".mov"] }}
                  currentUrl={l.video_url && /\/api\/uploads\//.test(l.video_url) ? l.video_url : ""}
                  hint="Or upload a video (mp4/webm, max 200MB)"
                  testId={`upload-lesson-video-${i}`}
                  onUploaded={(r) => {
                    const arr = [...form.lessons]; arr[i].video_url = r?.full_url || ""; setForm({ ...form, lessons: arr });
                  }}
                  maxMB={200}
                  small
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Duration (min)" type="number" value={l.duration_min} onChange={(e) => {
                    const arr = [...form.lessons]; arr[i].duration_min = Number(e.target.value); setForm({ ...form, lessons: arr });
                  }} className="bg-zinc-950 border-white/10" />
                  <Input placeholder="Resource URL" value={l.resource_url} onChange={(e) => {
                    const arr = [...form.lessons]; arr[i].resource_url = e.target.value; setForm({ ...form, lessons: arr });
                  }} className="bg-zinc-950 border-white/10" />
                </div>
              </div>
            ))}
            <Button variant="outline" className="border-white/10" onClick={() => setForm({ ...form, lessons: [...form.lessons, { title: "", description: "", video_url: "", duration_min: 10, resource_url: "" }] })}>
              + Add lesson
            </Button>
          </div>
          <div className="flex justify-end gap-3 mt-8">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} className="bg-indigo-500 hover:bg-indigo-400" data-testid="course-form-submit">Publish course</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

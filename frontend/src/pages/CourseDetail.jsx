import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Star, Users, Clock, Play, CheckCircle2, Lock, Award } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

const FALLBACK_THUMB = "https://static.prod-images.emergentagent.com/jobs/dc290901-7081-495e-be3b-755453cb236d/images/e4af241411c508ddbfc4a9a29ad6e4cdf0b55c0984adaf621b7a026d6fef898e.png";

export default function CourseDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [progress, setProgress] = useState({ enrolled: false, progress_pct: 0 });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [c, r] = await Promise.all([
      api.get(`/courses/${id}`),
      api.get(`/courses/${id}/reviews`),
    ]);
    setCourse(c.data);
    setReviews(r.data);
    if (user) {
      const p = await api.get(`/courses/${id}/progress`);
      setProgress(p.data);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id, user]);

  const enroll = async () => {
    if (!user) return nav("/login");
    try {
      if (course.is_premium && !user.is_premium && course.price > 0) {
        // Pay first
        const origin_url = window.location.origin;
        const { data } = await api.post("/payments/checkout", { course_id: id, origin_url });
        window.location.href = data.url;
        return;
      }
      await api.post(`/courses/${id}/enroll`);
      toast.success("Enrolled! Start learning now.");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Enrollment failed"));
    }
  };

  if (loading || !course) return <div className="p-12 text-zinc-500">Loading…</div>;

  return (
    <div className="max-w-[1400px] mx-auto px-6 sm:px-10 py-12" data-testid="course-detail">
      <div className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="outline" className="border-white/10 text-zinc-400">{course.category}</Badge>
            <Badge variant="outline" className="border-white/10 text-zinc-400">{course.level}</Badge>
            {course.is_premium && <Badge className="bg-amber-500/10 border border-amber-500/30 text-amber-300">Premium</Badge>}
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tighter-x mb-4" data-testid="course-title">{course.title}</h1>
          <p className="text-lg text-zinc-400 mb-6">{course.description}</p>
          <div className="flex items-center gap-6 text-sm text-zinc-400 mb-10">
            <span className="flex items-center gap-1"><Star className="h-4 w-4 text-amber-400" /> {course.rating.toFixed(1)} ({course.reviews_count})</span>
            <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {course.students_count} students</span>
            <span>by <Link to={`/profile/${course.trainer_id}`} className="text-indigo-400 hover:text-indigo-300">{course.trainer_name}</Link></span>
          </div>

          <div className="bg-zinc-900 border border-white/5 rounded-lg p-8" data-testid="course-curriculum">
            <h2 className="font-heading text-xl font-medium mb-6">Curriculum • {course.lessons.length} lessons</h2>
            <div className="space-y-2">
              {course.lessons.map((l, i) => {
                const completed = progress.completed_lessons?.includes(l.id);
                return (
                  <div key={l.id} className="flex items-center gap-4 p-4 rounded-md bg-zinc-950/50 hover:bg-zinc-950 transition-colors" data-testid={`lesson-row-${i}`}>
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-800 text-xs text-zinc-400">
                      {completed ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : (progress.enrolled ? <Play className="h-3 w-3 text-indigo-400" /> : <Lock className="h-3 w-3" />)}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{l.title}</div>
                      <div className="text-xs text-zinc-500">{l.duration_min} min{l.description ? ` • ${l.description}` : ""}</div>
                    </div>
                    {progress.enrolled && (
                      <Link to={`/learn/${course.id}/${l.id}`}>
                        <Button size="sm" variant="ghost" className="text-zinc-300">Open</Button>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-10 bg-zinc-900 border border-white/5 rounded-lg p-8">
            <h2 className="font-heading text-xl font-medium mb-6">Reviews ({reviews.length})</h2>
            <ReviewBlock course_id={course.id} canReview={progress.enrolled} reload={load} />
            <div className="mt-6 space-y-4">
              {reviews.map((r) => (
                <div key={r.id} className="border-b border-white/5 pb-4" data-testid={`review-${r.id}`}>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{r.user_name}</span>
                    <span className="flex items-center text-amber-400">
                      {Array.from({ length: r.rating }, (_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400 mt-1">{r.comment}</p>
                </div>
              ))}
              {reviews.length === 0 && <p className="text-sm text-zinc-500">Be the first to review.</p>}
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 self-start">
          <div className="bg-zinc-900 border border-white/5 rounded-lg overflow-hidden">
            <img src={course.thumbnail || FALLBACK_THUMB} alt="" className="w-full aspect-video object-cover" />
            <div className="p-6">
              <div className="font-heading text-3xl font-semibold mb-1">
                {course.price > 0 ? `$${course.price}` : "Free"}
              </div>
              {progress.enrolled ? (
                <>
                  <div className="text-xs text-zinc-500 mb-2">Your progress</div>
                  <div className="h-1.5 bg-zinc-800 rounded overflow-hidden mb-1">
                    <div className="h-full bg-indigo-500" style={{ width: `${progress.progress_pct}%` }} />
                  </div>
                  <div className="text-xs text-zinc-500 mb-4">{progress.progress_pct}% complete</div>
                  <Link to={`/learn/${course.id}/${course.lessons[0]?.id}`}>
                    <Button className="w-full bg-indigo-500 hover:bg-indigo-400" data-testid="continue-learning-btn">Continue learning</Button>
                  </Link>
                  {progress.progress_pct >= 100 && (
                    <Button variant="outline" className="w-full mt-2 border-white/10" onClick={async () => {
                      const { data } = await api.get(`/courses/${course.id}/certificate`);
                      toast.success(`Certificate ID: ${data.credential_id}`);
                    }} data-testid="get-certificate-btn">
                      <Award className="h-4 w-4 mr-2" /> Get certificate
                    </Button>
                  )}
                </>
              ) : (
                <Button onClick={enroll} className="w-full bg-indigo-500 hover:bg-indigo-400" data-testid="enroll-btn">
                  {course.is_premium && course.price > 0 ? "Buy & enroll" : "Enroll for free"}
                </Button>
              )}
              <div className="mt-6 space-y-3 text-sm">
                <div className="flex justify-between text-zinc-400"><span>Lessons</span><span className="text-white">{course.lessons.length}</span></div>
                <div className="flex justify-between text-zinc-400"><span>Total duration</span><span className="text-white">{course.lessons.reduce((s, l) => s + (l.duration_min || 0), 0)} min</span></div>
                <div className="flex justify-between text-zinc-400"><span>Level</span><span className="text-white">{course.level}</span></div>
                <div className="flex justify-between text-zinc-400"><span>Certificate</span><span className="text-white">Yes</span></div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ReviewBlock({ course_id, canReview, reload }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  if (!canReview) return <p className="text-sm text-zinc-500">Enroll in this course to leave a review.</p>;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {[1,2,3,4,5].map((n) => (
          <button key={n} onClick={() => setRating(n)} data-testid={`star-${n}`}>
            <Star className={`h-5 w-5 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-zinc-600"}`} />
          </button>
        ))}
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Share your thoughts..." className="w-full p-3 bg-zinc-950 border border-white/10 rounded-md text-sm" rows={3} data-testid="review-comment" />
      <Button onClick={async () => {
        await api.post(`/courses/${course_id}/reviews`, { rating, comment });
        setComment(""); toast.success("Review posted"); reload();
      }} className="bg-indigo-500 hover:bg-indigo-400 w-fit" data-testid="post-review-btn">Post review</Button>
    </div>
  );
}

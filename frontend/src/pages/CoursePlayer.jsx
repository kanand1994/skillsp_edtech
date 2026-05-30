import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronLeft, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function toEmbed(url) {
  if (!url) return "";
  try {
    if (url.includes("youtube.com/watch")) {
      const id = new URL(url).searchParams.get("v");
      return `https://www.youtube.com/embed/${id}`;
    }
    if (url.includes("youtu.be/")) {
      const id = url.split("youtu.be/")[1].split("?")[0];
      return `https://www.youtube.com/embed/${id}`;
    }
    return url;
  } catch { return url; }
}

function isDirectVideo(url) {
  if (!url) return false;
  return /\/api\/uploads\//.test(url) || /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(url);
}

export default function CoursePlayer() {
  const { courseId, lessonId } = useParams();
  const nav = useNavigate();
  const [course, setCourse] = useState(null);
  const [progress, setProgress] = useState({ completed_lessons: [], progress_pct: 0 });

  const load = async () => {
    const { data } = await api.get(`/courses/${courseId}`);
    setCourse(data);
    const p = await api.get(`/courses/${courseId}/progress`);
    setProgress(p.data);
  };

  useEffect(() => { load(); }, [courseId]);

  if (!course) return <div className="p-12 text-zinc-500">Loading…</div>;
  const lesson = course.lessons.find((l) => l.id === lessonId) || course.lessons[0];
  const idx = course.lessons.findIndex((l) => l.id === lesson.id);
  const nextLesson = course.lessons[idx + 1];

  const markComplete = async () => {
    const { data } = await api.post(`/courses/${courseId}/progress`, { lesson_id: lesson.id, completed: true });
    setProgress((p) => ({ ...p, ...data }));
    toast.success("Lesson marked complete");
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] grid grid-cols-1 lg:grid-cols-[1fr,360px] bg-black" data-testid="course-player">
      <div className="bg-black flex flex-col">
        <div className="aspect-video bg-black w-full">
          {lesson.video_url ? (
            isDirectVideo(lesson.video_url) ? (
              <video
                src={lesson.video_url}
                controls
                className="w-full h-full"
                data-testid="lesson-video"
              />
            ) : (
              <iframe
                src={toEmbed(lesson.video_url)}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={lesson.title}
                data-testid="lesson-video"
              />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600">No video for this lesson</div>
          )}
        </div>
        <div className="p-8 bg-zinc-950 flex-1">
          <Link to={`/courses/${courseId}`} className="text-sm text-zinc-500 hover:text-white flex items-center gap-1 mb-4">
            <ChevronLeft className="h-3 w-3" /> Back to course
          </Link>
          <h1 className="font-heading text-3xl font-semibold tracking-tight mb-2" data-testid="lesson-title">{lesson.title}</h1>
          <div className="text-sm text-zinc-500 mb-6">{lesson.duration_min} min • Lesson {idx + 1} of {course.lessons.length}</div>
          {lesson.description && <p className="text-zinc-300 leading-relaxed mb-6">{lesson.description}</p>}
          {lesson.resource_url && (
            <a href={lesson.resource_url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 text-sm">
              Download resources →
            </a>
          )}
          <div className="mt-10 flex gap-3">
            {!progress.completed_lessons?.includes(lesson.id) && (
              <Button onClick={markComplete} className="bg-indigo-500 hover:bg-indigo-400" data-testid="mark-complete-btn">
                <CheckCircle2 className="h-4 w-4 mr-2" /> Mark complete
              </Button>
            )}
            {nextLesson && (
              <Button variant="outline" onClick={() => nav(`/learn/${courseId}/${nextLesson.id}`)} className="border-white/10" data-testid="next-lesson-btn">
                Next lesson <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <aside className="bg-zinc-950 border-l border-white/5 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto">
        <div className="p-6 border-b border-white/5 sticky top-0 bg-zinc-950 z-10">
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">/ Curriculum</div>
          <div className="font-heading text-base font-medium line-clamp-2">{course.title}</div>
          <div className="mt-3 h-1 bg-zinc-800 rounded">
            <div className="h-full bg-indigo-500 rounded" style={{ width: `${progress.progress_pct}%` }} />
          </div>
          <div className="text-xs text-zinc-500 mt-2">{progress.progress_pct}% complete</div>
        </div>
        <div className="p-3 space-y-1">
          {course.lessons.map((l, i) => {
            const isActive = l.id === lesson.id;
            const isDone = progress.completed_lessons?.includes(l.id);
            return (
              <Link
                key={l.id}
                to={`/learn/${courseId}/${l.id}`}
                className={`flex items-center gap-3 p-3 rounded-md text-sm transition-colors ${isActive ? "bg-indigo-500/10 text-white border border-indigo-500/30" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"}`}
                data-testid={`sidebar-lesson-${i}`}
              >
                <div className="h-6 w-6 rounded-full flex items-center justify-center text-xs bg-zinc-800">
                  {isDone ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : i + 1}
                </div>
                <div className="flex-1 line-clamp-2">{l.title}</div>
              </Link>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Clock, Trophy, Award } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

export default function Quiz() {
  const { quizId } = useParams();
  const nav = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState(null);
  const [board, setBoard] = useState([]);

  useEffect(() => {
    api.get(`/quizzes/${quizId}`).then((r) => {
      setQuiz(r.data);
      setAnswers(new Array(r.data.questions.length).fill(-1));
      setTimeLeft(r.data.duration_min * 60);
    });
    api.get(`/quizzes/${quizId}/leaderboard`).then((r) => setBoard(r.data || []));
  }, [quizId]);

  // submit is referenced by the timer effect — keep stable via useRef-style ref pattern
  const submit = React.useCallback(async () => {
    if (result) return; // idempotent — only submit once
    try {
      const { data } = await api.post(`/quizzes/${quizId}/submit`, { answers });
      setResult(data);
      toast.success(`You scored ${data.score}%`);
      const lb = await api.get(`/quizzes/${quizId}/leaderboard`);
      setBoard(lb.data || []);
    } catch (err) { toast.error(getErrorMessage(err, "Failed")); }
  }, [quizId, answers, result]);

  useEffect(() => {
    if (!quiz || result) return;
    if (timeLeft <= 0) {
      submit();
      return; // don't schedule another tick once we've fired auto-submit
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, quiz, result, submit]);

  if (!quiz) return <div className="p-12 text-zinc-500">Loading…</div>;
  const fmt = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2, "0")}`;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12" data-testid="quiz-page">
      {!result ? (
        <>
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">/ Quiz</div>
              <h1 className="font-heading text-3xl font-semibold tracking-tight mt-2">{quiz.title}</h1>
              <p className="text-zinc-400 mt-1">{quiz.description}</p>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-zinc-500">Time left</div>
              <div className="font-mono text-2xl font-medium text-indigo-400 flex items-center gap-1"><Clock className="h-4 w-4" /> {fmt(timeLeft)}</div>
            </div>
          </div>

          <div className="space-y-6">
            {quiz.questions.map((q, i) => (
              <div key={q.id} className="bg-zinc-900 border border-white/5 rounded-lg p-6" data-testid={`question-${i}`}>
                <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Question {i + 1} of {quiz.questions.length}</div>
                <div className="font-medium mb-4">{q.question}</div>
                <div className="space-y-2">
                  {q.options.map((opt, oi) => (
                    <button
                      key={oi}
                      onClick={() => { const arr = [...answers]; arr[i] = oi; setAnswers(arr); }}
                      data-testid={`option-${i}-${oi}`}
                      className={`w-full text-left p-3 rounded-md text-sm transition-colors ${answers[i] === oi ? "bg-indigo-500/10 border border-indigo-500/40 text-white" : "bg-zinc-950 border border-white/5 hover:border-white/15"}`}
                    >
                      <span className="font-mono text-zinc-500 mr-2">{String.fromCharCode(65 + oi)}.</span> {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Button onClick={submit} className="mt-8 w-full bg-indigo-500 hover:bg-indigo-400 h-12" data-testid="quiz-submit">Submit quiz</Button>
        </>
      ) : (
        <div className="bg-zinc-900 border border-white/5 rounded-lg p-10 text-center" data-testid="quiz-result">
          <Trophy className="h-12 w-12 text-amber-400 mx-auto mb-6" />
          <h1 className="font-heading text-5xl font-semibold tracking-tighter-x">{result.score}%</h1>
          <p className="text-zinc-400 mt-2">{result.correct} / {result.total} correct</p>
          {result.certificate_id && (
            <Link to={`/certificate/${result.certificate_id}`} data-testid="quiz-view-cert">
              <Button className="mt-6 bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold h-11">
                <Award className="h-4 w-4 mr-2" />
                View your certificate
              </Button>
            </Link>
          )}
          <div className="mt-10">
            <h2 className="text-left font-heading text-lg font-medium mb-4">Leaderboard</h2>
            <div className="space-y-2 text-left">
              {board.slice(0, 10).map((b, i) => (
                <div key={b.id} className="flex items-center justify-between bg-zinc-950 border border-white/5 rounded-md p-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-zinc-500 w-6">#{i + 1}</span>
                    <span>{b.user_name}</span>
                  </div>
                  <span className="text-indigo-400 font-medium">{b.score}%</span>
                </div>
              ))}
            </div>
          </div>
          <Button onClick={() => nav(-1)} variant="outline" className="mt-8 border-white/10">Back</Button>
        </div>
      )}
    </div>
  );
}

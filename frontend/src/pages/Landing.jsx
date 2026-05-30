import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, BookOpen, Briefcase, Sparkles, Trophy, Zap, Users,
  Code2, MessageSquare, ShieldCheck, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const HERO_BG = "https://static.prod-images.emergentagent.com/jobs/dc290901-7081-495e-be3b-755453cb236d/images/d314e4623558e3d7f8d83b71fdfd9cf91d9e36ab0e88a3ab0ed88d616953660e.png";
const TECH_THUMB = "https://static.prod-images.emergentagent.com/jobs/dc290901-7081-495e-be3b-755453cb236d/images/e4af241411c508ddbfc4a9a29ad6e4cdf0b55c0984adaf621b7a026d6fef898e.png";
const BUSINESS_THUMB = "https://static.prod-images.emergentagent.com/jobs/dc290901-7081-495e-be3b-755453cb236d/images/ad8603bd9925e7fec9be69f311fead56b3477d8aca56ace2ebc01b137231e787.png";
const AI_AVATAR = "https://static.prod-images.emergentagent.com/jobs/dc290901-7081-495e-be3b-755453cb236d/images/6f3ca7d8bd03b634460a1e91176ae61516c0b1117a181e468cab58627129e4f8.png";

const fade = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const features = [
  { icon: BookOpen, title: "AI-curated courses", desc: "Hand-picked curricula with progress tracking, quizzes, and certificates." },
  { icon: Sparkles, title: "AI Assistant", desc: "Doubt solver, resume reviewer, roadmap planner — powered by GPT-5.2, Claude & Gemini." },
  { icon: Briefcase, title: "Job & internship portal", desc: "Apply with one click. Get matched to roles by recruiters across the network." },
  { icon: Trophy, title: "Quizzes & leaderboards", desc: "Timed assessments with real-time scoring and competitive leaderboards." },
  { icon: MessageSquare, title: "Realtime chat", desc: "Direct messaging with trainers, recruiters, and peers." },
  { icon: ShieldCheck, title: "Enterprise security", desc: "JWT auth, role-based access, audit logs, and encrypted secrets." },
];

const stats = [
  { v: "12K+", k: "Learners" },
  { v: "480+", k: "Courses" },
  { v: "1,200+", k: "Jobs posted" },
  { v: "94%", k: "Placement rate" },
];

export default function Landing() {
  return (
    <div data-testid="landing-page">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div
          className="absolute inset-0 opacity-30"
          style={{ backgroundImage: `url(${HERO_BG})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/40 via-zinc-950/80 to-zinc-950" />
        <div className="absolute inset-0 bg-grid opacity-40" />

        <div className="relative max-w-[1400px] mx-auto px-6 sm:px-10 pt-20 pb-28 md:pt-32 md:pb-40">
          <motion.div {...fade} transition={{ duration: 0.6 }} className="max-w-3xl">
            <Badge className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20" data-testid="hero-badge">
              <Sparkles className="h-3 w-3 mr-1" /> AI-powered learning + careers
            </Badge>
            <h1 className="mt-6 font-heading font-semibold text-5xl sm:text-6xl lg:text-7xl tracking-tighter-x leading-[1.05]">
              Learn the skills.<br />
              <span className="text-zinc-500">Land the job.</span><br />
              <span className="text-indigo-400">Built with AI.</span>
            </h1>
            <p className="mt-6 text-lg text-zinc-400 max-w-2xl leading-relaxed">
              SkillSphere is the all-in-one platform where students master industry-ready skills,
              trainers publish premium content, and recruiters hire top talent — all powered by
              fallback-chained AI across GPT-5.2, Claude Sonnet 4.5, and Gemini 3.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link to="/register" data-testid="hero-cta-primary">
                <Button size="lg" className="bg-indigo-500 hover:bg-indigo-400 text-white h-12 px-6">
                  Start learning free <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link to="/courses" data-testid="hero-cta-secondary">
                <Button size="lg" variant="outline" className="border-white/15 bg-zinc-900 hover:bg-zinc-800 text-white h-12 px-6">
                  Browse catalog
                </Button>
              </Link>
            </div>

            <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl">
              {stats.map((s) => (
                <div key={s.k} data-testid={`stat-${s.k.toLowerCase().replace(" ", "-")}`}>
                  <div className="font-heading text-3xl font-semibold tracking-tight">{s.v}</div>
                  <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mt-1">{s.k}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* FEATURES BENTO */}
      <section className="max-w-[1400px] mx-auto px-6 sm:px-10 py-24" id="features">
        <div className="flex items-end justify-between mb-12">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">/ Platform</div>
            <h2 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tighter-x mt-3">
              One platform. <span className="text-zinc-500">Five superpowers.</span>
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className={`group bg-zinc-900 border border-white/5 rounded-lg p-8 hover:bg-zinc-900/70 hover:border-indigo-500/30 transition-all ${i === 0 ? "md:row-span-2" : ""}`}
              data-testid={`feature-${f.title.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <f.icon className="h-7 w-7 text-indigo-400 mb-6" />
              <h3 className="font-heading text-xl font-medium mb-2">{f.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
              {i === 0 && (
                <div className="mt-8 grid grid-cols-2 gap-2">
                  <img src={TECH_THUMB} alt="" className="rounded-md border border-white/5" />
                  <img src={BUSINESS_THUMB} alt="" className="rounded-md border border-white/5" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* AI showcase */}
      <section className="border-t border-white/5 bg-zinc-950">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-10 py-24 grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">/ AI Assistant</div>
            <h2 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tighter-x mt-3">
              Your <span className="text-indigo-400">AI co-pilot</span> for every stage.
            </h2>
            <p className="mt-6 text-zinc-400 leading-relaxed">
              Solve doubts at 2am, get your resume reviewed, generate a 12-week roadmap,
              and rehearse interview questions. Backed by a three-provider fallback chain
              for 99.9% availability.
            </p>
            <ul className="mt-8 space-y-3">
              {["AI doubt solver", "Resume reviewer with ATS score", "12-week learning roadmaps", "Mock interview generator"].map((t) => (
                <li key={t} className="flex items-center gap-2 text-zinc-300">
                  <ChevronRight className="h-4 w-4 text-indigo-400" /> {t}
                </li>
              ))}
            </ul>
            <Link to="/register" className="inline-block mt-10">
              <Button className="bg-indigo-500 hover:bg-indigo-400">Try the AI Assistant</Button>
            </Link>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
            <div className="relative rounded-xl bg-zinc-900 border border-white/10 p-8 glow-indigo">
              <img src={AI_AVATAR} alt="" className="w-20 h-20 rounded-lg mb-4 object-cover" />
              <div className="font-mono text-xs text-zinc-500 mb-2">/skl ai &gt; doubt</div>
              <div className="font-heading text-lg text-white mb-3">Explain JWT authentication</div>
              <div className="space-y-2 text-sm text-zinc-300 leading-relaxed">
                <p>JWT (JSON Web Token) is a compact, URL-safe token format used for stateless auth. It has three parts: <code className="text-indigo-300">header.payload.signature</code>...</p>
              </div>
              <div className="mt-6 flex items-center justify-between text-xs text-zinc-500">
                <span className="font-mono">via gpt-5.2</span>
                <span>2.1s</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ROLES */}
      <section className="border-t border-white/5">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-10 py-24">
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">/ For everyone</div>
          <h2 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tighter-x mt-3 mb-12">
            Built for <span className="text-zinc-500">students, trainers,<br />recruiters</span> — and you.
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { role: "Student", icon: Users, points: ["Browse 480+ courses", "AI tutor + roadmap", "Apply to jobs", "Earn certificates"], to: "/register?role=student" },
              { role: "Trainer", icon: Code2, points: ["Publish premium courses", "Grade assignments", "Live student chat", "Revenue analytics"], to: "/register?role=trainer" },
              { role: "Recruiter", icon: Briefcase, points: ["Post jobs/internships", "Shortlist candidates", "Resume access", "Hiring analytics"], to: "/register?role=recruiter" },
            ].map((r) => (
              <Link
                key={r.role}
                to={r.to}
                data-testid={`role-card-${r.role.toLowerCase()}`}
                className="group bg-zinc-900 border border-white/5 rounded-lg p-8 hover:border-indigo-500/40 hover:bg-zinc-900/70 transition-all"
              >
                <r.icon className="h-6 w-6 text-indigo-400 mb-4" />
                <h3 className="font-heading text-2xl font-medium mb-4">{r.role}</h3>
                <ul className="space-y-2 mb-6">
                  {r.points.map((p) => (
                    <li key={p} className="text-sm text-zinc-400 flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-indigo-400" /> {p}
                    </li>
                  ))}
                </ul>
                <div className="text-sm text-indigo-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                  Get started <ArrowRight className="h-3 w-3" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="max-w-[1400px] mx-auto px-6 sm:px-10 py-32 text-center relative">
          <Zap className="h-10 w-10 mx-auto text-indigo-400 mb-6" />
          <h2 className="font-heading text-5xl sm:text-6xl font-semibold tracking-tighter-x">
            Ready to ship your career?
          </h2>
          <p className="mt-6 text-zinc-400 max-w-xl mx-auto">
            Join thousands of learners building real skills and getting hired.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link to="/register" data-testid="cta-register">
              <Button size="lg" className="bg-indigo-500 hover:bg-indigo-400 h-12 px-8">
                Create free account
              </Button>
            </Link>
            <Link to="/pricing" data-testid="cta-pricing">
              <Button size="lg" variant="outline" className="border-white/15 bg-zinc-900 hover:bg-zinc-800 h-12 px-8">
                See pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

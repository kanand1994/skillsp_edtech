import React, { useEffect, useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import {
  ShieldCheck, Linkedin, Copy, Check, Sparkles, Award,
  Calendar, BadgeCheck, Gift, ArrowRight, Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const THEMES = [
  { id: "dark",    label: "Modern Dark",     icon: Sparkles },
  { id: "classic", label: "Classic Academic", icon: Award },
  { id: "bold",    label: "Bold & Playful",   icon: BadgeCheck },
];

export default function Certificate() {
  const { id } = useParams();
  const [cert, setCert] = useState(null);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState("dark");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get(`/certificates/verify/${id}`)
      .then((r) => setCert(r.data))
      .catch((e) => setError(e?.response?.data?.detail || "Certificate not found"));
  }, [id]);

  const certUrl = `${window.location.origin}/certificate/${id}`;
  const referralUrl = useMemo(
    () => cert ? `${window.location.origin}/register?ref=${cert.referrer_code}` : "",
    [cert, id]
  );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(certUrl);
      setCopied(true);
      toast.success("Certificate link copied");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Copy failed");
    }
  };

  const shareLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(certUrl)}`;
    window.open(url, "_blank", "width=600,height=600,noopener,noreferrer");
  };

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6" data-testid="cert-error">
        <div className="text-center max-w-md">
          <div className="h-16 w-16 mx-auto rounded-full bg-rose-500/15 flex items-center justify-center mb-6">
            <ShieldCheck className="h-8 w-8 text-rose-400" />
          </div>
          <h1 className="font-heading text-3xl font-semibold mb-2">Certificate not found</h1>
          <p className="text-zinc-400 mb-8">{error}</p>
          <Link to="/"><Button className="bg-indigo-500 hover:bg-indigo-400">Go home</Button></Link>
        </div>
      </div>
    );
  }
  if (!cert) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center" data-testid="cert-loading">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === "classic" ? "bg-amber-50" : "bg-zinc-950"} text-white`} data-testid="cert-page">
      {/* Top bar */}
      <header className={`sticky top-0 z-40 border-b ${theme === "classic" ? "bg-amber-50/95 border-amber-900/20" : "bg-zinc-950/80 border-white/5"} backdrop-blur`}>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group" data-testid="cert-logo">
            <div className="h-7 w-7 rounded-md bg-indigo-500 flex items-center justify-center font-heading font-bold text-white text-sm">S</div>
            <span className={`font-heading font-semibold text-sm tracking-tight ${theme === "classic" ? "text-zinc-900" : "text-white"}`}>SkillSphere</span>
          </Link>
          <div className="flex items-center gap-1.5">
            {THEMES.map((t) => (
              <button
                key={t.id}
                data-testid={`cert-theme-${t.id}`}
                onClick={() => setTheme(t.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-all ${
                  theme === t.id
                    ? "bg-indigo-500 text-white"
                    : (theme === "classic" ? "text-zinc-700 hover:bg-amber-100" : "text-zinc-400 hover:bg-white/5")
                }`}
              >
                <t.icon className="h-3 w-3" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-10">
        {/* Verification banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className={`mb-6 flex items-center gap-3 px-4 py-2.5 rounded-lg ${
            theme === "classic"
              ? "bg-emerald-100 border border-emerald-300/60 text-emerald-900"
              : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
          }`}
          data-testid="cert-verified-banner"
        >
          <ShieldCheck className="h-5 w-5 flex-shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">Verified by SkillSphere</span>
            <span className={theme === "classic" ? "text-emerald-800" : "text-emerald-400/80"}> · Credential ID {cert.credential_id}</span>
          </div>
        </motion.div>

        {/* The certificate itself */}
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
          <CertificateBody cert={cert} theme={theme} certUrl={certUrl} />
        </motion.div>

        {/* Actions */}
        <div className="mt-8 grid md:grid-cols-2 gap-4">
          <Button
            onClick={shareLinkedIn}
            className="bg-[#0a66c2] hover:bg-[#084e93] h-12 text-base"
            data-testid="cert-share-linkedin"
          >
            <Linkedin className="h-5 w-5 mr-2" />
            Share on LinkedIn
          </Button>
          <Button
            onClick={copyLink}
            variant="outline"
            className={`h-12 text-base ${theme === "classic" ? "border-zinc-700 text-zinc-800 hover:bg-zinc-100" : "border-white/10 hover:bg-white/5 text-white"}`}
            data-testid="cert-copy-link"
          >
            {copied ? <Check className="h-5 w-5 mr-2 text-emerald-400" /> : <Copy className="h-5 w-5 mr-2" />}
            {copied ? "Copied!" : "Copy verification link"}
          </Button>
        </div>

        {/* Referral CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className={`mt-10 rounded-xl p-6 sm:p-8 ${
            theme === "classic"
              ? "bg-gradient-to-br from-amber-100 to-white border border-amber-900/20"
              : "bg-gradient-to-br from-indigo-500/10 via-zinc-900 to-fuchsia-500/10 border border-indigo-500/30"
          }`}
          data-testid="cert-referral-cta"
        >
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0 ${theme === "classic" ? "bg-amber-200" : "bg-indigo-500/20"}`}>
              <Gift className={`h-6 w-6 ${theme === "classic" ? "text-amber-700" : "text-indigo-300"}`} />
            </div>
            <div className="flex-1">
              <h3 className={`font-heading text-xl sm:text-2xl font-semibold tracking-tight ${theme === "classic" ? "text-zinc-900" : "text-white"}`}>
                Inspired by {cert.user_name.split(" ")[0]}'s achievement?
              </h3>
              <p className={`mt-1.5 text-sm ${theme === "classic" ? "text-zinc-700" : "text-zinc-400"}`}>
                Get <span className={`font-semibold ${theme === "classic" ? "text-zinc-900" : "text-white"}`}>10% off</span> your first SkillSphere course — start learning today and earn your own verifiable certificate.
              </p>
              <Link to={`/register?ref=${cert.referrer_code}`} data-testid="cert-referral-link">
                <Button className="mt-4 bg-indigo-500 hover:bg-indigo-400 h-11">
                  Claim my 10% off
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>

        <p className={`mt-10 text-center text-xs ${theme === "classic" ? "text-zinc-600" : "text-zinc-600"}`}>
          To verify authenticity, scan the QR code or visit <span className="font-mono">skillsphere.io/certificate/{cert.id.slice(0, 8)}…</span>
        </p>
      </div>
    </div>
  );
}

function CertificateBody({ cert, theme, certUrl }) {
  const date = new Date(cert.issued_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  if (theme === "classic") return <ClassicCert cert={cert} certUrl={certUrl} date={date} />;
  if (theme === "bold") return <BoldCert cert={cert} certUrl={certUrl} date={date} />;
  return <DarkCert cert={cert} certUrl={certUrl} date={date} />;
}

function DarkCert({ cert, certUrl, date }) {
  return (
    <div className="relative rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 border border-white/10 p-8 sm:p-14 overflow-hidden" data-testid="cert-body-dark">
      <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-indigo-500" />
      <div className="relative">
        <div className="flex items-start justify-between mb-12">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-indigo-400 font-semibold">Certificate of</div>
            <div className="font-heading text-3xl sm:text-5xl font-semibold tracking-tighter-x mt-1">{cert.source_type === "quiz" ? "Achievement" : "Completion"}</div>
          </div>
          <div className="hidden sm:block text-right">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Issued by</div>
            <div className="font-heading text-lg font-semibold mt-1">SkillSphere</div>
          </div>
        </div>
        <div className="text-zinc-500 text-sm">This certifies that</div>
        <div className="font-heading text-4xl sm:text-6xl font-semibold tracking-tighter-x mt-2 mb-6" data-testid="cert-name">
          {cert.user_name}
        </div>
        <div className="text-zinc-400 text-base sm:text-lg leading-relaxed max-w-2xl">
          has successfully {cert.source_type === "quiz" ? "achieved a passing score" : "completed all requirements"} for
          <div className="mt-3 text-white font-heading text-2xl sm:text-3xl font-semibold tracking-tight" data-testid="cert-title">
            {cert.source_title}
          </div>
          {cert.score != null && (
            <div className="mt-2 inline-block px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-300 text-sm font-semibold">
              Score: {cert.score}%
            </div>
          )}
        </div>
        {cert.skills?.length > 0 && (
          <div className="mt-8" data-testid="cert-skills">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Skills earned</div>
            <div className="flex flex-wrap gap-2">
              {cert.skills.map((s, i) => (
                <span key={i} className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-zinc-300">{s}</span>
              ))}
            </div>
          </div>
        )}
        <div className="mt-12 grid sm:grid-cols-3 gap-6 items-end">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Issued</div>
            <div className="text-sm text-white font-medium mt-1">{date}</div>
          </div>
          {cert.instructor_name && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Instructor</div>
              <div className="text-sm text-white font-medium mt-1 font-heading italic">{cert.instructor_name}</div>
              <div className="h-px bg-white/20 mt-1" />
            </div>
          )}
          <div className="flex sm:justify-end">
            <div className="bg-white p-2 rounded-md">
              <QRCodeSVG value={certUrl} size={88} level="M" />
            </div>
          </div>
        </div>
        <div className="absolute bottom-6 right-6 sm:bottom-14 sm:right-14 opacity-10 pointer-events-none">
          <ShieldCheck className="h-32 w-32 text-indigo-400" />
        </div>
      </div>
    </div>
  );
}

function ClassicCert({ cert, certUrl, date }) {
  return (
    <div className="relative rounded-md bg-gradient-to-br from-amber-50 to-white border-4 border-double border-amber-900/40 p-8 sm:p-14 text-zinc-900 overflow-hidden shadow-2xl" data-testid="cert-body-classic">
      <div className="absolute inset-2 border border-amber-900/20 rounded-sm pointer-events-none" />
      <div className="relative text-center">
        <div className="text-amber-800 text-xs uppercase tracking-[0.4em] font-serif">SkillSphere Academy</div>
        <h1 className="font-serif text-4xl sm:text-6xl font-bold mt-4 text-zinc-900" style={{ fontFamily: 'Georgia, serif' }}>
          Certificate of {cert.source_type === "quiz" ? "Achievement" : "Completion"}
        </h1>
        <div className="mt-2 text-amber-700 text-sm font-serif italic">This is to certify that</div>
        <div className="mt-6 font-serif text-4xl sm:text-5xl text-zinc-900 italic" style={{ fontFamily: 'Georgia, serif' }} data-testid="cert-name">
          {cert.user_name}
        </div>
        <div className="mt-1 mx-auto w-2/3 h-px bg-amber-900/30" />
        <div className="mt-6 max-w-2xl mx-auto text-zinc-700 text-base sm:text-lg font-serif leading-relaxed">
          has {cert.source_type === "quiz" ? "demonstrated mastery" : "successfully completed all coursework"} for
          <div className="mt-3 font-serif text-xl sm:text-2xl font-bold text-zinc-900" data-testid="cert-title">
            "{cert.source_title}"
          </div>
          {cert.score != null && (
            <div className="mt-2 text-amber-700 italic">with a passing score of {cert.score}%</div>
          )}
        </div>
        {cert.skills?.length > 0 && (
          <div className="mt-6" data-testid="cert-skills">
            <div className="text-[10px] uppercase tracking-[0.2em] text-amber-800 mb-2">Areas of Study</div>
            <div className="flex flex-wrap gap-2 justify-center">
              {cert.skills.map((s, i) => (
                <span key={i} className="px-3 py-0.5 rounded-full text-xs border border-amber-900/40 text-amber-900 bg-amber-50 font-serif">{s}</span>
              ))}
            </div>
          </div>
        )}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-around gap-6">
          <div className="text-center">
            <div className="font-serif italic text-zinc-800 text-lg">{cert.instructor_name || "SkillSphere Faculty"}</div>
            <div className="mt-1 w-40 h-px bg-amber-900/40 mx-auto" />
            <div className="mt-1 text-[10px] uppercase tracking-wider text-amber-800">Instructor</div>
          </div>
          <div className="bg-white p-1.5 border border-amber-900/20 rounded">
            <QRCodeSVG value={certUrl} size={80} level="M" />
          </div>
          <div className="text-center">
            <div className="font-serif italic text-zinc-800 text-lg">{date}</div>
            <div className="mt-1 w-40 h-px bg-amber-900/40 mx-auto" />
            <div className="mt-1 text-[10px] uppercase tracking-wider text-amber-800">Date of Issue</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BoldCert({ cert, certUrl, date }) {
  return (
    <div className="relative rounded-3xl bg-gradient-to-br from-fuchsia-500 via-indigo-600 to-cyan-500 p-1 overflow-hidden" data-testid="cert-body-bold">
      <div className="relative rounded-[20px] bg-zinc-950 p-8 sm:p-14 overflow-hidden">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur">
            <Award className="h-4 w-4 text-amber-300" />
            <span className="text-xs uppercase tracking-wider font-semibold">{cert.source_type === "quiz" ? "Quiz Champion" : "Course Graduate"}</span>
          </div>
          <h1 className="mt-6 font-heading text-5xl sm:text-7xl font-bold tracking-tighter-x leading-[0.9]" data-testid="cert-name">
            {cert.user_name.toUpperCase()}
          </h1>
          <div className="mt-4 text-zinc-300 text-base sm:text-lg">
            just crushed
          </div>
          <div className="mt-2 font-heading text-3xl sm:text-5xl font-semibold bg-gradient-to-r from-fuchsia-400 via-amber-300 to-cyan-400 bg-clip-text text-transparent" data-testid="cert-title">
            {cert.source_title}
          </div>
          {cert.score != null && (
            <div className="mt-4 inline-block px-4 py-2 rounded-full bg-amber-400 text-zinc-900 text-sm font-bold">
              🎯 {cert.score}% SCORE
            </div>
          )}
          {cert.skills?.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2" data-testid="cert-skills">
              {cert.skills.map((s, i) => (
                <span key={i} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20 border border-white/20 text-white">#{s}</span>
              ))}
            </div>
          )}
          <div className="mt-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-6 border-t border-white/10">
            <div>
              <div className="text-xs uppercase tracking-wider text-zinc-500">Awarded</div>
              <div className="font-heading text-lg font-semibold mt-0.5">{date}</div>
              {cert.instructor_name && (
                <div className="text-xs text-zinc-400 mt-1">by {cert.instructor_name}</div>
              )}
            </div>
            <div className="bg-white p-1.5 rounded-lg">
              <QRCodeSVG value={certUrl} size={72} level="M" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Loader2, Gift, Check as CheckIcon, X as XIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name}`);
      nav("/dashboard");
    } catch (err) {
      toast.error(getErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  return <AuthShell title="Welcome back" subtitle="Log in to continue your learning journey">
    <form onSubmit={submit} className="space-y-4" data-testid="login-form">
      <div>
        <Label htmlFor="email" className="text-xs uppercase tracking-wider text-zinc-500">Email</Label>
        <Input id="email" data-testid="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 bg-zinc-950 border-white/10 focus-visible:border-indigo-500" />
      </div>
      <div>
        <Label htmlFor="password" className="text-xs uppercase tracking-wider text-zinc-500">Password</Label>
        <Input id="password" data-testid="login-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 bg-zinc-950 border-white/10" />
      </div>
      <Button type="submit" data-testid="login-submit" className="w-full bg-indigo-500 hover:bg-indigo-400 h-11" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Log in
      </Button>
    </form>
    <p className="text-sm text-zinc-500 mt-6 text-center">
      No account? <Link to="/register" className="text-indigo-400 hover:text-indigo-300">Create one</Link>
    </p>
  </AuthShell>;
}

export function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const refFromUrl = (sp.get("ref") || "").trim().toUpperCase();
  const [form, setForm] = useState({
    name: "", email: "", password: "",
    role: sp.get("role") || "student", company_name: "",
    referral_code: refFromUrl,
  });
  const [loading, setLoading] = useState(false);
  const [refStatus, setRefStatus] = useState({ checked: false, valid: false, name: "", discount: 0 });

  // Validate referral code (live, debounced)
  useEffect(() => {
    const code = (form.referral_code || "").trim();
    if (code.length < 4) {
      setRefStatus({ checked: false, valid: false, name: "", discount: 0 });
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { data } = await api.post("/referrals/validate", { code });
        if (cancelled) return;
        setRefStatus({ checked: true, valid: !!data.valid, name: data.referrer_name || "", discount: data.referee_discount_pct || 0 });
      } catch {
        if (cancelled) return;
        setRefStatus({ checked: true, valid: false, name: "", discount: 0 });
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [form.referral_code]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      if (!payload.referral_code) delete payload.referral_code;
      const user = await register(payload);
      toast.success(`Welcome, ${user.name}!`);
      nav("/dashboard");
    } catch (err) {
      toast.error(getErrorMessage(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  return <AuthShell title="Create your account" subtitle="Join 12,000+ learners building real-world skills">
    <form onSubmit={submit} className="space-y-4" data-testid="register-form">
      <div>
        <Label className="text-xs uppercase tracking-wider text-zinc-500">I am a</Label>
        <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
          <SelectTrigger data-testid="register-role" className="mt-2 bg-zinc-950 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-950 border-white/10">
            <SelectItem value="student">Student</SelectItem>
            <SelectItem value="trainer">Trainer / Instructor</SelectItem>
            <SelectItem value="recruiter">Recruiter / Company</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-zinc-500">{form.role === "recruiter" ? "Your name" : "Full name"}</Label>
        <Input data-testid="register-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-2 bg-zinc-950 border-white/10" />
      </div>
      {form.role === "recruiter" && (
        <div>
          <Label className="text-xs uppercase tracking-wider text-zinc-500">Company name</Label>
          <Input data-testid="register-company" required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="mt-2 bg-zinc-950 border-white/10" />
        </div>
      )}
      <div>
        <Label className="text-xs uppercase tracking-wider text-zinc-500">Email</Label>
        <Input data-testid="register-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-2 bg-zinc-950 border-white/10" />
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-zinc-500">Password</Label>
        <Input data-testid="register-password" type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-2 bg-zinc-950 border-white/10" />
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-zinc-500 flex items-center gap-2">
          <Gift className="h-3 w-3 text-indigo-400" /> Referral code <span className="text-zinc-600 normal-case tracking-normal">(optional)</span>
        </Label>
        <Input
          data-testid="register-referral"
          placeholder="e.g. AB12CD34"
          value={form.referral_code}
          onChange={(e) => setForm({ ...form, referral_code: e.target.value.toUpperCase() })}
          className="mt-2 bg-zinc-950 border-white/10 font-mono uppercase"
        />
        {refStatus.checked && refStatus.valid && (
          <div data-testid="referral-valid" className="mt-2 flex items-start gap-2 text-xs text-emerald-400">
            <CheckIcon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>Referred by <span className="font-semibold">{refStatus.name}</span> — you'll get <span className="font-semibold">{refStatus.discount}% off</span> your first paid plan.</span>
          </div>
        )}
        {refStatus.checked && !refStatus.valid && (
          <div data-testid="referral-invalid" className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
            <XIcon className="h-3.5 w-3.5" /> Code not recognised — you can still sign up.
          </div>
        )}
      </div>
      <Button type="submit" data-testid="register-submit" className="w-full bg-indigo-500 hover:bg-indigo-400 h-11" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Create account
      </Button>
    </form>
    <p className="text-sm text-zinc-500 mt-6 text-center">
      Already have an account? <Link to="/login" className="text-indigo-400 hover:text-indigo-300">Log in</Link>
    </p>
  </AuthShell>;
}

function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] grid md:grid-cols-2">
      <div className="hidden md:flex relative bg-zinc-950 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-fuchsia-500/10" />
        <div className="relative m-auto p-12 max-w-md">
          <Sparkles className="h-10 w-10 text-indigo-400 mb-6" />
          <h2 className="font-heading text-4xl font-semibold tracking-tighter-x">
            Learn, build,<br />get hired.
          </h2>
          <p className="text-zinc-400 mt-4">
            Join SkillSphere — the AI-powered learning & job platform trusted by thousands of students worldwide.
          </p>
        </div>
      </div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-zinc-400 mt-2 mb-8">{subtitle}</p>
          {children}
        </div>
      </motion.div>
    </div>
  );
}

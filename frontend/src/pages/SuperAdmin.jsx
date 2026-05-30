/**
 * Hidden SuperAdmin console.
 * Access via /private/internal/<SUPERADMIN_ROUTE> after 3-factor login.
 * Token + secret are kept in sessionStorage (cleared on close).
 */
import React, { useState, useMemo } from "react";
import axios from "axios";
import { ShieldCheck, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import AdminConsole from "@/components/AdminConsole";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
// The slug is read from the URL the user is currently on — never hardcoded in source.
// This means the slug only lives in backend `.env` (server-side) and the user's bookmark.
function getRouteSlug() {
  const m = window.location.pathname.match(/^\/private\/internal\/([^/]+)/);
  return m ? m[1] : "";
}

export default function SuperAdmin() {
  const [token, setToken] = useState(sessionStorage.getItem("sa_tok") || "");
  const [secret, setSecret] = useState(sessionStorage.getItem("sa_sec") || "");
  const [auth, setAuth] = useState({ email: "", password: "", secret: "" });

  const apiBase = useMemo(() => {
    if (!token) return null;
    return axios.create({
      baseURL: BASE,
      headers: { "X-SuperAdmin-Secret": secret, "X-SuperAdmin-Token": token },
    });
  }, [token, secret]);

  const login = async () => {
    try {
      const { data } = await axios.post(`${BASE}/auth`, auth);
      setToken(data.token); setSecret(auth.secret);
      sessionStorage.setItem("sa_tok", data.token);
      sessionStorage.setItem("sa_sec", auth.secret);
      toast.success("SuperAdmin access granted");
    } catch { toast.error("Access denied"); }
  };

  const logout = () => {
    sessionStorage.removeItem("sa_tok"); sessionStorage.removeItem("sa_sec");
    setToken(""); setSecret("");
    toast.success("Signed out");
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4" data-testid="sa-login-page">
        <div className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-lg p-8">
          <div className="flex items-center gap-2 mb-6">
            <ShieldCheck className="h-5 w-5 text-red-400" />
            <h1 className="font-mono text-sm uppercase tracking-wider text-red-400">Restricted Access</h1>
          </div>
          <div className="space-y-3">
            <Input data-testid="sa-email" placeholder="Email" value={auth.email} onChange={(e) => setAuth({ ...auth, email: e.target.value })} className="bg-black border-white/10" />
            <Input data-testid="sa-password" type="password" placeholder="Password" value={auth.password} onChange={(e) => setAuth({ ...auth, password: e.target.value })} className="bg-black border-white/10" />
            <Input data-testid="sa-secret" type="password" placeholder="Secret" value={auth.secret} onChange={(e) => setAuth({ ...auth, secret: e.target.value })} className="bg-black border-white/10" />
            <Button onClick={login} data-testid="sa-login-btn" className="w-full bg-red-500 hover:bg-red-400">Authenticate</Button>
          </div>
          <div className="mt-6 text-xs text-zinc-600 text-center">Unauthorized access attempts are logged and audited.</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-red-500/5 border-b border-red-500/20 px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-red-300"><ShieldCheck className="h-3.5 w-3.5" /> SuperAdmin Session · Audit-logged</div>
        <button onClick={logout} className="text-xs text-zinc-400 hover:text-white inline-flex items-center gap-1" data-testid="sa-logout"><LogOut className="h-3 w-3" /> Sign out</button>
      </div>
      <AdminConsole
        apiBase={apiBase}
        canCreate={{ users: true, courses: true, jobs: true, threads: true, challenges: true, quizzes: true }}
        title="SuperAdmin Control"
        subtitle="Full platform power — every action audited"
        accent="red"
        showAudit
      />
    </div>
  );
}

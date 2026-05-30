import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Check, Crown, Sparkles, Loader2, Gift } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

const FEATURES_BASE = ["3 free courses", "Basic AI assistant (50 msgs/mo)", "Apply to up to 10 jobs", "Standard chat", "Community access"];
const FEATURES_PRO = ["All courses (unlimited)", "Unlimited AI assistant", "Unlimited job applications", "Priority chat with recruiters", "Resume reviewer + roadmap", "Certificates", "Priority support"];

export function Pricing() {
  const [packages, setPackages] = useState([]);
  const { user } = useAuth();
  const nav = useNavigate();
  const [loading, setLoading] = useState("");
  const [discountPct, setDiscountPct] = useState(0);

  useEffect(() => { api.get("/payments/packages").then((r) => setPackages(r.data || [])); }, []);
  useEffect(() => {
    if (!user) return;
    api.get("/referrals/me").then((r) => setDiscountPct(r.data?.my_discount_pct || 0)).catch(() => {});
  }, [user]);

  const buy = async (pkgId) => {
    if (!user) return nav("/login");
    setLoading(pkgId);
    try {
      const { data } = await api.post("/payments/checkout", { package_id: pkgId, origin_url: window.location.origin });
      window.location.href = data.url;
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed"));
      setLoading("");
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 sm:px-10 py-20" data-testid="pricing-page">
      <div className="text-center mb-16">
        <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">/ Pricing</div>
        <h1 className="font-heading text-5xl sm:text-6xl font-semibold tracking-tighter-x mt-3">
          Simple, transparent pricing.
        </h1>
        <p className="text-zinc-400 mt-4 max-w-2xl mx-auto">
          Start for free. Upgrade when you're ready to unlock the full power of SkillSphere.
        </p>
      </div>

      {discountPct > 0 && !user?.is_premium && (
        <div data-testid="referral-discount-banner" className="max-w-2xl mx-auto mb-10 px-5 py-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
          <Gift className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          <div className="text-sm">
            <span className="text-emerald-300 font-semibold">{discountPct}% referral discount</span>
            <span className="text-zinc-300"> active — automatically applied to your first paid checkout.</span>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <PricingCard tier="Free" price="$0" period="forever" features={FEATURES_BASE} highlighted={false} cta="Current plan" disabled />
        {packages.map((p) => {
          const isPopular = p.id === "premium_yearly";
          const periodMap = { premium_monthly: "month", premium_yearly: "year", premium_lifetime: "one-time" };
          return (
            <PricingCard
              key={p.id}
              tier={p.name}
              price={`$${p.amount.toFixed(0)}`}
              period={periodMap[p.id]}
              features={FEATURES_PRO}
              highlighted={isPopular}
              cta={user?.is_premium ? "Already premium" : "Upgrade now"}
              disabled={user?.is_premium}
              onClick={() => buy(p.id)}
              loading={loading === p.id}
              testid={`pricing-${p.id}`}
            />
          );
        })}
      </div>

      <div className="mt-20 text-center">
        <p className="text-zinc-500 text-sm">Powered by Stripe • Secure checkout • Cancel anytime</p>
      </div>
    </div>
  );
}

function PricingCard({ tier, price, period, features, highlighted, cta, disabled, onClick, loading, testid }) {
  return (
    <div data-testid={testid} className={`relative rounded-lg p-8 ${highlighted ? "bg-indigo-500/5 border border-indigo-500/40 glow-indigo" : "bg-zinc-900 border border-white/5"}`}>
      {highlighted && <div className="absolute -top-3 left-8 px-2 py-0.5 bg-indigo-500 text-white text-[10px] uppercase tracking-wider font-medium rounded">Best value</div>}
      <div className="flex items-center gap-2 mb-1">
        {highlighted && <Crown className="h-4 w-4 text-amber-400" />}
        <div className="text-xs uppercase tracking-wider text-zinc-500">{tier}</div>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="font-heading text-4xl font-semibold tracking-tighter-x">{price}</span>
        <span className="text-zinc-500 text-sm">/ {period}</span>
      </div>
      <ul className="mt-8 space-y-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className="h-4 w-4 text-indigo-400 mt-0.5 flex-shrink-0" />
            <span className="text-zinc-300">{f}</span>
          </li>
        ))}
      </ul>
      <Button
        onClick={onClick}
        disabled={disabled || loading}
        className={`w-full mt-8 ${highlighted ? "bg-indigo-500 hover:bg-indigo-400" : "bg-zinc-800 hover:bg-zinc-700"}`}
        data-testid={`${testid}-cta`}
      >
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {cta}
      </Button>
    </div>
  );
}

export function PaymentReturn() {
  const [sp] = useSearchParams();
  const sid = sp.get("session_id");
  const [status, setStatus] = useState("pending");
  const [attempts, setAttempts] = useState(0);
  const { refresh } = useAuth();

  useEffect(() => {
    if (!sid) { setStatus("error"); return; }
    const poll = async (n = 0) => {
      if (n > 7) { setStatus("timeout"); return; }
      try {
        const { data } = await api.get(`/payments/status/${sid}`);
        if (data.payment_status === "paid") {
          setStatus("paid"); refresh(); return;
        }
        if (data.status === "expired") { setStatus("expired"); return; }
        setAttempts(n);
        setTimeout(() => poll(n + 1), 2000);
      } catch (err) { setStatus("error"); }
    };
    poll(0);
  }, [sid]);

  return (
    <div className="max-w-md mx-auto px-6 py-32 text-center" data-testid="payment-return">
      {status === "pending" && (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-indigo-400 mx-auto mb-6" />
          <h1 className="font-heading text-3xl font-semibold mb-2">Confirming payment…</h1>
          <p className="text-zinc-400">Hang tight. (Check {attempts + 1}/8)</p>
        </>
      )}
      {status === "paid" && (
        <>
          <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/15 flex items-center justify-center mb-6">
            <Check className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="font-heading text-3xl font-semibold mb-2">Payment successful!</h1>
          <p className="text-zinc-400 mb-8">You now have access to all premium features.</p>
          <Link to="/dashboard"><Button className="bg-indigo-500 hover:bg-indigo-400">Go to dashboard</Button></Link>
        </>
      )}
      {(status === "expired" || status === "error" || status === "timeout") && (
        <>
          <h1 className="font-heading text-3xl font-semibold mb-2">Payment {status}</h1>
          <p className="text-zinc-400 mb-8">Something went wrong. Please try again.</p>
          <Link to="/pricing"><Button variant="outline" className="border-white/10">Back to pricing</Button></Link>
        </>
      )}
    </div>
  );
}

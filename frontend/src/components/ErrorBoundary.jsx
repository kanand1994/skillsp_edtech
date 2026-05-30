import React from "react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(err) {
    return { hasError: true, message: getErrorMessage(err) };
  }

  componentDidCatch(err, info) {
    // log but don't crash
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", err, info);
  }

  reset = () => this.setState({ hasError: false, message: "" });

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-6 text-zinc-200">
          <div className="max-w-md w-full bg-zinc-900 border border-white/5 rounded-lg p-8 text-center">
            <div className="font-heading text-2xl font-semibold mb-2">Something broke.</div>
            <p className="text-zinc-400 text-sm mb-6 break-words">{this.state.message}</p>
            <button onClick={() => { this.reset(); window.location.assign("/"); }} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-md text-sm">
              Reload home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Global handlers — translate any unhandled rejection / error to a toast, never to "[object Object]".
if (typeof window !== "undefined") {
  // Use capture phase + stopImmediatePropagation so we run BEFORE the
  // webpack-dev-server / react-error-overlay listeners and prevent the red
  // dev overlay from ever rendering for handled (e.g. 401) rejections.
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    // Skip already-handled (e.g., 401s the axios interceptor redirected on)
    if (reason && reason.__handled) {
      e.preventDefault();
      e.stopImmediatePropagation?.();
      return;
    }
    const msg = getErrorMessage(reason);
    // Suppress noisy network aborts and known benign messages
    if (/canceled|aborted|Network Error|Request failed with status code 401|TOKEN_EXPIRED|Signature has expired|Invalid token/i.test(msg)) {
      e.preventDefault();
      e.stopImmediatePropagation?.();
      return;
    }
    e.preventDefault(); // also keep the dev red-overlay from popping in dev mode
    e.stopImmediatePropagation?.();
    toast.error(msg);
  }, true);
  window.addEventListener("error", (e) => {
    // ResizeObserver loop benign warning
    if (e?.message?.includes?.("ResizeObserver")) { e.preventDefault?.(); e.stopImmediatePropagation?.(); return; }
    const src = e?.error || e?.message;
    if (src && src.__handled) { e.preventDefault?.(); e.stopImmediatePropagation?.(); return; }
    const msg = getErrorMessage(src);
    if (msg && msg !== "Something went wrong") toast.error(msg);
  }, true);
}

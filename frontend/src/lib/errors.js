/**
 * Safely extract a human-readable error message from any thrown value
 * (axios error, pydantic validation array, plain Error, string).
 */
export function getErrorMessage(err, fallback = "Something went wrong") {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  const detail = err?.response?.data?.detail ?? err?.detail ?? err?.message;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  // Pydantic validation: array of { loc, msg, type, ... }
  if (Array.isArray(detail)) {
    const first = detail[0];
    if (!first) return fallback;
    if (typeof first === "string") return first;
    if (first.msg) {
      const loc = Array.isArray(first.loc) ? first.loc.slice(-1)[0] : "";
      return loc ? `${loc}: ${first.msg}` : first.msg;
    }
    try { return JSON.stringify(detail); } catch { return fallback; }
  }
  if (typeof detail === "object") {
    if (detail.msg) return detail.msg;
    try { return JSON.stringify(detail); } catch { return fallback; }
  }
  return fallback;
}

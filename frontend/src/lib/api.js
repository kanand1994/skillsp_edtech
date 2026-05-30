import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("skl_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

let _redirecting = false;

function _handleExpiry() {
  if (_redirecting) return;
  _redirecting = true;
  localStorage.removeItem("skl_token");
  localStorage.removeItem("skl_user");
  // Avoid redirect when already on a public route
  const path = window.location.pathname;
  const isPublic = ["/", "/login", "/register", "/courses", "/jobs", "/pricing", "/forum"].some(
    (p) => path === p || path.startsWith(p + "/")
  );
  if (isPublic) { _redirecting = false; return; }
  // Soft notify (lazy import to avoid circular)
  import("sonner").then(({ toast }) => {
    toast.error("Your session expired. Please log in again.");
  }).catch(() => {});
  setTimeout(() => {
    _redirecting = false;
    window.location.assign("/login");
  }, 600);
}

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      _handleExpiry();
      // Mark this rejection as "handled" so global handlers skip toast spam
      err.__handled = true;
    }
    return Promise.reject(err);
  }
);

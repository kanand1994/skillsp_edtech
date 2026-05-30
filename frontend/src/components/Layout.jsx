import React, { useEffect, useState } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, BookOpen, Briefcase, Sparkles, MessageSquare,
  Bell, LogOut, Menu, X, ChevronDown, User, Crown, Settings, Code2,
  Users as UsersIcon, Wand2, Trophy, Gift,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const navByRole = {
  student: [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/courses", icon: BookOpen, label: "Courses" },
    { to: "/coding", icon: Code2, label: "Coding" },
    { to: "/jobs", icon: Briefcase, label: "Jobs" },
    { to: "/forum", icon: UsersIcon, label: "Forum" },
    { to: "/ai", icon: Sparkles, label: "AI" },
    { to: "/badges", icon: Trophy, label: "Badges" },
    { to: "/refer", icon: Gift, label: "Refer" },
    { to: "/chat", icon: MessageSquare, label: "Chat" },
  ],
  trainer: [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/courses", icon: BookOpen, label: "Courses" },
    { to: "/coding", icon: Code2, label: "Coding" },
    { to: "/ai-quiz", icon: Wand2, label: "AI Quiz" },
    { to: "/forum", icon: UsersIcon, label: "Forum" },
    { to: "/ai", icon: Sparkles, label: "AI" },
    { to: "/refer", icon: Gift, label: "Refer" },
    { to: "/chat", icon: MessageSquare, label: "Chat" },
  ],
  recruiter: [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/jobs", icon: Briefcase, label: "Jobs" },
    { to: "/forum", icon: UsersIcon, label: "Forum" },
    { to: "/ai", icon: Sparkles, label: "AI Assistant" },
    { to: "/refer", icon: Gift, label: "Refer" },
    { to: "/chat", icon: MessageSquare, label: "Chat" },
  ],
  admin: [
    { to: "/dashboard", icon: LayoutDashboard, label: "Admin" },
    { to: "/courses", icon: BookOpen, label: "Courses" },
    { to: "/jobs", icon: Briefcase, label: "Jobs" },
    { to: "/forum", icon: UsersIcon, label: "Forum" },
  ],
};

function NotificationsBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  const load = () => api.get("/notifications").then((r) => setItems(r.data || [])).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  const unread = items.filter((i) => !i.read).length;
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="notifications-bell"
          className="relative p-2 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-indigo-500" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-zinc-950 border-white/10">
        <DropdownMenuLabel className="flex justify-between">
          <span>Notifications</span>
          {unread > 0 && (
            <button
              data-testid="mark-all-read"
              className="text-xs text-indigo-400 hover:text-indigo-300"
              onClick={async () => { await api.post("/notifications/read-all"); load(); }}
            >Mark all read</button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-zinc-500">No notifications yet</div>
          )}
          {items.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className={`flex-col items-start gap-1 cursor-default ${!n.read ? "bg-indigo-500/5" : ""}`}
            >
              <div className="text-sm font-medium text-white">{n.title}</div>
              <div className="text-xs text-zinc-400 line-clamp-2">{n.body}</div>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = navByRole[user?.role] || [];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="glass sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" data-testid="logo-link" className="flex items-center gap-2 group">
              <div className="h-8 w-8 rounded-md bg-indigo-500 flex items-center justify-center font-heading font-bold text-white group-hover:bg-indigo-400 transition-colors">
                S
              </div>
              <span className="font-heading font-semibold text-lg tracking-tight">SkillSphere</span>
            </Link>
            {user && (
              <nav className="hidden md:flex items-center gap-1">
                {nav.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    data-testid={`nav-${n.label.toLowerCase().replace(" ", "-")}`}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                        isActive ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                      }`
                    }
                  >
                    <n.icon className="h-3.5 w-3.5" />
                    {n.label}
                  </NavLink>
                ))}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!user ? (
              <>
                <Link to="/pricing" className="hidden sm:inline-block text-sm text-zinc-400 hover:text-white px-3 py-1.5">Pricing</Link>
                <Link to="/login" data-testid="header-login-btn">
                  <Button variant="ghost" className="text-zinc-300 hover:bg-zinc-800 hover:text-white">Log in</Button>
                </Link>
                <Link to="/register" data-testid="header-register-btn">
                  <Button className="bg-indigo-500 hover:bg-indigo-400 text-white">Get started</Button>
                </Link>
              </>
            ) : (
              <>
                <NotificationsBell />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button data-testid="user-menu-btn" className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-zinc-800 text-zinc-300">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-xs font-semibold">
                        {user.name?.[0]?.toUpperCase() || "U"}
                      </div>
                      <span className="hidden sm:inline text-sm">{user.name}</span>
                      <ChevronDown className="h-3 w-3 text-zinc-500" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-zinc-950 border-white/10">
                    <DropdownMenuLabel>
                      <div className="text-sm font-medium">{user.name}</div>
                      <div className="text-xs text-zinc-500">{user.email}</div>
                      <div className="text-[10px] uppercase tracking-wider text-indigo-400 mt-1">{user.role}</div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/profile")} data-testid="menu-profile">
                      <User className="h-4 w-4 mr-2" /> Profile
                    </DropdownMenuItem>
                    {!user.is_premium && (
                      <DropdownMenuItem onClick={() => navigate("/pricing")} data-testid="menu-upgrade">
                        <Crown className="h-4 w-4 mr-2 text-amber-400" /> Upgrade to Premium
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { logout(); navigate("/"); }} data-testid="menu-logout">
                      <LogOut className="h-4 w-4 mr-2" /> Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <button
                  onClick={() => setMobileOpen(!mobileOpen)}
                  className="md:hidden p-2 rounded-md hover:bg-zinc-800 text-zinc-400"
                  data-testid="mobile-menu-btn"
                >
                  {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile nav drawer */}
        <AnimatePresence>
          {mobileOpen && user && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t border-white/5 overflow-hidden"
            >
              <div className="p-3 flex flex-col">
                {nav.map((n) => (
                  <Link
                    key={n.to}
                    to={n.to}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-zinc-300 hover:bg-zinc-900"
                  >
                    <n.icon className="h-4 w-4" />
                    {n.label}
                  </Link>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main key={loc.pathname}>{children}</main>

      <footer className="border-t border-white/5 mt-20">
        <div className="max-w-[1600px] mx-auto px-8 py-10 text-sm text-zinc-500 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>© 2026 SkillSphere — Learn, build, get hired.</div>
          <div className="flex items-center gap-6">
            <Link to="/courses" className="hover:text-white">Courses</Link>
            <Link to="/jobs" className="hover:text-white">Jobs</Link>
            <Link to="/pricing" className="hover:text-white">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

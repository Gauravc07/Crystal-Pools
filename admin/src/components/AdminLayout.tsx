import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ChevronDown, KeyRound, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { ROLE_LABELS } from '../lib/supabase';
import { NAV } from '../nav';
import { Wordmark } from './AuthCard';
import { LoadingBlock } from './ui';

function initials(name: string, email: string) {
  const source = name.trim() || email;
  return source.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function AccountMenu() {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!profile) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-100"
        aria-expanded={open}
      >
        <span className="w-8 h-8 rounded-full bg-brand-blue/10 text-brand-blue text-xs font-semibold flex items-center justify-center">
          {initials(profile.full_name, profile.email)}
        </span>
        <span className="hidden sm:block text-left leading-tight">
          <span className="block text-sm font-medium text-slate-800">{profile.full_name || profile.email}</span>
          <span className="block text-xs text-slate-500">{ROLE_LABELS[profile.role]}</span>
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg z-30">
          <div className="px-3 py-2 text-xs text-slate-500 truncate">{profile.email}</div>
          <Link
            to="/change-password"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            <KeyRound className="w-4 h-4" /> Change password
          </Link>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { profile } = useAuth();
  const items = NAV.filter(item => item.visible(profile));

  return (
    <nav className="flex flex-col gap-1 p-3">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive ? 'bg-brand-blue text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`
          }
        >
          <Icon className="w-4.5 h-4.5" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function AdminLayout() {
  const { profile } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  // First-login password change renders full screen, without the panel chrome.
  if (profile?.must_change_password) return <Outlet />;

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-slate-900">
        <div className="px-5 py-5 border-b border-white/10">
          <Wordmark light />
        </div>
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-slate-900 flex flex-col">
            <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
              <Wordmark light />
              <button onClick={() => setDrawerOpen(false)} className="text-slate-400 hover:text-white" aria-label="Close menu">
                <X className="w-5 h-5" />
              </button>
            </div>
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/90 backdrop-blur px-4 sm:px-6 lg:px-8 h-16">
        <button onClick={() => setDrawerOpen(true)} className="lg:hidden text-slate-600" aria-label="Open menu">
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex-1" />
        <AccountMenu />
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-8">
        <Suspense fallback={<LoadingBlock />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

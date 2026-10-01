import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from './AuthProvider';
import type { Profile } from '../lib/supabase';
import AuthCard from '../components/AuthCard';
import Button from '../components/Button';

export function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/** Requires a signed-in user with an active admin profile. */
export function RequireAuth() {
  const { session, profile, signOut } = useAuth();
  const location = useLocation();

  if (session === undefined) return <FullPageSpinner />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (profile === undefined) return <FullPageSpinner />;

  if (!profile || !profile.is_active) {
    return (
      <AuthCard title="No access" subtitle="This account is not authorised to use the admin panel.">
        <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <p>If you believe this is a mistake, ask a Super Admin to check your account.</p>
        </div>
        <Button className="w-full mt-5" onClick={signOut}>Sign out</Button>
      </AuthCard>
    );
  }

  if (profile.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}

/** Hides a section from users without access. Row Level Security enforces the same rules in the database. */
export function RequireAccess({ check }: { check: (profile: Profile | null | undefined) => boolean }) {
  const { profile } = useAuth();
  if (!check(profile)) return <Navigate to="/" replace />;
  return <Outlet />;
}

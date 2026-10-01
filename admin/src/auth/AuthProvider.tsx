import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/supabase';

interface AuthContextValue {
  /** undefined while the stored session is being restored */
  session: Session | null | undefined;
  /** undefined while loading; null when the user has no admin profile */
  profile: Profile | null | undefined;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const userId = session?.user.id;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    // Don't call other supabase methods inside this callback (supabase-js deadlock);
    // the profile is loaded by the effect below instead.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadProfile = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, is_active, must_change_password, permissions')
      .eq('id', id)
      .maybeSingle();
    setProfile(error ? null : (data as Profile | null));
  }, []);

  // Keyed on the user id, so token refreshes don't refetch the profile.
  const sessionRestored = session !== undefined;
  useEffect(() => {
    if (!sessionRestored) return;
    if (!userId) {
      setProfile(null);
      return;
    }
    setProfile(undefined);
    loadProfile(userId);
  }, [sessionRestored, userId, loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (userId) await loadProfile(userId);
  }, [userId, loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ session, profile, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

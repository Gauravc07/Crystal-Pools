import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set in .env');
}

// Only the publishable key ever reaches the browser. What a logged-in user can
// read or change is enforced by Row Level Security in the database.
export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'cp-admin-auth',
  },
});

export type Role = 'super_admin' | 'editor';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  must_change_password: boolean;
  /** Editors only: 'blogs' | 'projects' | 'testimonials' | 'page:<id>' */
  permissions: string[];
}

/** Super Admins can do everything; Editors only what their permissions list. */
export function can(profile: Profile | null | undefined, permission: string) {
  if (!profile?.is_active) return false;
  return profile.role === 'super_admin' || profile.permissions.includes(permission);
}

export const canEditAnyPage = (profile: Profile | null | undefined) =>
  !!profile?.is_active && (profile.role === 'super_admin' || profile.permissions.some(p => p.startsWith('page:')));

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  editor: 'Editor',
};

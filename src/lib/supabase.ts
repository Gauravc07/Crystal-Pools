import { createClient } from '@supabase/supabase-js';

// Public website client: publishable key only, no login/session.
// Row Level Security limits it to reading published content and submitting enquiries.
// If the keys are missing (e.g. not set on the host), don't crash: requests simply fail and
// every page falls back to its built-in content.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) console.error('Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY). Showing built-in content only.');

export const supabase = createClient(
  url || 'https://not-configured.invalid',
  key || 'not-configured',
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
);

type Bucket = 'blog' | 'projects' | 'testimonials' | 'site' | 'pages';

/** Resolves a stored media value (storage path or absolute/legacy URL) to a loadable URL. */
export function mediaUrl(bucket: Bucket, value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('/') || /^https?:\/\//.test(value)) return value;
  return supabase.storage.from(bucket).getPublicUrl(value).data.publicUrl;
}

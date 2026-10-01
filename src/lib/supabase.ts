import { createClient } from '@supabase/supabase-js';

// Public website client: publishable key only, no login/session.
// Row Level Security limits it to reading published content and submitting enquiries.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
);

type Bucket = 'blog' | 'projects' | 'testimonials' | 'site' | 'pages';

/** Resolves a stored media value (storage path or absolute/legacy URL) to a loadable URL. */
export function mediaUrl(bucket: Bucket, value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('/') || /^https?:\/\//.test(value)) return value;
  return supabase.storage.from(bucket).getPublicUrl(value).data.publicUrl;
}

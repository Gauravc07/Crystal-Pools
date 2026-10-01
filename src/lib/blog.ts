import { supabase, mediaUrl } from './supabase';

export interface PostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  featured_image: string | null;
  author_name: string;
  is_featured: boolean;
  published_at: string;
  tags: string[];
  category: { name: string; slug: string } | null;
}

export interface Post extends PostSummary {
  content: string;
  meta_title: string | null;
  meta_description: string | null;
  og_image: string | null;
}

export interface Category {
  name: string;
  slug: string;
}

// Row Level Security only returns published posts whose publish date has passed.
const SUMMARY = 'id, title, slug, excerpt, featured_image, author_name, is_featured, published_at, tags, category:blog_categories(name, slug)';
const FULL = `${SUMMARY}, content, meta_title, meta_description, og_image`;

export async function fetchPosts(): Promise<PostSummary[]> {
  const { data, error } = await supabase.from('blogs').select(SUMMARY).order('published_at', { ascending: false });
  if (error) throw error;
  return data as unknown as PostSummary[];
}

export async function fetchCategories(): Promise<Category[]> {
  const { data } = await supabase.from('blog_categories').select('name, slug').order('sort_order');
  return data ?? [];
}

export async function fetchPost(slug: string): Promise<Post | null> {
  const { data, error } = await supabase.from('blogs').select(FULL).eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data as unknown as Post | null;
}

/** If a post was renamed, returns its current slug so the old URL can redirect. */
export async function resolveRedirect(oldSlug: string): Promise<string | null> {
  const { data } = await supabase
    .from('blog_slug_redirects')
    .select('blog:blogs(slug)')
    .eq('old_slug', oldSlug)
    .maybeSingle();
  return (data as unknown as { blog: { slug: string } | null } | null)?.blog?.slug ?? null;
}

/** Up to `count` related posts: same category first, then most shared tags, then newest. */
export async function fetchRelated(post: PostSummary, count = 3): Promise<PostSummary[]> {
  const { data } = await supabase
    .from('blogs')
    .select(SUMMARY)
    .neq('id', post.id)
    .order('published_at', { ascending: false })
    .limit(30);
  const candidates = (data ?? []) as unknown as PostSummary[];
  const tags = new Set(post.tags);
  const score = (p: PostSummary) =>
    (p.category?.slug && p.category.slug === post.category?.slug ? 100 : 0) + p.tags.filter(t => tags.has(t)).length;
  return candidates
    .map((p, i) => ({ p, s: score(p), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, count)
    .map(x => x.p);
}

export const postImage = (value: string | null) => mediaUrl('blog', value);

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
export const formatPostDate = (iso: string) => dateFormat.format(new Date(iso));

export function readingMinutes(html: string) {
  const words = html.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

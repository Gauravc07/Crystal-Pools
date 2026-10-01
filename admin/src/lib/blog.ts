export interface BlogCategory {
  id: string;
  name: string;
}

export interface BlogRow {
  id: string;
  title: string;
  slug: string;
  category_id: string | null;
  excerpt: string;
  content: string;
  featured_image: string | null;
  author_name: string;
  is_featured: boolean;
  status: 'draft' | 'published';
  published_at: string | null;
  meta_title: string | null;
  meta_description: string | null;
  tags: string[];
  og_image: string | null;
  updated_at: string;
}

export const BLOG_COLUMNS =
  'id, title, slug, category_id, excerpt, content, featured_image, author_name, is_featured, status, published_at, meta_title, meta_description, tags, og_image, updated_at';

export type DisplayStatus = 'draft' | 'scheduled' | 'published';

export function displayStatus(post: Pick<BlogRow, 'status' | 'published_at'>): DisplayStatus {
  if (post.status === 'draft') return 'draft';
  return post.published_at && new Date(post.published_at) > new Date() ? 'scheduled' : 'published';
}

export const STATUS_BADGE: Record<DisplayStatus, { label: string; tone: 'slate' | 'amber' | 'green' }> = {
  draft: { label: 'Draft', tone: 'slate' },
  scheduled: { label: 'Scheduled', tone: 'amber' },
  published: { label: 'Published', tone: 'green' },
};

/** Public website base URL, used for "View on site" links and SEO previews. */
export const PUBLIC_SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL || 'https://www.crystalpools.in').replace(/\/$/, '');

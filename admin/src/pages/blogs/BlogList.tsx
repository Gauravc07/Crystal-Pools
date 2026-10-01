import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { mediaUrl } from '../../lib/storage';
import { formatDate } from '../../lib/format';
import { displayStatus, STATUS_BADGE } from '../../lib/blog';
import type { BlogCategory, BlogRow, DisplayStatus } from '../../lib/blog';
import PageHeader from '../../components/PageHeader';
import Button from '../../components/Button';
import { useToast } from '../../components/Toast';
import { Badge, EmptyState, LoadingBlock, TextInput } from '../../components/ui';

type ListRow = Pick<BlogRow, 'id' | 'title' | 'slug' | 'category_id' | 'featured_image' | 'is_featured' | 'status' | 'published_at' | 'updated_at'>;

export default function BlogList() {
  const navigate = useNavigate();
  const notify = useToast();
  const [posts, setPosts] = useState<ListRow[] | null>(null);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [filter, setFilter] = useState<DisplayStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase
      .from('blogs')
      .select('id, title, slug, category_id, featured_image, is_featured, status, published_at, updated_at')
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) notify(error.message, 'error');
        setPosts((data as ListRow[]) ?? []);
      });
    supabase.from('blog_categories').select('id, name').order('sort_order').then(({ data }) => setCategories(data ?? []));
  }, [notify]);

  const categoryName = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c.name])), [categories]);

  const counts = useMemo(() => {
    const c = { all: 0, draft: 0, scheduled: 0, published: 0 };
    posts?.forEach(p => { c.all++; c[displayStatus(p)]++; });
    return c;
  }, [posts]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (posts ?? []).filter(p =>
      (filter === 'all' || displayStatus(p) === filter) &&
      (!term || p.title.toLowerCase().includes(term) || p.slug.includes(term)),
    );
  }, [posts, filter, search]);

  const tabs: { value: DisplayStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'published', label: 'Published' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'draft', label: 'Drafts' },
  ];

  return (
    <>
      <PageHeader
        title="Blogs"
        description="Write, edit and publish blog posts."
        actions={<Button onClick={() => navigate('/blogs/new')}><Plus className="w-4 h-4" /> New post</Button>}
      />

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex flex-col gap-3 p-4 border-b border-slate-200 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(t => (
              <button
                key={t.value}
                onClick={() => setFilter(t.value)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                  filter === t.value ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t.label} <span className="ml-1 opacity-70 tabular-nums">{counts[t.value]}</span>
              </button>
            ))}
          </div>
          <div className="relative md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <TextInput placeholder="Search posts" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        {posts === null ? (
          <LoadingBlock />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={posts.length === 0 ? 'No blog posts yet' : 'No matching posts'}
            description={posts.length === 0 ? 'Create your first post to get started.' : 'Try a different filter or search.'}
            action={posts.length === 0 && <Button onClick={() => navigate('/blogs/new')}><Plus className="w-4 h-4" /> New post</Button>}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map(post => {
              const status = STATUS_BADGE[displayStatus(post)];
              const thumb = mediaUrl('blog', post.featured_image);
              return (
                <li key={post.id}>
                  <Link to={`/blogs/${post.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50">
                    <div className="w-20 h-14 shrink-0 overflow-hidden rounded-md bg-slate-100">
                      {thumb && <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-slate-800">{post.title || 'Untitled'}</span>
                        {post.is_featured && <Star className="w-4 h-4 shrink-0 fill-brand-gold text-brand-gold" aria-label="Featured" />}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                        <span>{(post.category_id && categoryName[post.category_id]) || 'Uncategorised'}</span>
                        <span className="truncate">/blogs/{post.slug}</span>
                      </div>
                    </div>
                    <div className="hidden sm:block text-right text-xs text-slate-500 whitespace-nowrap">
                      {post.status === 'draft' ? `Edited ${formatDate(post.updated_at)}` : formatDate(post.published_at)}
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

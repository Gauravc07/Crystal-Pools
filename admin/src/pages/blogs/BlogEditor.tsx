import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Info, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { friendlyDbError, fromLocalInput, slugify, SLUG_PATTERN, toLocalInput } from '../../lib/format';
import { BLOG_COLUMNS, displayStatus, PUBLIC_SITE_URL, STATUS_BADGE } from '../../lib/blog';
import type { BlogCategory, BlogRow } from '../../lib/blog';
import Field from '../../components/Field';
import Button from '../../components/Button';
import ImageUpload from '../../components/ImageUpload';
import RichTextEditor from '../../components/RichTextEditor';
import { useToast } from '../../components/Toast';
import { Badge, Card, CharCount, ConfirmDialog, LoadingBlock, Select, TextArea, Toggle } from '../../components/ui';

type Form = Omit<BlogRow, 'id' | 'updated_at'> & { tagsText: string };

const EMPTY: Form = {
  title: '', slug: '', category_id: null, excerpt: '', content: '', featured_image: null,
  author_name: '', is_featured: false, status: 'draft', published_at: null,
  meta_title: '', meta_description: '', tags: [], og_image: null, tagsText: '',
};

function parseTags(text: string) {
  return [...new Set(text.split(',').map(t => t.trim().toLowerCase()).filter(Boolean))];
}

function SearchPreview({ title, description, slug }: { title: string; description: string; slug: string }) {
  const host = PUBLIC_SITE_URL.replace(/^https?:\/\//, '');
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs text-slate-500 mb-2">Google search preview</p>
      <div className="text-xs text-slate-600 truncate">{host} › blogs › {slug || 'post-url'}</div>
      <div className="mt-0.5 text-lg leading-snug text-[#1a0dab] line-clamp-1">{title || 'Post title'} | Crystal Pools</div>
      <div className="mt-0.5 text-sm text-slate-600 line-clamp-2">{description || 'The short description will appear here.'}</div>
    </div>
  );
}

export default function BlogEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const notify = useToast();
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  const [form, setForm] = useState<Form | null>(isNew ? { ...EMPTY, author_name: profile?.full_name ?? '' } : null);
  const [original, setOriginal] = useState<BlogRow | null>(null);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [slugEdited, setSlugEdited] = useState(!isNew);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    supabase.from('blog_categories').select('id, name').order('sort_order').then(({ data }) => setCategories(data ?? []));
  }, []);

  useEffect(() => {
    if (isNew) return;
    supabase.from('blogs').select(BLOG_COLUMNS).eq('id', id).maybeSingle().then(({ data, error }) => {
      if (error || !data) {
        notify('Post not found.', 'error');
        navigate('/blogs', { replace: true });
        return;
      }
      const row = data as BlogRow;
      setOriginal(row);
      setForm({ ...row, meta_title: row.meta_title ?? '', meta_description: row.meta_description ?? '', tagsText: row.tags.join(', ') });
    });
  }, [id, isNew, navigate, notify]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Editors can only work on drafts; a published post is read-only for them.
  const readOnly = !isSuperAdmin && original?.status === 'published';
  const canDelete = !isNew && (isSuperAdmin || original?.status === 'draft');

  const update = <K extends keyof Form>(key: K, value: Form[K]) => {
    setDirty(true);
    setForm(prev => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value };
      if (key === 'title' && !slugEdited) next.slug = slugify(value as string);
      return next;
    });
    if (errors[key as string]) setErrors(({ [key as string]: _, ...rest }) => rest);
  };

  const status = form ? displayStatus(form) : 'draft';
  const liveUrl = original && displayStatus(original) === 'published' ? `${PUBLIC_SITE_URL}/blogs/${original.slug}` : null;

  const validate = (f: Form) => {
    const e: Record<string, string> = {};
    if (!f.title.trim()) e.title = 'Title is required.';
    if (!SLUG_PATTERN.test(f.slug)) e.slug = 'Use lowercase letters, numbers and hyphens only.';
    if (f.status === 'published') {
      if (!f.excerpt.trim()) e.excerpt = 'A short description is required to publish.';
      if (!f.content.trim()) e.content = 'Content is required to publish.';
      if (!f.featured_image) e.featured_image = 'A featured image is required to publish.';
    }
    return e;
  };

  const save = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!form || !profile) return;
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      notify('Please fix the highlighted fields.', 'error');
      return;
    }

    const publishing = form.status === 'published';
    const payload = {
      title: form.title.trim(),
      slug: form.slug,
      category_id: form.category_id,
      excerpt: form.excerpt.trim(),
      content: form.content,
      featured_image: form.featured_image,
      author_name: form.author_name.trim(),
      is_featured: form.is_featured,
      status: isSuperAdmin ? form.status : 'draft',
      published_at: publishing ? (form.published_at ?? new Date().toISOString()) : form.published_at,
      meta_title: form.meta_title?.trim() || null,
      meta_description: form.meta_description?.trim() || null,
      tags: parseTags(form.tagsText),
      og_image: form.og_image,
      updated_by: profile.id,
    };

    setSaving(true);
    const result = isNew
      ? await supabase.from('blogs').insert({ ...payload, created_by: profile.id }).select(BLOG_COLUMNS).single()
      : await supabase.from('blogs').update(payload).eq('id', id).select(BLOG_COLUMNS).single();

    if (result.error) {
      setSaving(false);
      if (result.error.code === '23505') setErrors({ slug: 'This URL is already used by another post.' });
      notify(friendlyDbError(result.error), 'error');
      return;
    }

    const saved = result.data as BlogRow;
    // Only one featured post at a time
    if (saved.is_featured) {
      await supabase.from('blogs').update({ is_featured: false }).eq('is_featured', true).neq('id', saved.id);
    }

    setSaving(false);
    setDirty(false);
    setOriginal(saved);
    setForm({ ...saved, meta_title: saved.meta_title ?? '', meta_description: saved.meta_description ?? '', tagsText: saved.tags.join(', ') });
    setSlugEdited(true);
    notify(publishing ? 'Post published.' : 'Draft saved.');
    if (isNew) navigate(`/blogs/${saved.id}`, { replace: true });
  };

  const remove = async () => {
    setDeleting(true);
    const { error } = await supabase.from('blogs').delete().eq('id', id);
    setDeleting(false);
    if (error) return notify(friendlyDbError(error), 'error');
    setDirty(false);
    notify('Post deleted.');
    navigate('/blogs', { replace: true });
  };

  const folder = useMemo(() => `posts/${new Date().toISOString().slice(0, 7)}`, []);

  if (!form) return <LoadingBlock />;

  return (
    <form onSubmit={save}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/blogs" className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Back to blogs">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-semibold truncate">{isNew ? 'New post' : 'Edit post'}</h1>
          {!isNew && original && <Badge tone={STATUS_BADGE[displayStatus(original)].tone}>{STATUS_BADGE[displayStatus(original)].label}</Badge>}
        </div>
        <div className="flex gap-2">
          {liveUrl && (
            <a href={liveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
              <ExternalLink className="w-4 h-4" /> View on site
            </a>
          )}
          {!readOnly && (
            <Button type="submit" loading={saving}>
              {form.status === 'published' && isSuperAdmin ? (original?.status === 'published' ? 'Update' : 'Publish') : 'Save draft'}
            </Button>
          )}
        </div>
      </div>

      {readOnly && (
        <div className="mb-6 flex items-start gap-3 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          <Info className="w-5 h-5 shrink-0" />
          <p>This post is published. Only a Super Admin can edit published posts.</p>
        </div>
      )}

      <fieldset disabled={readOnly} className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
        <div className="grid gap-6 min-w-0">
          <Card>
            <div className="grid gap-5">
              <div>
                <Field label="Title" value={form.title} onChange={e => update('title', e.target.value)} placeholder="e.g. How to choose the right pool tiles" />
                {errors.title && <p className="mt-1.5 text-xs text-red-600">{errors.title}</p>}
              </div>
              <div>
                <Field
                  label="URL slug"
                  value={form.slug}
                  onChange={e => { setSlugEdited(true); update('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-')); }}
                  onBlur={() => update('slug', slugify(form.slug))}
                  hint={`${PUBLIC_SITE_URL}/blogs/${form.slug || '…'}${original?.status === 'published' ? ' — changing this keeps the old URL working (redirect).' : ''}`}
                />
                {errors.slug && <p className="mt-1.5 text-xs text-red-600">{errors.slug}</p>}
              </div>
              <div>
                <TextArea
                  label="Short description"
                  extra={<CharCount value={form.excerpt} max={160} />}
                  value={form.excerpt}
                  onChange={e => update('excerpt', e.target.value)}
                  hint="Shown on the blog listing cards."
                  rows={3}
                />
                {errors.excerpt && <p className="mt-1.5 text-xs text-red-600">{errors.excerpt}</p>}
              </div>
              <div>
                <span className="block text-sm font-medium text-slate-700 mb-1.5">Content</span>
                <RichTextEditor value={form.content} onChange={html => update('content', html)} folder={folder} editable={!readOnly} />
                {errors.content && <p className="mt-1.5 text-xs text-red-600">{errors.content}</p>}
              </div>
            </div>
          </Card>

          <Card title="SEO" description="How this post appears in Google and when shared on WhatsApp, Facebook or LinkedIn.">
            <div className="grid gap-5">
              <Field
                label="Meta title"
                value={form.meta_title ?? ''}
                onChange={e => update('meta_title', e.target.value)}
                placeholder={form.title || 'Defaults to the post title'}
                hint={`${(form.meta_title || form.title).length}/60 characters — leave empty to use the title.`}
              />
              <TextArea
                label="Meta description"
                extra={<CharCount value={form.meta_description ?? ''} max={160} />}
                value={form.meta_description ?? ''}
                onChange={e => update('meta_description', e.target.value)}
                placeholder={form.excerpt || 'Defaults to the short description'}
                rows={3}
              />
              <Field
                label="Keywords / tags"
                value={form.tagsText}
                onChange={e => update('tagsText', e.target.value)}
                placeholder="pool maintenance, water chemistry, pune"
                hint="Separate with commas. Also used to find related posts."
              />
              <SearchPreview
                title={form.meta_title || form.title}
                description={form.meta_description || form.excerpt}
                slug={form.slug}
              />
              <div className="sm:max-w-sm">
                <ImageUpload
                  label="Social share image (OG image)"
                  bucket="blog"
                  folder="og"
                  value={form.og_image}
                  onChange={v => update('og_image', v)}
                  aspect="aspect-[1.91/1]"
                  hint="1200 × 630 recommended. Leave empty to use the featured image."
                  disabled={readOnly}
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 lg:sticky lg:top-24">
          <Card title="Publishing">
            <div className="grid gap-5">
              {isSuperAdmin ? (
                <Select label="Status" value={form.status} onChange={e => update('status', e.target.value as Form['status'])}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </Select>
              ) : (
                <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  <Info className="w-4 h-4 shrink-0" />
                  Editors save drafts. A Super Admin reviews and publishes.
                </div>
              )}
              <Field
                label="Publish date"
                type="datetime-local"
                value={toLocalInput(form.published_at)}
                onChange={e => update('published_at', fromLocalInput(e.target.value))}
                hint={status === 'scheduled' ? 'Scheduled: goes live automatically at this time.' : 'Leave empty to use the time you publish. A future date schedules the post.'}
              />
              <Select label="Category" value={form.category_id ?? ''} onChange={e => update('category_id', e.target.value || null)}>
                <option value="">Uncategorised</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Field label="Author" value={form.author_name} onChange={e => update('author_name', e.target.value)} />
              <Toggle
                checked={form.is_featured}
                onChange={v => update('is_featured', v)}
                label="Featured post"
                description="Shown large at the top of the blog page. Only one post can be featured."
                disabled={readOnly}
              />
            </div>
          </Card>

          <Card title="Featured image">
            <ImageUpload
              label="Image"
              bucket="blog"
              folder="featured"
              value={form.featured_image}
              onChange={v => update('featured_image', v)}
              hint="Landscape, at least 1600px wide. JPG, PNG or WebP, max 5 MB."
              disabled={readOnly}
            />
            {errors.featured_image && <p className="mt-1.5 text-xs text-red-600">{errors.featured_image}</p>}
          </Card>

          {canDelete && (
            <Button type="button" variant="ghost" className="justify-start !text-red-600" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="w-4 h-4" /> Delete post
            </Button>
          )}
        </div>
      </fieldset>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete post?"
        message={<>“{form.title || 'Untitled'}” will be permanently deleted{original?.status === 'published' ? ' and removed from the website' : ''}.</>}
        loading={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </form>
  );
}

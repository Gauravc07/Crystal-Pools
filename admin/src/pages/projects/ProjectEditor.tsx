import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { friendlyDbError, slugify, SLUG_PATTERN } from '../../lib/format';
import { POOL_TYPES, PROJECT_COLUMNS } from '../../lib/projects';
import type { ProjectRow } from '../../lib/projects';
import Field from '../../components/Field';
import Button from '../../components/Button';
import GalleryManager from '../../components/GalleryManager';
import { useToast } from '../../components/Toast';
import { Card, ConfirmDialog, LoadingBlock, Select, TextArea, Toggle } from '../../components/ui';

type Form = Omit<ProjectRow, 'id' | 'updated_at'>;

const EMPTY: Form = {
  name: '', slug: '', location: '', pool_type: 'private', description: '',
  cover_image: null, images: [], is_published: false, sort_order: 0,
};

export default function ProjectEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const notify = useToast();

  const [form, setForm] = useState<Form | null>(isNew ? EMPTY : null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [folder] = useState(() => `p-${crypto.randomUUID().slice(0, 8)}`);

  useEffect(() => {
    if (isNew) return;
    supabase.from('projects').select(PROJECT_COLUMNS).eq('id', id).maybeSingle().then(({ data, error }) => {
      if (error || !data) {
        notify('Project not found.', 'error');
        navigate('/projects', { replace: true });
        return;
      }
      setForm(data as ProjectRow);
    });
  }, [id, isNew, navigate, notify]);

  const update = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm(prev => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value };
      if (key === 'name' && isNew) next.slug = slugify(value as string);
      // Keep the cover valid when photos are removed
      if (key === 'images') {
        const imgs = value as Form['images'];
        if (!imgs.some(i => i.path === next.cover_image)) next.cover_image = imgs[0]?.path ?? null;
      }
      return next;
    });
    if (errors[key as string]) setErrors(({ [key as string]: _, ...rest }) => rest);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Project name is required.';
    const slug = form.slug || slugify(form.name);
    if (!SLUG_PATTERN.test(slug)) errs.name = errs.name ?? 'Name must contain letters or numbers.';
    if (form.is_published && form.images.length === 0) errs.images = 'Add at least one photo before publishing.';
    setErrors(errs);
    if (Object.keys(errs).length) return notify('Please fix the highlighted fields.', 'error');

    const { id: _id, updated_at: _updated, ...fields } = form as Form & Partial<Pick<ProjectRow, 'id' | 'updated_at'>>;
    const payload = {
      ...fields,
      name: form.name.trim(),
      slug,
      location: form.location.trim(),
      description: form.description.trim(),
      cover_image: form.cover_image ?? form.images[0]?.path ?? null,
    };

    setSaving(true);
    let result = isNew
      ? await supabase.from('projects').insert(payload).select(PROJECT_COLUMNS).single()
      : await supabase.from('projects').update(payload).eq('id', id).select(PROJECT_COLUMNS).single();

    // Two projects with the same name: make the slug unique automatically
    if (result.error?.code === '23505') {
      const unique = `${slug}-${crypto.randomUUID().slice(0, 4)}`;
      result = isNew
        ? await supabase.from('projects').insert({ ...payload, slug: unique }).select(PROJECT_COLUMNS).single()
        : await supabase.from('projects').update({ ...payload, slug: unique }).eq('id', id).select(PROJECT_COLUMNS).single();
    }
    setSaving(false);

    if (result.error) return notify(friendlyDbError(result.error), 'error');
    const saved = result.data as ProjectRow;
    setForm(saved);
    notify('Project saved.');
    if (isNew) navigate(`/projects/${saved.id}`, { replace: true });
  };

  const remove = async () => {
    setDeleting(true);
    const { error } = await supabase.from('projects').delete().eq('id', id);
    setDeleting(false);
    if (error) return notify(friendlyDbError(error), 'error');
    notify('Project deleted.');
    navigate('/projects', { replace: true });
  };

  if (!form) return <LoadingBlock />;

  return (
    <form onSubmit={save}>
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/projects" className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Back to projects">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-semibold truncate">{isNew ? 'New project' : form.name || 'Edit project'}</h1>
        </div>
        <Button type="submit" loading={saving}>Save</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
        <div className="grid gap-6 min-w-0">
          <Card>
            <div className="grid gap-5">
              <div>
                <Field label="Project name" value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Villa Infinity Pool, Lavasa" />
                {errors.name && <p className="mt-1.5 text-xs text-red-600">{errors.name}</p>}
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Location" value={form.location} onChange={e => update('location', e.target.value)} placeholder="e.g. Pune, Maharashtra" />
                <Select label="Pool type" value={form.pool_type} onChange={e => update('pool_type', e.target.value as Form['pool_type'])} hint="The project also appears on this pool type's page.">
                  {POOL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              </div>
              <TextArea label="Description" rows={5} value={form.description} onChange={e => update('description', e.target.value)} placeholder="Size, features, finishes, timeline…" />
            </div>
          </Card>

          <Card title="Photo gallery" description="The first photo is used as the cover unless you pick another (star icon).">
            <GalleryManager
              bucket="projects"
              folder={isNew ? folder : `p-${id!.slice(0, 8)}`}
              images={form.images}
              onChange={imgs => update('images', imgs)}
              cover={form.cover_image}
              onSetCover={path => update('cover_image', path)}
            />
            {errors.images && <p className="mt-2 text-xs text-red-600">{errors.images}</p>}
          </Card>
        </div>

        <div className="grid gap-6 lg:sticky lg:top-24">
          <Card title="Visibility">
            <div className="grid gap-5">
              <Toggle
                checked={form.is_published}
                onChange={v => update('is_published', v)}
                label="Show on website"
                description="Hidden projects are only visible here."
              />
              <Field
                label="Display order"
                type="number"
                value={String(form.sort_order)}
                onChange={e => update('sort_order', Number(e.target.value) || 0)}
                hint="Lower numbers appear first."
              />
            </div>
          </Card>
          {!isNew && (
            <Button type="button" variant="ghost" className="justify-start !text-red-600" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="w-4 h-4" /> Delete project
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete project?"
        message={<>“{form.name}” and its gallery will be removed from the website. This cannot be undone.</>}
        loading={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </form>
  );
}

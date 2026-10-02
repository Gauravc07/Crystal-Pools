import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Copy, ExternalLink, ImagePlus, Images, RotateCcw, Search, Trash2, Upload } from 'lucide-react';
import { PAGES, PAGE_GROUPS } from '../../../src/content';
import { allFields } from '../../../src/content/types';
import type { PageSchema } from '../../../src/content/types';
import { supabase, can, canEditAnyPage } from '../lib/supabase';
import { mediaUrl, uploadFile } from '../lib/storage';
import { deleteFromLibrary, formatBytes, listLibrary, uploadToLibrary } from '../lib/library';
import type { LibraryImage } from '../lib/library';
import { useAuth } from '../auth/AuthProvider';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import LibraryPicker from '../components/LibraryPicker';
import { useToast } from '../components/Toast';
import { Badge, ConfirmDialog, EmptyState, LoadingBlock, Spinner, TextInput } from '../components/ui';

type Overrides = Record<string, Record<string, unknown>>;
type Item = Record<string, string>;

/** One image position on a website page (a field, or an image inside a list item). */
interface Slot {
  id: string;
  page: PageSchema;
  key: string;
  itemIndex?: number;
  sub?: string;
  label: string;
  value: string;
  defaultValue: string;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function slotsFor(page: PageSchema, overrides: Record<string, unknown>): Slot[] {
  const slots: Slot[] = [];
  for (const [key, field] of Object.entries(allFields(page))) {
    if (field.type === 'image') {
      const v = overrides[key];
      slots.push({ id: `${page.id}:${key}`, page, key, label: field.label, value: typeof v === 'string' && v ? v : field.default, defaultValue: field.default });
    }
    if (field.type === 'list') {
      const imageSubs = Object.entries(field.item).filter(([, d]) => d.type === 'image');
      if (!imageSubs.length) continue;
      const items = (Array.isArray(overrides[key]) ? overrides[key] : field.default) as Item[];
      const titleSub = Object.entries(field.item).find(([, d]) => d.type === 'text')?.[0];
      items.forEach((item, i) => {
        for (const [sub, def] of imageSubs) {
          const fallback = field.resizable ? '' : field.default[i]?.[sub] ?? '';
          const name = (titleSub && item[titleSub]) || `#${i + 1}`;
          slots.push({
            id: `${page.id}:${key}:${i}:${sub}`, page, key, itemIndex: i, sub,
            label: `${field.label} › ${name}${imageSubs.length > 1 ? ` › ${def.label}` : ''}`,
            value: item[sub] || fallback, defaultValue: fallback,
          });
        }
      });
    }
  }
  return slots;
}

function ImageTile({ slot, busy, onUpload, onLibrary, onReset }: {
  slot: Slot; busy: boolean; onUpload: () => void; onLibrary: () => void; onReset: () => void;
}) {
  const url = mediaUrl('pages', slot.value);
  const custom = slot.value !== slot.defaultValue;
  return (
    <li className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="relative aspect-video bg-slate-100">
        {url ? <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-slate-400">No image</div>}
        <span className="absolute left-2 top-2">{custom ? <Badge tone="cyan">Custom</Badge> : <Badge>Built-in</Badge>}</span>
        {busy && <div className="absolute inset-0 flex items-center justify-center bg-white/70"><Spinner /></div>}
      </div>
      <div className="p-2.5">
        <p className="text-xs text-slate-600 line-clamp-2 min-h-8" title={slot.label}>{slot.label}</p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          <button type="button" onClick={onUpload} disabled={busy} className="inline-flex items-center gap-1 text-xs font-medium text-brand-blue hover:underline"><Upload className="w-3.5 h-3.5" /> Upload</button>
          <button type="button" onClick={onLibrary} disabled={busy} className="inline-flex items-center gap-1 text-xs font-medium text-brand-blue hover:underline"><Images className="w-3.5 h-3.5" /> Library</button>
          {custom && slot.defaultValue && (
            <button type="button" onClick={onReset} disabled={busy} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:underline"><RotateCcw className="w-3.5 h-3.5" /> Reset</button>
          )}
        </div>
      </div>
    </li>
  );
}

function PageImages() {
  const { profile } = useAuth();
  const notify = useToast();
  const [overrides, setOverrides] = useState<Overrides | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [picking, setPicking] = useState<Slot | null>(null);
  const uploadTarget = useRef<Slot | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('page_content').select('page, key, value');
    if (error) notify(error.message, 'error');
    const map: Overrides = {};
    for (const row of data ?? []) (map[row.page] ??= {})[row.key] = row.value;
    setOverrides(map);
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const pages = useMemo(() => PAGES.filter(p => can(profile, `page:${p.id}`)), [profile]);
  const slotsByPage = useMemo(
    () => (overrides ? Object.fromEntries(pages.map(p => [p.id, slotsFor(p, overrides[p.id] ?? {})])) : {}),
    [pages, overrides],
  );

  /** Writes one image position back to page_content (deleting the row when it matches the default). */
  const apply = async (slot: Slot, path: string) => {
    if (!profile) return;
    const field = allFields(slot.page)[slot.key];
    let value: unknown = path;
    if (field.type === 'list') {
      const current = (Array.isArray(overrides?.[slot.page.id]?.[slot.key]) ? overrides![slot.page.id][slot.key] : field.default) as Item[];
      value = current.map((item, i) => (i === slot.itemIndex ? { ...item, [slot.sub!]: path } : item));
    }
    const isDefault = same(value, field.default);
    setBusy(slot.id);
    const { error } = isDefault
      ? await supabase.from('page_content').delete().eq('page', slot.page.id).eq('key', slot.key)
      : await supabase.from('page_content').upsert({ page: slot.page.id, key: slot.key, value, updated_by: profile.id });
    setBusy(null);
    if (error) return notify(/row-level security/i.test(error.message) ? 'You do not have permission to edit this page.' : error.message, 'error');
    notify('Image updated. It is live on the website.');
    load();
  };

  const onFile = async (file: File | undefined) => {
    const slot = uploadTarget.current;
    if (!file || !slot) return;
    setBusy(slot.id);
    try {
      const path = await uploadFile('pages', file, `${slot.page.id}/images`);
      await apply(slot, path);
    } catch (err) {
      notify((err as Error).message, 'error');
      setBusy(null);
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  if (!overrides) return <LoadingBlock />;

  const term = query.trim().toLowerCase();
  const toggle = (id: string) => setOpen(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <>
      <div className="relative mb-5 sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <TextInput placeholder="Search images, e.g. hero, clients, products" value={query} onChange={e => setQuery(e.target.value)} className="pl-9" />
      </div>
      <div className="grid gap-8">
        {PAGE_GROUPS.map(group => {
          const groupPages = pages.filter(p => p.group === group);
          const withSlots = groupPages
            .map(p => ({ page: p, slots: (slotsByPage[p.id] ?? []).filter(s => !term || s.label.toLowerCase().includes(term) || p.label.toLowerCase().includes(term)) }))
            .filter(x => x.slots.length);
          if (!withSlots.length) return null;
          return (
            <section key={group}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">{group}</h2>
              <div className="grid gap-3">
                {withSlots.map(({ page, slots }) => {
                  const isOpen = open.has(page.id) || !!term;
                  const customCount = slots.filter(s => s.value !== s.defaultValue).length;
                  return (
                    <div key={page.id} className="rounded-xl border border-slate-200 bg-white">
                      <div className="flex items-center gap-3 px-4 py-3">
                        <button type="button" onClick={() => toggle(page.id)} className="flex flex-1 items-center gap-3 text-left min-w-0">
                          <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                          <span className="font-medium text-slate-800 truncate">{page.label}</span>
                          <span className="text-xs text-slate-500 whitespace-nowrap">{slots.length} image{slots.length > 1 ? 's' : ''}{customCount ? ` · ${customCount} custom` : ''}</span>
                        </button>
                        <Link to={`/pages/${page.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand-blue hover:underline whitespace-nowrap">
                          Edit page <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                      {isOpen && (
                        <ul className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 border-t border-slate-100 p-4">
                          {slots.map(slot => (
                            <ImageTile
                              key={slot.id}
                              slot={slot}
                              busy={busy === slot.id}
                              onUpload={() => { uploadTarget.current = slot; inputRef.current?.click(); }}
                              onLibrary={() => setPicking(slot)}
                              onReset={() => apply(slot, slot.defaultValue)}
                            />
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" hidden onChange={e => onFile(e.target.files?.[0])} />
      <LibraryPicker open={!!picking} onClose={() => setPicking(null)} onSelect={path => picking && apply(picking, path)} />
    </>
  );
}

function Library() {
  const { profile } = useAuth();
  const notify = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<LibraryImage[] | null>(null);
  const [usage, setUsage] = useState<Record<string, string[]>>({});
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [confirm, setConfirm] = useState<LibraryImage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const isSuper = profile?.role === 'super_admin';

  const load = useCallback(async () => {
    try {
      const [imgs, content] = await Promise.all([listLibrary(), supabase.from('page_content').select('page, value')]);
      // Which pages use each library image
      const used: Record<string, string[]> = {};
      for (const row of content.data ?? []) {
        const text = JSON.stringify(row.value);
        for (const img of imgs) if (text.includes(img.path)) {
          const label = PAGES.find(p => p.id === row.page)?.label ?? row.page;
          (used[img.path] ??= []).includes(label) || used[img.path].push(label);
        }
      }
      setUsage(used);
      setImages(imgs);
    } catch (err) {
      notify((err as Error).message, 'error');
      setImages([]);
    }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    setUploading({ done: 0, total: list.length });
    for (const file of list) {
      try { await uploadToLibrary(file); } catch (err) { notify(`${file.name}: ${(err as Error).message}`, 'error'); }
      setUploading(u => (u ? { ...u, done: u.done + 1 } : u));
    }
    setUploading(null);
    if (inputRef.current) inputRef.current.value = '';
    notify('Upload finished.');
    load();
  };

  const copy = async (img: LibraryImage) => {
    await navigator.clipboard.writeText(mediaUrl('pages', img.path) ?? '');
    notify('Image link copied.');
  };

  const remove = async () => {
    if (!confirm) return;
    setDeleting(true);
    try { await deleteFromLibrary(confirm.path); notify('Image deleted.'); } catch (err) { notify((err as Error).message, 'error'); }
    setDeleting(false);
    setConfirm(null);
    load();
  };

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500 max-w-xl">Upload images once and use them on any page with <strong>Choose from library</strong>. Large photos are resized and converted automatically.</p>
        <Button onClick={() => inputRef.current?.click()} disabled={!!uploading}>
          {uploading ? <><Spinner className="w-4 h-4" /> Uploading {uploading.done}/{uploading.total}…</> : <><ImagePlus className="w-4 h-4" /> Upload images</>}
        </Button>
      </div>
      {images === null ? (
        <LoadingBlock />
      ) : images.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300">
          <EmptyState icon={Images} title="The library is empty" description="Upload images here to reuse them anywhere on the website." />
        </div>
      ) : (
        <ul className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {images.map(img => {
            const usedOn = usage[img.path] ?? [];
            return (
              <li key={img.path} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                <img src={mediaUrl('pages', img.path) ?? ''} alt="" loading="lazy" className="aspect-video w-full object-cover bg-slate-100" />
                <div className="p-2.5">
                  <p className="truncate text-xs font-medium text-slate-700" title={img.name}>{img.name}</p>
                  <p className="text-xs text-slate-400">{formatBytes(img.size)}</p>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2 min-h-8">{usedOn.length ? `Used on: ${usedOn.join(', ')}` : 'Not used yet'}</p>
                  <div className="mt-2 flex gap-3">
                    <button type="button" onClick={() => copy(img)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-blue hover:underline"><Copy className="w-3.5 h-3.5" /> Copy link</button>
                    {isSuper && (
                      <button
                        type="button"
                        onClick={() => setConfirm(img)}
                        disabled={usedOn.length > 0}
                        title={usedOn.length ? 'Remove it from the pages that use it first' : 'Delete'}
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline disabled:opacity-40 disabled:no-underline"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" multiple hidden onChange={e => upload(e.target.files)} />
      <ConfirmDialog
        open={!!confirm}
        title="Delete image?"
        message={<>“{confirm?.name}” will be permanently deleted from the library.</>}
        loading={deleting}
        onConfirm={remove}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

interface OtherImage { id: string; src: string | null; label: string; to: string }

function OtherImages() {
  const { profile } = useAuth();
  const [groups, setGroups] = useState<{ title: string; to: string; items: OtherImage[] }[] | null>(null);

  useEffect(() => {
    (async () => {
      const out: { title: string; to: string; items: OtherImage[] }[] = [];
      if (can(profile, 'blogs')) {
        const { data } = await supabase.from('blogs').select('id, title, featured_image').order('updated_at', { ascending: false });
        out.push({ title: 'Blog posts', to: '/blogs', items: (data ?? []).map(b => ({ id: b.id, src: mediaUrl('blog', b.featured_image), label: b.title, to: `/blogs/${b.id}` })) });
      }
      if (can(profile, 'projects')) {
        const { data } = await supabase.from('projects').select('id, name, cover_image, images').order('sort_order');
        out.push({ title: 'Projects', to: '/projects', items: (data ?? []).map(p => ({ id: p.id, src: mediaUrl('projects', p.cover_image ?? p.images?.[0]?.path), label: `${p.name} (${p.images?.length ?? 0} photos)`, to: `/projects/${p.id}` })) });
      }
      if (can(profile, 'testimonials')) {
        const { data } = await supabase.from('testimonials').select('id, name, photo').order('sort_order');
        out.push({ title: 'Testimonials', to: '/testimonials', items: (data ?? []).filter(t => t.photo).map(t => ({ id: t.id, src: mediaUrl('testimonials', t.photo), label: t.name, to: '/testimonials' })) });
      }
      if (profile?.role === 'super_admin') {
        const { data } = await supabase.from('site_settings').select('hero_image_light, hero_image_dark, og_image').eq('id', 1).single();
        const items: OtherImage[] = [];
        if (data?.hero_image_light) items.push({ id: 'light', src: mediaUrl('site', data.hero_image_light), label: 'Homepage banner (light)', to: '/banner' });
        if (data?.hero_image_dark) items.push({ id: 'dark', src: mediaUrl('site', data.hero_image_dark), label: 'Homepage banner (dark)', to: '/banner' });
        if (data?.og_image) items.push({ id: 'og', src: mediaUrl('site', data.og_image), label: 'Default share image', to: '/settings' });
        out.push({ title: 'Banner & settings', to: '/banner', items });
      }
      setGroups(out);
    })();
  }, [profile]);

  if (!groups) return <LoadingBlock />;

  return (
    <div className="grid gap-8">
      {groups.map(g => (
        <section key={g.title}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{g.title}</h2>
            <Link to={g.to} className="text-xs font-medium text-brand-blue hover:underline">Manage</Link>
          </div>
          {g.items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">No images yet.</p>
          ) : (
            <ul className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
              {g.items.map(item => (
                <li key={item.id}>
                  <Link to={item.to} className="block rounded-lg border border-slate-200 bg-white overflow-hidden hover:shadow-md transition">
                    {item.src ? <img src={item.src} alt="" loading="lazy" className="aspect-video w-full object-cover bg-slate-100" /> : <div className="aspect-video bg-slate-100" />}
                    <p className="truncate px-2.5 py-2 text-xs text-slate-600" title={item.label}>{item.label}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

export default function Media() {
  const { profile } = useAuth();
  const tabs = [
    { id: 'pages', label: 'Website pages', show: canEditAnyPage(profile) },
    { id: 'library', label: 'Library', show: canEditAnyPage(profile) },
    { id: 'other', label: 'Blogs, projects & more', show: true },
  ].filter(t => t.show);
  const [tab, setTab] = useState(tabs[0]?.id ?? 'other');

  return (
    <>
      <PageHeader title="Media" description="Every image on the website in one place — see what's used where, and replace or upload images." />
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === t.id ? 'border-brand-blue text-brand-blue' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'pages' && <PageImages />}
      {tab === 'library' && <Library />}
      {tab === 'other' && <OtherImages />}
    </>
  );
}

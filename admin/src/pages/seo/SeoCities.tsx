import { useCallback, useEffect, useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { slugify, SLUG_PATTERN } from '../../lib/format';
import Button from '../../components/Button';
import Field from '../../components/Field';
import ImageUpload from '../../components/ImageUpload';
import RichTextEditor from '../../components/RichTextEditor';
import { useToast } from '../../components/Toast';
import { Badge, CharCount, EmptyState, Label, LoadingBlock, Modal, TextArea, Toggle } from '../../components/ui';

interface City {
  id?: string; slug: string; city: string; region: string; meta_title: string; meta_description: string;
  heading: string; intro: string; body: string; contact_name: string; phone: string; address: string;
  lat: number | null; lng: number | null; hero_image: string | null; is_published: boolean; sort_order: number;
}

const EMPTY: City = {
  slug: '', city: '', region: '', meta_title: '', meta_description: '', heading: '', intro: '', body: '',
  contact_name: '', phone: '', address: '', lat: null, lng: null, hero_image: null, is_published: false, sort_order: 100,
};

export default function SeoCities() {
  const notify = useToast();
  const [rows, setRows] = useState<City[] | null>(null);
  const [form, setForm] = useState<City | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('city_pages').select('*').order('sort_order');
    if (error) notify(error.message, 'error');
    setRows((data as City[]) ?? []);
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  if (!rows) return <LoadingBlock />;

  const set = <K extends keyof City>(k: K, v: City[K]) => setForm(f => (f ? { ...f, [k]: v } : f));

  const save = async () => {
    if (!form) return;
    const slug = form.slug || slugify(form.city);
    if (!form.city.trim()) return notify('City name is required.', 'error');
    if (!SLUG_PATTERN.test(slug)) return notify('URL name can only use lowercase letters, numbers and hyphens.', 'error');
    if (form.is_published && (!form.intro.trim() || !form.meta_description.trim() || !form.body.replace(/<[^>]+>/g, '').trim())) {
      return notify('Before publishing, write the intro, the page text and the meta description. Thin city pages can hurt rankings.', 'error');
    }
    const { id, ...fields } = form;
    const payload = { ...fields, slug, city: form.city.trim() };
    setSaving(true);
    const { error } = id
      ? await supabase.from('city_pages').update(payload).eq('id', id)
      : await supabase.from('city_pages').insert(payload);
    setSaving(false);
    if (error) return notify(error.code === '23505' ? 'Another city already uses this URL.' : error.message, 'error');
    notify(form.is_published ? 'Saved. The page goes live within about 5 minutes, and old links to this city now point to it.' : 'Saved as a draft.');
    setForm(null);
    load();
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-500">Each published city gets its own page at /swimming-pool-contractor/city-name and appears in the sitemap. Drafts stay hidden.</p>
        <Button onClick={() => setForm({ ...EMPTY })}><Plus className="w-4 h-4" /> New city</Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={MapPin} title="No city pages yet" description="Add a city to get started." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3 font-medium">City</th><th className="px-4 py-3 font-medium">URL</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(c => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{c.city}</td>
                  <td className="px-4 py-3 text-slate-500">/swimming-pool-contractor/{c.slug}</td>
                  <td className="px-4 py-3"><Badge tone={c.is_published ? 'cyan' : 'slate'}>{c.is_published ? 'Published' : 'Draft'}</Badge></td>
                  <td className="px-4 py-3 text-right"><Button variant="secondary" onClick={() => setForm({ ...c })}>Edit</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        wide
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.city || 'New city'}
        footer={<>
          <Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
          <Button loading={saving} onClick={save}>Save</Button>
        </>}
      >
        {form && (
          <div className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="City" value={form.city} onChange={e => set('city', e.target.value)} />
              <Field label="URL name" value={form.slug} placeholder={slugify(form.city)} onChange={e => set('slug', e.target.value.toLowerCase())} />
              <Field label="State" value={form.region} onChange={e => set('region', e.target.value)} />
              <Field label="Contact person" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
              <Field label="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} />
              <Field label="Address" value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
            <Field label="Google title" value={form.meta_title} placeholder={`Swimming Pool Contractor in ${form.city}`} onChange={e => set('meta_title', e.target.value)} hint={`${form.meta_title.length}/60 characters`} />
            <TextArea label="Google description" rows={2} extra={<CharCount value={form.meta_description} max={160} />} value={form.meta_description} onChange={e => set('meta_description', e.target.value)} />
            <Field label="Page heading" value={form.heading} placeholder={`Swimming Pool Contractor in ${form.city}`} onChange={e => set('heading', e.target.value)} />
            <TextArea label="Intro" rows={3} value={form.intro} onChange={e => set('intro', e.target.value)} />
            <div>
              <Label>Page text</Label>
              <RichTextEditor value={form.body} folder="cities" onChange={html => set("body", html)} />
            </div>
            <div className="sm:max-w-sm">
              <ImageUpload label="Photo" bucket="pages" folder="cities" value={form.hero_image} onChange={v => set('hero_image', v)} />
            </div>
            <Toggle checked={form.is_published} onChange={v => set('is_published', v)} label="Publish" description="Shows the page on the website and adds it to the sitemap." />
          </div>
        )}
      </Modal>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { MessageSquareQuote, Pencil, Plus, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { mediaUrl } from '../lib/storage';
import { friendlyDbError } from '../lib/format';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import Field from '../components/Field';
import ImageUpload from '../components/ImageUpload';
import { useToast } from '../components/Toast';
import { Badge, ConfirmDialog, EmptyState, Label, LoadingBlock, Modal, TextArea, Toggle } from '../components/ui';

interface Testimonial {
  id: string;
  name: string;
  designation: string;
  photo: string | null;
  review: string;
  rating: number;
  is_published: boolean;
  sort_order: number;
}

type Form = Omit<Testimonial, 'id'> & { id?: string };

const EMPTY: Form = { name: '', designation: '', photo: null, review: '', rating: 5, is_published: true, sort_order: 0 };
const COLUMNS = 'id, name, designation, photo, review, rating, is_published, sort_order';

function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-0.5" role={onChange ? 'radiogroup' : undefined} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(n => {
        const icon = <Star className={`w-5 h-5 ${n <= value ? 'fill-brand-gold text-brand-gold' : 'text-slate-300'}`} />;
        return onChange ? (
          <button key={n} type="button" role="radio" aria-checked={n === value} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onChange(n)} className="p-0.5">
            {icon}
          </button>
        ) : <span key={n}>{icon}</span>;
      })}
    </div>
  );
}

function Avatar({ name, photo }: { name: string; photo: string | null }) {
  const url = mediaUrl('testimonials', photo);
  if (url) return <img src={url} alt="" className="w-12 h-12 rounded-full object-cover" />;
  const initials = name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return <div className="w-12 h-12 rounded-full bg-brand-blue/10 text-brand-blue font-semibold flex items-center justify-center">{initials || '?'}</div>;
}

function TestimonialForm({ initial, onClose, onSaved, onDeleted }: {
  initial: Form;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const notify = useToast();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim() || !form.review.trim()) return notify('Name and review are required.', 'error');
    const { id, ...fields } = form;
    const payload = { ...fields, name: form.name.trim(), designation: form.designation.trim(), review: form.review.trim() };
    setSaving(true);
    const { error } = id
      ? await supabase.from('testimonials').update(payload).eq('id', id)
      : await supabase.from('testimonials').insert(payload);
    setSaving(false);
    if (error) return notify(friendlyDbError(error), 'error');
    notify('Testimonial saved.');
    onSaved();
  };

  const remove = async () => {
    setDeleting(true);
    const { error } = await supabase.from('testimonials').delete().eq('id', form.id!);
    setDeleting(false);
    if (error) return notify(friendlyDbError(error), 'error');
    notify('Testimonial deleted.');
    onDeleted();
  };

  return (
    <>
      <Modal
        open
        wide
        onClose={onClose}
        title={form.id ? 'Edit testimonial' : 'New testimonial'}
        footer={
          <>
            {form.id && <Button variant="ghost" className="mr-auto !text-red-600" onClick={() => setConfirmDelete(true)}>Delete</Button>}
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={save} loading={saving}>Save</Button>
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
          <ImageUpload
            label="Photo"
            bucket="testimonials"
            folder="photos"
            value={form.photo}
            onChange={v => set('photo', v)}
            aspect="aspect-square"
            hint="Optional. Initials are shown if empty."
          />
          <div className="grid gap-4 content-start">
            <Field label="Client name" value={form.name} onChange={e => set('name', e.target.value)} />
            <Field label="Designation / location" value={form.designation} onChange={e => set('designation', e.target.value)} placeholder="e.g. Villa owner, Lonavala" />
            <div>
              <Label>Rating</Label>
              <Stars value={form.rating} onChange={v => set('rating', v)} />
            </div>
          </div>
        </div>
        <TextArea className="mt-5" label="Review" rows={5} value={form.review} onChange={e => set('review', e.target.value)} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 sm:items-end">
          <Toggle checked={form.is_published} onChange={v => set('is_published', v)} label="Show on website" />
          <Field label="Display order" type="number" value={String(form.sort_order)} onChange={e => set('sort_order', Number(e.target.value) || 0)} hint="Lower numbers appear first." />
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete testimonial?"
        message={<>The review from <strong>{form.name}</strong> will be permanently deleted.</>}
        loading={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

export default function Testimonials() {
  const notify = useToast();
  const [items, setItems] = useState<Testimonial[] | null>(null);
  const [editing, setEditing] = useState<Form | null>(null);

  const load = useCallback(() => {
    supabase.from('testimonials').select(COLUMNS).order('sort_order').order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) notify(error.message, 'error');
      setItems((data as Testimonial[]) ?? []);
    });
  }, [notify]);

  useEffect(load, [load]);

  const done = () => { setEditing(null); load(); };

  return (
    <>
      <PageHeader
        title="Testimonials"
        description="Client reviews shown on the website."
        actions={<Button onClick={() => setEditing(EMPTY)}><Plus className="w-4 h-4" /> New testimonial</Button>}
      />

      {items === null ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon={MessageSquareQuote}
            title="No testimonials yet"
            description="Add reviews from happy clients."
            action={<Button onClick={() => setEditing(EMPTY)}><Plus className="w-4 h-4" /> New testimonial</Button>}
          />
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map(t => (
            <article key={t.id} className="flex flex-col bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start gap-3">
                <Avatar name={t.name} photo={t.photo} />
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-slate-900 truncate">{t.name}</h2>
                  {t.designation && <p className="text-sm text-slate-500 truncate">{t.designation}</p>}
                </div>
                <Badge tone={t.is_published ? 'green' : 'slate'}>{t.is_published ? 'Published' : 'Hidden'}</Badge>
              </div>
              <div className="mt-3"><Stars value={t.rating} /></div>
              <p className="mt-3 text-sm text-slate-600 line-clamp-4 flex-1">“{t.review}”</p>
              <button onClick={() => setEditing(t)} className="mt-4 inline-flex items-center gap-1.5 self-start text-sm font-medium text-brand-blue hover:underline">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            </article>
          ))}
        </div>
      )}

      {editing && <TestimonialForm initial={editing} onClose={() => setEditing(null)} onSaved={done} onDeleted={done} />}
    </>
  );
}

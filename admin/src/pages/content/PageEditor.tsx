import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, ExternalLink, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { pageById } from '../../../../src/content';
import { allFields } from '../../../../src/content/types';
import type { Field, ItemField, ListField, PageSchema } from '../../../../src/content/types';
import { supabase, can } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { PUBLIC_SITE_URL } from '../../lib/blog';
import Button from '../../components/Button';
import { useToast } from '../../components/Toast';
import { Card, LoadingBlock, TextInput } from '../../components/ui';
import MediaField from './MediaField';

type Values = Record<string, unknown>;
type Item = Record<string, string>;

const inputClass = `w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900
  focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 focus:border-brand-cyan`;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Value used to compare against the default (trailing spaces don't count as a change). */
function normalise(field: Field, value: unknown): unknown {
  if (field.type === 'list') return (value as Item[]).map(item => Object.fromEntries(Object.entries(item).map(([k, v]) => [k, v.trim()])));
  return typeof value === 'string' ? value.trim() : value;
}

function TextControl({ value, onChange, multiline, placeholder }: { value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string }) {
  return multiline
    ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={Math.min(8, Math.max(3, Math.ceil(value.length / 90)))} className={`${inputClass} leading-relaxed`} placeholder={placeholder} />
    : <TextInput value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="!py-2" />;
}

function FieldLabel({ label, changed, onReset, help }: { label: string; changed: boolean; onReset: () => void; help?: string }) {
  return (
    <div className="mb-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {changed && (
          <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-blue">
            <RotateCcw className="w-3 h-3" /> Reset to default
          </button>
        )}
      </div>
      {help && <p className="text-xs text-slate-500 mt-0.5">{help}</p>}
    </div>
  );
}

function ItemControl({ pageId, def, value, defaultValue, onChange, resizable }: {
  pageId: string; def: ItemField; value: string; defaultValue: string; onChange: (v: string) => void; resizable?: boolean;
}) {
  if (def.type === 'text') return <TextControl value={value} onChange={onChange} multiline={def.multiline} />;
  return <MediaField pageId={pageId} kind={def.type} value={value} defaultValue={defaultValue} onChange={onChange} allowEmpty={resizable || def.type === 'file'} />;
}

function ListControl({ pageId, field, items, onChange }: { pageId: string; field: ListField; items: Item[]; onChange: (items: Item[]) => void }) {
  const [open, setOpen] = useState<Set<number>>(() => new Set(items.length <= 4 ? items.map((_, i) => i) : []));
  const subKeys = Object.keys(field.item);
  const titleKey = subKeys.find(k => field.item[k].type === 'text');
  const toggle = (i: number) => setOpen(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; });

  const update = (i: number, key: string, v: string) => onChange(items.map((it, j) => (j === i ? { ...it, [key]: v } : it)));
  const move = (i: number, delta: number) => {
    const next = [...items];
    const [it] = next.splice(i, 1);
    next.splice(i + delta, 0, it);
    onChange(next);
    setOpen(new Set([i + delta]));
  };
  const remove = (i: number) => { onChange(items.filter((_, j) => j !== i)); setOpen(new Set()); };
  const add = () => {
    onChange([...items, Object.fromEntries(subKeys.map(k => [k, '']))]);
    setOpen(new Set([items.length]));
  };

  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const isOpen = open.has(i);
        const summary = (titleKey && item[titleKey]) || `Item ${i + 1}`;
        return (
          <div key={i} className="rounded-lg border border-slate-200 bg-slate-50/50">
            <div className="flex items-center gap-2 px-3 py-2">
              <button type="button" onClick={() => toggle(i)} className="flex flex-1 items-center gap-2 text-left min-w-0">
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                <span className="text-xs font-mono text-slate-400">{i + 1}</span>
                <span className="truncate text-sm text-slate-700">{summary}</span>
              </button>
              <div className="flex shrink-0">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="p-1.5 rounded text-slate-500 hover:bg-white disabled:opacity-30" aria-label="Move up"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button type="button" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="p-1.5 rounded text-slate-500 hover:bg-white disabled:opacity-30" aria-label="Move down"><ArrowDown className="w-3.5 h-3.5" /></button>
                {field.resizable && (
                  <button type="button" onClick={() => remove(i)} className="p-1.5 rounded text-red-500 hover:bg-red-50" aria-label="Remove item"><Trash2 className="w-3.5 h-3.5" /></button>
                )}
              </div>
            </div>
            {isOpen && (
              <div className="grid gap-4 border-t border-slate-200 bg-white px-4 py-4 rounded-b-lg">
                {subKeys.map(key => (
                  <div key={key}>
                    <span className="block text-xs font-medium text-slate-600 mb-1">{field.item[key].label}</span>
                    <ItemControl
                      pageId={pageId}
                      def={field.item[key]}
                      value={item[key] ?? ''}
                      defaultValue={field.resizable ? '' : field.default[i]?.[key] ?? ''}
                      onChange={v => update(i, key, v)}
                      resizable={field.resizable}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {field.resizable && (
        <Button type="button" variant="secondary" className="!py-2" onClick={add}><Plus className="w-4 h-4" /> Add item</Button>
      )}
    </div>
  );
}

function defaultsOf(schema: PageSchema): Values {
  return Object.fromEntries(Object.entries(allFields(schema)).map(([k, f]) => [k, f.default]));
}

export default function PageEditor() {
  const { id = '' } = useParams();
  const schema = pageById(id);
  const { profile } = useAuth();
  const notify = useToast();
  const [values, setValues] = useState<Values | null>(null);
  const [saved, setSaved] = useState<Values | null>(null);
  const [saving, setSaving] = useState(false);

  const fields = useMemo(() => (schema ? allFields(schema) : {}), [schema]);
  const defaults = useMemo(() => (schema ? defaultsOf(schema) : {}), [schema]);

  useEffect(() => {
    if (!schema) return;
    supabase.from('page_content').select('key, value').eq('page', schema.id).then(({ data, error }) => {
      if (error) notify(error.message, 'error');
      const merged: Values = { ...defaults };
      for (const row of data ?? []) if (row.key in fields) merged[row.key] = row.value;
      setValues(merged);
      setSaved(merged);
    });
  }, [schema, defaults, fields, notify]);

  const dirtyKeys = useMemo(
    () => (values && saved ? Object.keys(fields).filter(k => !same(values[k], saved[k])) : []),
    [values, saved, fields],
  );

  useEffect(() => {
    if (!dirtyKeys.length) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirtyKeys.length]);

  if (!schema) return <Navigate to="/pages" replace />;
  if (!can(profile, `page:${schema.id}`)) return <Navigate to="/pages" replace />;
  if (!values) return <LoadingBlock />;

  const set = (key: string, v: unknown) => setValues(prev => (prev ? { ...prev, [key]: v } : prev));
  const isChanged = (key: string) => !same(normalise(fields[key], values[key]), normalise(fields[key], defaults[key]));

  const save = async () => {
    if (!profile) return;
    const upserts: { page: string; key: string; value: unknown; updated_by: string }[] = [];
    const deletes: string[] = [];
    for (const key of dirtyKeys) {
      const field = fields[key];
      const value = normalise(field, values[key]);
      const isEmptyText = field.type === 'text' && value === '';
      if (isEmptyText || same(value, normalise(field, defaults[key]))) deletes.push(key);
      else upserts.push({ page: schema.id, key, value, updated_by: profile.id });
    }
    setSaving(true);
    const results = await Promise.all([
      upserts.length ? supabase.from('page_content').upsert(upserts) : Promise.resolve({ error: null }),
      deletes.length ? supabase.from('page_content').delete().eq('page', schema.id).in('key', deletes) : Promise.resolve({ error: null }),
    ]);
    setSaving(false);
    const error = results.find(r => r.error)?.error;
    if (error) return notify(/row-level security/i.test(error.message) ? 'You do not have permission to edit this page.' : error.message, 'error');
    // Empty text fields fall back to the default — reflect that in the form
    const next = { ...values };
    for (const key of deletes) next[key] = defaults[key];
    setValues(next);
    setSaved(next);
    notify('Page saved. Changes are live on the website.');
  };

  const pageUrl = `${PUBLIC_SITE_URL}${schema.path}`;

  return (
    <div className="pb-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/pages" className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Back to pages"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold truncate">{schema.label}</h1>
            <p className="text-sm text-slate-500">{schema.id === 'footer' ? 'Shown at the bottom of every page' : schema.path}</p>
          </div>
        </div>
        <a href={pageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 self-start sm:self-auto">
          <ExternalLink className="w-4 h-4" /> View page
        </a>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {schema.sections.map(section => (
          <Card key={section.title} title={section.title}>
            <div className="grid gap-6">
              {Object.entries(section.fields).map(([key, field]) => (
                <div key={key}>
                  <FieldLabel label={field.label} help={field.help} changed={isChanged(key)} onReset={() => set(key, defaults[key])} />
                  {field.type === 'text' && (
                    <TextControl value={values[key] as string} onChange={v => set(key, v)} multiline={field.multiline} placeholder={field.default} />
                  )}
                  {(field.type === 'image' || field.type === 'file') && (
                    <MediaField pageId={schema.id} kind={field.type} value={values[key] as string} defaultValue={field.default} onChange={v => set(key, v)} />
                  )}
                  {field.type === 'list' && (
                    <ListControl pageId={schema.id} field={field} items={values[key] as Item[]} onChange={v => set(key, v)} />
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 right-0 left-0 lg:left-64 z-20 border-t border-slate-200 bg-white/95 backdrop-blur px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-end gap-3">
        <span className="text-sm text-slate-500 mr-auto">
          {dirtyKeys.length ? `${dirtyKeys.length} unsaved change${dirtyKeys.length > 1 ? 's' : ''}` : 'All changes saved'}
        </span>
        {dirtyKeys.length > 0 && <Button variant="secondary" onClick={() => setValues(saved)} disabled={saving}>Discard</Button>}
        <Button onClick={save} loading={saving} disabled={!dirtyKeys.length}>Save page</Button>
      </div>
    </div>
  );
}

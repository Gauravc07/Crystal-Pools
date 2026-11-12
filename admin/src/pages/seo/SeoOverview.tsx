import { useCallback, useEffect, useMemo, useState } from 'react';
import { PAGES } from '../../../../src/content';
import { allFields, pageTitle } from '../../../../src/content/types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import Button from '../../components/Button';
import Field from '../../components/Field';
import { useToast } from '../../components/Toast';
import { Badge, CharCount, LoadingBlock, Modal, TextArea } from '../../components/ui';

interface Row {
  kind: 'page' | 'post';
  id: string;
  label: string;
  url: string;
  title: string;
  description: string;
  /** Value used by the website when the fields are left empty */
  defaultTitle: string;
  defaultDescription: string;
}

const textDefault = (page: (typeof PAGES)[number], key: string) => {
  const f = allFields(page)[key];
  return f?.type === 'text' ? f.default : '';
};

function problems(row: Row, titleCounts: Map<string, number>) {
  const title = pageTitle(row.title || row.defaultTitle);
  const description = row.description || row.defaultDescription;
  const out: string[] = [];
  if (title.length > 65) out.push('Title too long');
  if (title.length < 25) out.push('Title too short');
  if (!description) out.push('No description');
  else if (description.length > 160) out.push('Description too long');
  else if (description.length < 70) out.push('Description too short');
  if ((titleCounts.get(title.toLowerCase()) ?? 0) > 1) out.push('Duplicate title');
  return out;
}

export default function SeoOverview() {
  const { profile } = useAuth();
  const notify = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [onlyProblems, setOnlyProblems] = useState(false);

  const load = useCallback(async () => {
    const [content, posts] = await Promise.all([
      supabase.from('page_content').select('page, key, value').in('key', ['seo.title', 'seo.description']),
      supabase.from('blogs').select('id, title, slug, excerpt, meta_title, meta_description, status').eq('status', 'published').order('published_at', { ascending: false }),
    ]);
    if (content.error || posts.error) notify((content.error ?? posts.error)!.message, 'error');
    const saved = new Map((content.data ?? []).map(r => [`${r.page}/${r.key}`, String(r.value ?? '')]));
    setRows([
      ...PAGES.filter(p => p.id !== 'footer').map((p): Row => ({
        kind: 'page', id: p.id, label: p.label, url: p.path,
        title: saved.get(`${p.id}/seo.title`) ?? '',
        description: saved.get(`${p.id}/seo.description`) ?? '',
        defaultTitle: textDefault(p, 'seo.title'),
        defaultDescription: textDefault(p, 'seo.description'),
      })),
      ...(posts.data ?? []).map((b): Row => ({
        kind: 'post', id: b.id, label: b.title, url: `/blogs/${b.slug}`,
        title: b.meta_title ?? '', description: b.meta_description ?? '',
        defaultTitle: b.title, defaultDescription: b.excerpt ?? '',
      })),
    ]);
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const titleCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      const t = pageTitle(r.title || r.defaultTitle).toLowerCase();
      m.set(t, (m.get(t) ?? 0) + 1);
    }
    return m;
  }, [rows]);

  if (!rows) return <LoadingBlock />;
  const visible = rows.filter(r => !onlyProblems || problems(r, titleCounts).length);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const title = editing.title.trim();
    const description = editing.description.trim();
    let error: { message: string } | null = null;
    if (editing.kind === 'post') {
      ({ error } = await supabase.rpc('set_blog_seo', { p_id: editing.id, p_title: title, p_description: description }));
    } else {
      for (const [key, value] of [['seo.title', title], ['seo.description', description]] as const) {
        const result = value
          ? await supabase.from('page_content').upsert({ page: editing.id, key, value, updated_by: profile?.id })
          : await supabase.from('page_content').delete().eq('page', editing.id).eq('key', key);
        if (result.error) { error = result.error; break; }
      }
    }
    setSaving(false);
    if (error) return notify(error.message, 'error');
    notify('Saved. It reaches the live site within about 5 minutes.');
    setEditing(null);
    load();
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-4 p-4">
        <p className="text-sm text-slate-500">{rows.length} pages and posts. Leave a field empty to use the built-in text.</p>
        <label className="flex items-center gap-2 text-sm text-slate-600 whitespace-nowrap">
          <input type="checkbox" checked={onlyProblems} onChange={e => setOnlyProblems(e.target.checked)} /> Only problems
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-y border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Page</th>
              <th className="px-4 py-3 font-medium">Title Google sees</th>
              <th className="px-4 py-3 font-medium">Checks</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map(r => {
              const issues = problems(r, titleCounts);
              return (
                <tr key={`${r.kind}-${r.id}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{r.label}</div>
                    <div className="text-xs text-slate-400">{r.url}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{pageTitle(r.title || r.defaultTitle)}</td>
                  <td className="px-4 py-3">
                    {issues.length
                      ? <div className="flex flex-wrap gap-1">{issues.map(i => <Badge key={i} tone="amber">{i}</Badge>)}</div>
                      : <Badge tone="slate">OK</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="secondary" onClick={() => setEditing({ ...r })}>Edit</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.label ?? ''}
        footer={<>
          <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
          <Button loading={saving} onClick={save}>Save</Button>
        </>}
      >
        {editing && (
          <div className="grid gap-5">
            <Field
              label="Title"
              value={editing.title}
              placeholder={editing.defaultTitle}
              onChange={e => setEditing({ ...editing, title: e.target.value })}
              hint={`Google sees: ${pageTitle(editing.title || editing.defaultTitle)} (${pageTitle(editing.title || editing.defaultTitle).length}/60)`}
            />
            <TextArea
              label="Description"
              rows={4}
              extra={<CharCount value={editing.description || editing.defaultDescription} max={160} />}
              value={editing.description}
              placeholder={editing.defaultDescription}
              onChange={e => setEditing({ ...editing, description: e.target.value })}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

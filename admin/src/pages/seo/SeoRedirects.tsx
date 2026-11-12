import { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Button';
import { useToast } from '../../components/Toast';
import { EmptyState, LoadingBlock, TextArea } from '../../components/ui';
import { ArrowRightLeft } from 'lucide-react';

interface Redirect { id: string; from_path: string; to_path: string; status_code: number }

/** Accepts full URLs or paths; returns a clean lower-case path with no trailing slash. */
function cleanFrom(raw: string) {
  let v = raw.trim();
  try { if (/^https?:\/\//i.test(v)) v = new URL(v).pathname; } catch { /* checked below */ }
  v = decodeURI(v).split(/[?#]/)[0].toLowerCase().replace(/\/+$/, '');
  return v.startsWith('/') && v.length > 1 && !/\s/.test(v) ? v : null;
}

function cleanTo(raw: string) {
  let v = raw.trim();
  try {
    if (/^https?:\/\/(www\.)?crystalpools\.in/i.test(v)) { const u = new URL(v); v = u.pathname + u.search; }
  } catch { return null; }
  if (v.length > 1 && v.startsWith('/')) v = v.replace(/\/+$/, '') || '/';
  return (v.startsWith('/') || v.startsWith('https://')) && !/\s/.test(v) ? v : null;
}

export default function SeoRedirects() {
  const notify = useToast();
  const [rows, setRows] = useState<Redirect[] | null>(null);
  const [bulk, setBulk] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('seo_redirects').select('id, from_path, to_path, status_code').order('from_path');
    if (error) notify(error.message, 'error');
    setRows((data as Redirect[]) ?? []);
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const lines = bulk.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed: { from_path: string; to_path: string }[] = [];
    for (const line of lines) {
      const [a, b] = line.split(/[,\t]|\s+/).filter(Boolean);
      const from_path = a ? cleanFrom(a) : null;
      const to_path = b ? cleanTo(b) : null;
      if (!from_path || !to_path) return notify(`Can't read this line: ${line}`, 'error');
      if (from_path === to_path) return notify(`This line redirects to itself: ${line}`, 'error');
      parsed.push({ from_path, to_path });
    }
    if (!parsed.length) return notify('Add at least one line.', 'error');

    // Stop loops and chains: Google only follows a few hops
    const next = new Map([...(rows ?? []).map(r => [r.from_path, r.to_path] as const), ...parsed.map(p => [p.from_path, p.to_path] as const)]);
    for (const p of parsed) {
      if (next.has(p.to_path.toLowerCase())) return notify(`${p.to_path} is itself redirected. Point straight at the final page.`, 'error');
    }
    for (const r of rows ?? []) {
      if (parsed.some(p => p.from_path === r.to_path.toLowerCase())) return notify(`${r.from_path} already points at ${r.to_path}. Update that one first.`, 'error');
    }

    setSaving(true);
    const { error } = await supabase.from('seo_redirects').upsert(parsed, { onConflict: 'from_path' });
    setSaving(false);
    if (error) return notify(error.message, 'error');
    notify(`${parsed.length} redirect${parsed.length === 1 ? '' : 's'} saved.`);
    setBulk('');
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('seo_redirects').delete().eq('id', id);
    if (error) return notify(error.message, 'error');
    setRows(r => (r ?? []).filter(x => x.id !== id));
  };

  if (!rows) return <LoadingBlock />;

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <TextArea
          label="Add redirects"
          hint="One per line: old URL, new URL. Example: /old-page, /private-swimming-pools. Old website URLs are already covered by a built-in list, and anything added here takes priority."
          rows={5}
          value={bulk}
          onChange={e => setBulk(e.target.value)}
        />
        <div className="mt-3"><Button loading={saving} onClick={add}>Save redirects</Button></div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={ArrowRightLeft} title="No custom redirects yet" description="Redirects you add here appear in this list." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3 font-medium">Old URL</th><th className="px-4 py-3 font-medium">New URL</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-slate-700">{r.from_path}</td>
                  <td className="px-4 py-3 text-slate-700">{r.to_path}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" aria-label={`Delete redirect from ${r.from_path}`} onClick={() => remove(r.id)} className="p-1.5 text-slate-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

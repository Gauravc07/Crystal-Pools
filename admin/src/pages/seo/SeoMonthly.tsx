import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Button';
import Field from '../../components/Field';
import { useToast } from '../../components/Toast';
import { Card, LoadingBlock, TextArea } from '../../components/ui';

interface LeadCount { month: string; source: string; leads: number }
interface Monthly {
  month: string; review_count: number | null; average_rating: number | null; keyword_position: number | null;
  phone_clicks: number | null; whatsapp_clicks: number | null; google_leads: number | null; notes: string;
}

const NUMBER_FIELDS = [
  ['review_count', 'Google review count', 'From Google Business Profile.'],
  ['average_rating', 'Average rating', 'From Google Business Profile.'],
  ['keyword_position', 'Position for “swimming pool contractor Pune”', 'Search Console → Performance → filter by this query.'],
  ['google_leads', 'Leads from Google Business Profile', 'Calls and messages, from the profile’s Performance page.'],
  ['phone_clicks', 'Website call clicks', 'Google Analytics event phone_click.'],
  ['whatsapp_clicks', 'Website WhatsApp clicks', 'Google Analytics event whatsapp_click.'],
] as const;

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
const monthLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
const isGoogle = (s: string) => s.startsWith('google');

export default function SeoMonthly() {
  const notify = useToast();
  const [counts, setCounts] = useState<LeadCount[] | null>(null);
  const [saved, setSaved] = useState<Monthly[]>([]);
  const [month, setMonth] = useState(monthKey(new Date()));
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [c, m] = await Promise.all([
      supabase.rpc('seo_lead_counts', { p_months: 12 }),
      supabase.from('seo_monthly').select('*').order('month', { ascending: false }).limit(24),
    ]);
    if (c.error || m.error) notify((c.error ?? m.error)!.message, 'error');
    setCounts((c.data as LeadCount[]) ?? []);
    setSaved((m.data as Monthly[]) ?? []);
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const row = saved.find(r => r.month === month);
    setForm({
      ...Object.fromEntries(NUMBER_FIELDS.map(([k]) => [k, row?.[k]?.toString() ?? ''])),
      notes: row?.notes ?? '',
    });
  }, [month, saved]);

  const months = useMemo(() => {
    const d = new Date();
    return Array.from({ length: 12 }, (_, i) => monthKey(new Date(d.getFullYear(), d.getMonth() - i, 1)));
  }, []);

  if (!counts) return <LoadingBlock />;

  const leadsFor = (m: string) => counts.filter(c => c.month === m);
  const sum = (rows: LeadCount[]) => rows.reduce((n, r) => n + Number(r.leads), 0);

  const save = async () => {
    const row: Record<string, unknown> = { month, notes: form.notes ?? '' };
    for (const [k, label] of NUMBER_FIELDS) {
      const v = (form[k] ?? '').trim();
      if (v && (isNaN(Number(v)) || Number(v) < 0)) return notify(`${label} must be a number.`, 'error');
      row[k] = v ? Number(v) : null;
    }
    setSaving(true);
    const { error } = await supabase.from('seo_monthly').upsert(row);
    setSaving(false);
    if (error) return notify(error.message, 'error');
    notify('Saved.');
    load();
  };

  return (
    <div className="grid gap-6">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Month</th>
              <th className="px-4 py-3 font-medium">Website leads</th>
              <th className="px-4 py-3 font-medium">From Google search or ads</th>
              <th className="px-4 py-3 font-medium">Google Business leads</th>
              <th className="px-4 py-3 font-medium">Google reviews</th>
              <th className="px-4 py-3 font-medium">Position</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {months.map(m => {
              const rows = leadsFor(m);
              const row = saved.find(r => r.month === m);
              return (
                <tr key={m}>
                  <td className="px-4 py-3 font-medium text-slate-800">{monthLabel(m)}</td>
                  <td className="px-4 py-3 text-slate-600">{sum(rows)}</td>
                  <td className="px-4 py-3 text-slate-600">{sum(rows.filter(r => isGoogle(r.source)))}</td>
                  <td className="px-4 py-3 text-slate-600">{row?.google_leads ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{row?.review_count ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{row?.keyword_position ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="border-t border-slate-100 p-4 text-xs text-slate-500">Website lead counts are automatic. Enquiries from before source tracking started count as “unknown”, so they aren’t in the Google column.</p>
      </div>

      <Card title="Enter this month’s numbers" description="Google doesn’t share these automatically, so they’re copied in once a month.">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
            Month
            <select className="rounded-lg border border-slate-300 px-3 py-2" value={month} onChange={e => setMonth(e.target.value)}>
              {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </label>
          {NUMBER_FIELDS.map(([k, label, hint]) => (
            <Field key={k} label={label} hint={hint} inputMode="decimal" value={form[k] ?? ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
          ))}
          <TextArea className="sm:col-span-2" label="Notes" rows={3} value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="mt-4"><Button loading={saving} onClick={save}>Save</Button></div>
      </Card>
    </div>
  );
}

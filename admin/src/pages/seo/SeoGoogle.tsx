import { useEffect, useMemo, useState } from 'react';
import { PAGES } from '../../../../src/content';
import { allFields } from '../../../../src/content/types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import Button from '../../components/Button';
import Field from '../../components/Field';
import { useToast } from '../../components/Toast';
import { Card, LoadingBlock } from '../../components/ui';

interface Form { ga: string; gsc: string; gbp: string; founding: string; est: string }

const FACT = /\b\d+\+?\s*(?:years?|yrs?)\b|\bdecades?\b|\b(?:since|established in|est\.?)\s*\d{4}\b/gi;

export default function SeoGoogle() {
  const { profile } = useAuth();
  const notify = useToast();
  const [form, setForm] = useState<Form | null>(null);
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const isSuperAdmin = profile?.role === 'super_admin';

  useEffect(() => {
    supabase.from('site_settings').select('*').eq('id', 1).single().then(({ data, error }) => {
      if (error || !data) return notify(error?.message ?? 'Could not load settings.', 'error');
      setForm({
        ga: data.ga_measurement_id ?? '', gsc: data.gsc_verification ?? '', gbp: data.gbp_url ?? '',
        founding: data.founding_year ?? '2000', est: data.est_label ?? 'EST 2000',
      });
    });
    supabase.from('page_content').select('page, key, value').then(({ data }) => {
      setOverrides(Object.fromEntries((data ?? []).map(r => [`${r.page}/${r.key}`, r.value])));
    });
  }, [notify]);

  // Every place the website states a year or length of experience, so they can be made consistent.
  const facts = useMemo(() => {
    const found: { page: string; text: string }[] = [];
    for (const page of PAGES) {
      for (const [key, field] of Object.entries(allFields(page))) {
        const saved = overrides[`${page.id}/${key}`];
        const value = saved ?? (field.type === 'list' ? field.default : field.default);
        const text = typeof value === 'string' ? value : JSON.stringify(value);
        for (const m of text.matchAll(FACT)) found.push({ page: page.label, text: m[0].replace(/\s+/g, ' ') });
      }
    }
    const grouped = new Map<string, Set<string>>();
    for (const f of found) {
      const k = f.text.toLowerCase();
      if (!grouped.has(k)) grouped.set(k, new Set());
      grouped.get(k)!.add(f.page);
    }
    return [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [overrides]);

  if (!form) return <LoadingBlock />;
  const set = (k: keyof Form, v: string) => setForm(f => (f ? { ...f, [k]: v } : f));

  const saveGoogle = async () => {
    const ga = form.ga.trim().toUpperCase();
    if (ga && !/^G-[A-Z0-9]{4,20}$/.test(ga)) return notify('Google Analytics ID should look like G-XXXXXXXXXX.', 'error');
    const gsc = (form.gsc.match(/content=["']([^"']+)/)?.[1] ?? form.gsc).trim();
    if (gsc && !/^[A-Za-z0-9_-]{10,100}$/.test(gsc)) return notify('Search Console code looks wrong. Paste the HTML tag Google gives you.', 'error');
    const gbp = form.gbp.trim();
    if (gbp && !/^https:\/\//.test(gbp)) return notify('Google Business Profile link must start with https://', 'error');
    setSaving(true);
    const { error } = await supabase.rpc('set_google_settings', { p_ga: ga, p_gsc: gsc, p_gbp: gbp });
    setSaving(false);
    if (error) return notify(error.message, 'error');
    setForm({ ...form, ga, gsc, gbp });
    notify('Saved. It reaches the live site within about 5 minutes.');
  };

  const saveFacts = async () => {
    if (!/^\d{4}$/.test(form.founding.trim())) return notify('Founding year must be four digits.', 'error');
    setSaving(true);
    const { error } = await supabase.from('site_settings')
      .update({ founding_year: form.founding.trim(), est_label: form.est.trim(), updated_by: profile?.id })
      .eq('id', 1);
    setSaving(false);
    if (error) return notify(error.message, 'error');
    notify('Saved.');
  };

  return (
    <div className="grid gap-6 max-w-3xl">
      <Card title="Google connections" description="Analytics starts counting, and Search Console can verify the site, once these reach the live site.">
        <div className="grid gap-5">
          <Field label="Google Analytics 4 Measurement ID" value={form.ga} placeholder="G-XXXXXXXXXX" onChange={e => set('ga', e.target.value)} hint="Also counts phone and WhatsApp clicks, as phone_click and whatsapp_click events." />
          <Field label="Search Console verification" value={form.gsc} placeholder='<meta name="google-site-verification" content="..." />' onChange={e => set('gsc', e.target.value)} hint="Search Console → Add property → URL prefix → HTML tag." />
          <Field label="Google Business Profile link (main branch)" type="url" value={form.gbp} placeholder="https://maps.app.goo.gl/..." onChange={e => set('gbp', e.target.value)} />
          <div><Button loading={saving} onClick={saveGoogle}>Save Google settings</Button></div>
        </div>
      </Card>

      <Card title="Company facts" description="One founding year for Google, and the label on the loading screen. Only a Super Admin can change these.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Founding year" value={form.founding} disabled={!isSuperAdmin} onChange={e => set('founding', e.target.value)} hint="Used in the structured data Google reads." />
          <Field label="Loading screen label" value={form.est} disabled={!isSuperAdmin} onChange={e => set('est', e.target.value)} hint="Shown briefly while the site opens." />
        </div>
        {isSuperAdmin && <div className="mt-4"><Button loading={saving} onClick={saveFacts}>Save facts</Button></div>}
      </Card>

      <Card title="Where the website states its age" description="These should all agree. Change them in Pages, on the page listed.">
        <ul className="divide-y divide-slate-100 text-sm">
          {facts.map(([text, pages]) => (
            <li key={text} className="flex flex-wrap justify-between gap-2 py-2">
              <span className="font-medium text-slate-800">{text}</span>
              <span className="text-slate-500">{[...pages].join(', ')}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { SOCIAL_KEYS, useSiteSettings } from '../lib/settings';
import type { SiteSettings, SocialKey } from '../lib/settings';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import Field from '../components/Field';
import ImageUpload from '../components/ImageUpload';
import { useToast } from '../components/Toast';
import { Card, CharCount, LoadingBlock, TextArea } from '../components/ui';

type Form = Omit<SiteSettings, 'updated_at' | 'hero_video' | 'hero_image_light' | 'hero_image_dark' | 'branches' | 'map_lat' | 'map_lng'> & {
  branchesText: string;
  mapLat: string;
  mapLng: string;
};

const SOCIAL_LABELS: Record<SocialKey, string> = {
  instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', linkedin: 'LinkedIn',
};

export default function Settings() {
  const { profile } = useAuth();
  const notify = useToast();
  const { settings, error, save } = useSiteSettings();
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setForm({
      phone: settings.phone,
      whatsapp: settings.whatsapp,
      email: settings.email,
      address: settings.address,
      social_links: settings.social_links ?? {},
      seo_title: settings.seo_title,
      seo_description: settings.seo_description,
      og_image: settings.og_image,
      ga_measurement_id: settings.ga_measurement_id,
      gsc_verification: settings.gsc_verification,
      gbp_url: settings.gbp_url,
      branchesText: settings.branches.join(', '),
      mapLat: settings.map_lat?.toString() ?? '',
      mapLng: settings.map_lng?.toString() ?? '',
    });
  }, [settings]);

  if (error) return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  if (!form) return <LoadingBlock />;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => (f ? { ...f, [k]: v } : f));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const whatsapp = form.whatsapp.replace(/\D/g, '');
    if (!form.phone.trim() || !form.email.trim()) return notify('Phone and email are required.', 'error');
    if (whatsapp.length < 10) return notify('Enter the WhatsApp number with country code, e.g. 919552526371.', 'error');
    const lat = form.mapLat.trim() ? Number(form.mapLat) : null;
    const lng = form.mapLng.trim() ? Number(form.mapLng) : null;
    const ga = form.ga_measurement_id.trim().toUpperCase();
    if (ga && !/^G-[A-Z0-9]{4,20}$/.test(ga)) return notify('Google Analytics ID should look like G-XXXXXXXXXX.', 'error');
    // Accept either the bare code or the whole <meta ...> tag Google gives you
    const gsc = (form.gsc_verification.match(/content=["']([^"']+)/)?.[1] ?? form.gsc_verification).trim();
    if (gsc && !/^[A-Za-z0-9_-]{10,100}$/.test(gsc)) return notify('Search Console code looks wrong. Paste the HTML tag or just the code inside content="...".', 'error');
    const gbp = form.gbp_url.trim();
    if (gbp && !/^https:\/\//.test(gbp)) return notify('Google Business Profile link must start with https://', 'error');
    if ((lat !== null && (isNaN(lat) || Math.abs(lat) > 90)) || (lng !== null && (isNaN(lng) || Math.abs(lng) > 180))) {
      return notify('Map coordinates are not valid.', 'error');
    }

    setSaving(true);
    try {
      await save({
        phone: form.phone.trim(),
        whatsapp,
        email: form.email.trim(),
        address: form.address.trim(),
        branches: form.branchesText.split(',').map(b => b.trim()).filter(Boolean),
        map_lat: lat,
        map_lng: lng,
        social_links: Object.fromEntries(
          Object.entries(form.social_links).map(([k, v]) => [k, (v ?? '').trim()]).filter(([, v]) => v),
        ),
        seo_title: form.seo_title.trim(),
        seo_description: form.seo_description.trim(),
        og_image: form.og_image,
        ga_measurement_id: ga,
        gsc_verification: gsc,
        gbp_url: gbp,
      }, profile.id);
      notify('Settings saved. The website updates on next page load.');
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <PageHeader
        title="Settings"
        description="Contact details and site-wide SEO used across the website."
        actions={<Button type="submit" loading={saving}>Save settings</Button>}
      />

      <div className="grid gap-6 max-w-3xl">
        <Card title="Contact details" description="Shown in the footer, contact page, WhatsApp button and product enquiry links.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Phone number" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 95525 26371" />
            <Field
              label="WhatsApp number"
              value={form.whatsapp}
              onChange={e => set('whatsapp', e.target.value)}
              placeholder="919552526371"
              hint="With country code, digits only."
            />
            <Field label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} className="sm:col-span-2" />
            <TextArea label="Office address" rows={3} value={form.address} onChange={e => set('address', e.target.value)} className="sm:col-span-2" />
            <Field label="Map latitude" value={form.mapLat} onChange={e => set('mapLat', e.target.value)} placeholder="18.5204" />
            <Field label="Map longitude" value={form.mapLng} onChange={e => set('mapLng', e.target.value)} placeholder="73.8567" hint="Right-click the office in Google Maps to copy coordinates." />
            <Field
              label="Branch cities"
              value={form.branchesText}
              onChange={e => set('branchesText', e.target.value)}
              hint="Separate with commas."
              className="sm:col-span-2"
            />
          </div>
        </Card>

        <Card title="Social media" description="Full profile URLs. Leave empty to hide an icon.">
          <div className="grid gap-5 sm:grid-cols-2">
            {SOCIAL_KEYS.map(key => (
              <Field
                key={key}
                label={SOCIAL_LABELS[key]}
                type="url"
                value={form.social_links[key] ?? ''}
                onChange={e => set('social_links', { ...form.social_links, [key]: e.target.value })}
                placeholder={`https://${key}.com/…`}
              />
            ))}
          </div>
        </Card>

        <Card title="Google" description="Connect Google Analytics, Search Console and your Google Business Profile. Takes effect on the live site within a few minutes.">
          <div className="grid gap-5">
            <Field
              label="Google Analytics 4 Measurement ID"
              value={form.ga_measurement_id}
              onChange={e => set('ga_measurement_id', e.target.value)}
              placeholder="G-XXXXXXXXXX"
              hint="Google Analytics → Admin → Data streams → your website. Leave empty to turn tracking off."
            />
            <Field
              label="Google Search Console verification"
              value={form.gsc_verification}
              onChange={e => set('gsc_verification', e.target.value)}
              placeholder='<meta name="google-site-verification" content="..." />'
              hint="Search Console → Add property → URL prefix → HTML tag. Paste the whole tag or just the code."
            />
            <Field
              label="Google Business Profile link"
              type="url"
              value={form.gbp_url}
              onChange={e => set('gbp_url', e.target.value)}
              placeholder="https://maps.app.goo.gl/..."
              hint="Your listing's share link. Used to link the website and Google listing together for local search."
            />
          </div>
        </Card>

        <Card title="Site-wide SEO" description="Defaults for pages that don't set their own title and description.">
          <div className="grid gap-5">
            <Field
              label="Site title"
              value={form.seo_title}
              onChange={e => set('seo_title', e.target.value)}
              hint={`${form.seo_title.length}/60 characters`}
            />
            <TextArea
              label="Site description"
              extra={<CharCount value={form.seo_description} max={160} />}
              rows={3}
              value={form.seo_description}
              onChange={e => set('seo_description', e.target.value)}
            />
            <div className="sm:max-w-sm">
              <ImageUpload
                label="Default social share image"
                bucket="site"
                folder="seo"
                value={form.og_image}
                onChange={v => set('og_image', v)}
                aspect="aspect-[1.91/1]"
                hint="1200 × 630. Used when a page is shared on WhatsApp, Facebook or LinkedIn."
              />
            </div>
          </div>
        </Card>
      </div>
    </form>
  );
}

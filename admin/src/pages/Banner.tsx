import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useSiteSettings } from '../lib/settings';
import { removeFile } from '../lib/storage';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import ImageUpload from '../components/ImageUpload';
import { useToast } from '../components/Toast';
import { Card, LoadingBlock } from '../components/ui';

type Media = { hero_video: string | null; hero_image_light: string | null; hero_image_dark: string | null };

export default function Banner() {
  const { profile } = useAuth();
  const notify = useToast();
  const { settings, error, save } = useSiteSettings();
  const [media, setMedia] = useState<Media | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setMedia({ hero_video: settings.hero_video, hero_image_light: settings.hero_image_light, hero_image_dark: settings.hero_image_dark });
    }
  }, [settings]);

  if (error) return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  if (!media || !settings) return <LoadingBlock />;

  const dirty = (Object.keys(media) as (keyof Media)[]).some(k => media[k] !== settings[k]);

  const submit = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const previous = { ...settings };
      await save(media, profile.id);
      // Clean up files that were replaced or removed
      await Promise.all(
        (Object.keys(media) as (keyof Media)[])
          .filter(k => previous[k] && previous[k] !== media[k])
          .map(k => removeFile('site', previous[k])),
      );
      notify('Homepage banner updated.');
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof Media) => (v: string | null) => setMedia(m => (m ? { ...m, [k]: v } : m));

  return (
    <>
      <PageHeader
        title="Homepage Banner"
        description="The full-screen hero at the top of the homepage."
        actions={
          <>
            {dirty && <Button variant="secondary" onClick={() => setMedia({ hero_video: settings.hero_video, hero_image_light: settings.hero_image_light, hero_image_dark: settings.hero_image_dark })}>Discard</Button>}
            <Button onClick={submit} loading={saving} disabled={!dirty}>Save banner</Button>
          </>
        }
      />

      <div className="mb-6 flex items-start gap-3 rounded-lg bg-cyan-50 p-4 text-sm text-cyan-900 max-w-4xl">
        <Info className="w-5 h-5 shrink-0" />
        <p>
          In light mode the video plays over the light image; in dark mode the dark image is shown.
          Empty slots keep the website's built-in default. Use landscape media, at least 1920 × 1080.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 max-w-6xl">
        <Card title="Background video" description="Light mode. MP4, ideally under 15 MB (max 50 MB).">
          <ImageUpload
            label="Video"
            bucket="site"
            folder="hero"
            kind="video"
            accept="video/mp4"
            value={media.hero_video}
            onChange={set('hero_video')}
          />
        </Card>
        <Card title="Light mode image" description="Shown while the video loads, and if it can't play.">
          <ImageUpload label="Image" bucket="site" folder="hero" value={media.hero_image_light} onChange={set('hero_image_light')} />
        </Card>
        <Card title="Dark mode image" description="Shown when a visitor uses dark mode.">
          <ImageUpload label="Image" bucket="site" folder="hero" value={media.hero_image_dark} onChange={set('hero_image_dark')} />
        </Card>
      </div>
    </>
  );
}

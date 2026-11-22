import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPin, Phone } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import { sanitizeHtml } from '../lib/sanitize';
import { mediaUrl, supabase } from '../lib/supabase';
import { telHref } from '../lib/siteSettings';
import NotFound from './NotFound';
import { responsive } from '../lib/responsiveImage';

interface City {
  slug: string; city: string; meta_title: string; meta_description: string; heading: string;
  intro: string; body: string; contact_name: string; phone: string; address: string; hero_image: string | null;
}

function CityContent({ city }: { city: City }) {
  const title = city.meta_title || `Swimming Pool Contractor in ${city.city}`;
  usePageMeta(title, city.meta_description || city.intro, mediaUrl('pages', city.hero_image));
  const hero = mediaUrl('pages', city.hero_image);

  return (
    <div className="bg-[#f8fcfd] dark:bg-[#070d14] min-h-screen pt-32 pb-20">
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl md:text-5xl font-bold font-display text-[#0a5c86] dark:text-white mb-6">
          {city.heading || title}
        </h1>
        {city.intro && <p className="text-lg text-slate-600 dark:text-slate-300 mb-10 whitespace-pre-line">{city.intro}</p>}
        {hero && <img src={hero} {...responsive(hero)} alt={`Swimming pool by Crystal Pools in ${city.city}`} className="w-full rounded-2xl mb-10 object-cover" />}
        {city.body && (
          <div
            className="blog-content city-content mb-12"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(city.body) }}
          />
        )}
        <section className="rounded-2xl border border-slate-200 dark:border-white/10 p-6 md:p-8">
          <h2 className="text-2xl font-display font-bold text-[#0a5c86] dark:text-white mb-4">Crystal Pools {city.city}</h2>
          {city.contact_name && <p className="text-slate-700 dark:text-slate-200 mb-3">{city.contact_name}</p>}
          {city.address && (
            <p className="flex gap-2 text-slate-600 dark:text-slate-300 mb-3">
              <MapPin className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />{city.address}
            </p>
          )}
          {city.phone && (
            <p className="flex gap-2 text-slate-600 dark:text-slate-300 mb-6">
              <Phone className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
              <a href={telHref(city.phone.split('/')[0])} className="hover:underline">{city.phone}</a>
            </p>
          )}
          <Link
            to="/contact-swimming-pool-contractor"
            className="inline-block rounded-full bg-[#0a5c86] text-white px-6 py-3 font-semibold hover:opacity-90"
          >
            Book a site visit
          </Link>
        </section>
      </article>
    </div>
  );
}

export default function CityPage() {
  const { slug = '' } = useParams();
  const [city, setCity] = useState<City | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    setCity(undefined);
    // Row Level Security only returns published city pages
    supabase.from('city_pages').select('*').eq('slug', slug).maybeSingle()
      .then(({ data }) => { if (active) setCity((data as City) ?? null); });
    return () => { active = false; };
  }, [slug]);

  if (city === undefined) return <div className="min-h-screen bg-[#f8fcfd] dark:bg-[#070d14]" />;
  return city ? <CityContent city={city} /> : <NotFound />;
}

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import { POOL_TYPE_LABELS } from '../lib/content';
import { mediaUrl, supabase } from '../lib/supabase';
import NotFound from './NotFound';
import { responsive } from '../lib/responsiveImage';

interface Project {
  name: string; location: string; pool_type: string; description: string; cover_image: string | null;
  images: { path: string; alt: string }[] | null; meta_title?: string; meta_description?: string;
}

function ProjectContent({ project }: { project: Project }) {
  const place = project.location ? `, ${project.location}` : '';
  usePageMeta(
    project.meta_title || `${project.name}${place}`,
    (project.meta_description || project.description || `${project.name}, a swimming pool project by Crystal Pools${place}.`).slice(0, 300),
    mediaUrl('projects', project.cover_image),
  );
  const images = project.images?.length ? project.images : project.cover_image ? [{ path: project.cover_image, alt: project.name }] : [];

  return (
    <div className="bg-[#f8fcfd] dark:bg-[#070d14] min-h-screen pt-32 pb-20">
      <article className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl md:text-5xl font-bold font-display text-[#0a5c86] dark:text-white mb-4">{project.name}</h1>
        <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-8">
          {project.location && <><MapPin className="w-4 h-4" aria-hidden="true" />{project.location} · </>}
          {POOL_TYPE_LABELS[project.pool_type] ?? project.pool_type} pool
        </p>
        {project.description && <p className="text-lg text-slate-600 dark:text-slate-300 mb-10 whitespace-pre-line">{project.description}</p>}
        <div className="grid gap-4 sm:grid-cols-2 mb-12">
          {images.map(img => (
            <img
              key={img.path}
              src={mediaUrl('projects', img.path) ?? ''} {...responsive(mediaUrl('projects', img.path) ?? '')}
              alt={img.alt || `${project.name}${place}`}
              loading="lazy"
              className="w-full rounded-2xl object-cover"
            />
          ))}
        </div>
        <Link
          to="/contact-swimming-pool-contractor"
          className="inline-block rounded-full bg-[#0a5c86] text-white px-6 py-3 font-semibold hover:opacity-90"
        >
          Book a site visit
        </Link>
      </article>
    </div>
  );
}

export default function ProjectPage() {
  const { slug = '' } = useParams();
  const [project, setProject] = useState<Project | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    setProject(undefined);
    // Row Level Security only returns published projects
    supabase.from('projects').select('*').eq('slug', slug).maybeSingle()
      .then(({ data }) => { if (active) setProject((data as Project) ?? null); });
    return () => { active = false; };
  }, [slug]);

  if (project === undefined) return <div className="min-h-screen bg-[#f8fcfd] dark:bg-[#070d14]" />;
  return project ? <ProjectContent project={project} /> : <NotFound />;
}

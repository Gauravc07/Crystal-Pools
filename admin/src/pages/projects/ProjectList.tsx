import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Image, MapPin, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { mediaUrl } from '../../lib/storage';
import { POOL_TYPES, poolTypeLabel } from '../../lib/projects';
import type { ProjectRow } from '../../lib/projects';
import PageHeader from '../../components/PageHeader';
import Button from '../../components/Button';
import { useToast } from '../../components/Toast';
import { Badge, EmptyState, LoadingBlock, Select } from '../../components/ui';

type ListRow = Pick<ProjectRow, 'id' | 'name' | 'location' | 'pool_type' | 'cover_image' | 'images' | 'is_published' | 'sort_order'>;

export default function ProjectList() {
  const navigate = useNavigate();
  const notify = useToast();
  const [projects, setProjects] = useState<ListRow[] | null>(null);
  const [type, setType] = useState('');

  useEffect(() => {
    supabase
      .from('projects')
      .select('id, name, location, pool_type, cover_image, images, is_published, sort_order')
      .order('sort_order')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) notify(error.message, 'error');
        setProjects((data as ListRow[]) ?? []);
      });
  }, [notify]);

  const visible = useMemo(() => (projects ?? []).filter(p => !type || p.pool_type === type), [projects, type]);

  return (
    <>
      <PageHeader
        title="Projects"
        description="Completed projects shown in the gallery and on each pool type page."
        actions={<Button onClick={() => navigate('/projects/new')}><Plus className="w-4 h-4" /> New project</Button>}
      />

      {projects && projects.length > 0 && (
        <Select value={type} onChange={e => setType(e.target.value)} className="mb-5 sm:max-w-xs">
          <option value="">All pool types ({projects.length})</option>
          {POOL_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label} ({projects.filter(p => p.pool_type === t.value).length})</option>
          ))}
        </Select>
      )}

      {projects === null ? (
        <LoadingBlock />
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon={Image}
            title={projects.length === 0 ? 'No projects yet' : 'No projects of this type'}
            description={projects.length === 0 ? 'Add a completed project with its photos.' : undefined}
            action={projects.length === 0 && <Button onClick={() => navigate('/projects/new')}><Plus className="w-4 h-4" /> New project</Button>}
          />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map(p => {
            const cover = mediaUrl('projects', p.cover_image ?? p.images[0]?.path);
            return (
              <Link key={p.id} to={`/projects/${p.id}`} className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition">
                <div className="relative aspect-4/3 bg-slate-100">
                  {cover && <img src={cover} alt="" className="w-full h-full object-cover" loading="lazy" />}
                  <div className="absolute top-3 right-3">
                    <Badge tone={p.is_published ? 'green' : 'slate'}>{p.is_published ? 'Published' : 'Hidden'}</Badge>
                  </div>
                </div>
                <div className="p-4">
                  <h2 className="font-semibold text-slate-900 group-hover:text-brand-blue truncate">{p.name}</h2>
                  <div className="mt-1 flex items-center justify-between gap-2 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-1 truncate"><MapPin className="w-3.5 h-3.5 shrink-0" />{p.location || '—'}</span>
                    <span className="whitespace-nowrap">{poolTypeLabel(p.pool_type)} · {p.images.length} photos</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, LayoutTemplate } from 'lucide-react';
import { PAGES, PAGE_GROUPS } from '../../../../src/content';
import { supabase, can } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import PageHeader from '../../components/PageHeader';
import { Badge, EmptyState } from '../../components/ui';

export default function PageList() {
  const { profile } = useAuth();
  const [customised, setCustomised] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase.from('page_content').select('page').then(({ data }) => {
      const counts: Record<string, number> = {};
      for (const row of data ?? []) counts[row.page] = (counts[row.page] ?? 0) + 1;
      setCustomised(counts);
    });
  }, []);

  const visible = useMemo(() => PAGES.filter(p => can(profile, `page:${p.id}`)), [profile]);

  return (
    <>
      <PageHeader title="Pages" description="Edit the text and images on each page of the website. Anything you don't change keeps its original content." />

      {visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState icon={LayoutTemplate} title="No pages assigned" description="Ask a Super Admin to give you access to the pages you should edit." />
        </div>
      ) : (
        <div className="grid gap-8">
          {PAGE_GROUPS.map(group => {
            const pages = visible.filter(p => p.group === group);
            if (!pages.length) return null;
            return (
              <section key={group}>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">{group}</h2>
                <ul className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {pages.map(page => (
                    <li key={page.id}>
                      <Link to={`/pages/${page.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-slate-800">{page.label}</div>
                          <div className="text-xs text-slate-500 truncate">{page.id === 'footer' ? 'Shown on every page' : page.path}</div>
                        </div>
                        {customised[page.id] ? <Badge tone="cyan">{customised[page.id]} edited</Badge> : <Badge>Original</Badge>}
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

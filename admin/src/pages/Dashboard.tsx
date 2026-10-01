import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileText, Image, Inbox, MessageSquareQuote } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase, can } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import PageHeader from '../components/PageHeader';

interface Stats {
  leads_total: number;
  leads_new: number;
  blogs_total: number;
  blogs_published: number;
  blogs_draft: number;
  projects_total: number;
  projects_published: number;
  testimonials_total: number;
}

interface LeadRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  project_type: string;
  status: 'new' | 'contacted' | 'closed';
  created_at: string;
}

const STATUS_STYLES: Record<LeadRow['status'], string> = {
  new: 'bg-cyan-50 text-cyan-800 ring-cyan-200',
  contacted: 'bg-amber-50 text-amber-800 ring-amber-200',
  closed: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function StatCard({ label, value, detail, icon: Icon, to }: {
  label: string;
  value: number | undefined;
  detail?: string;
  icon: LucideIcon;
  to: string;
}) {
  return (
    <Link to={to} className="group bg-white rounded-xl border border-slate-200 p-5 hover:border-brand-cyan/60 hover:shadow-sm transition">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <span className="w-9 h-9 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center">
          <Icon className="w-4.5 h-4.5" />
        </span>
      </div>
      <div className="mt-3 text-3xl font-display font-semibold text-slate-900 tabular-nums">
        {value ?? <span className="inline-block w-12 h-8 rounded bg-slate-100 animate-pulse" />}
      </div>
      <div className="mt-1 h-5 text-sm text-slate-500">{detail}</div>
    </Link>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';
  const [stats, setStats] = useState<Stats | null>(null);
  const [leads, setLeads] = useState<LeadRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('dashboard_stats').then(({ data, error }) => {
      if (error) setError('Could not load dashboard figures.');
      else setStats(data as Stats);
    });
    if (isSuperAdmin) {
      supabase
        .from('leads')
        .select('id, name, email, phone, project_type, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5)
        .then(({ data }) => setLeads((data as LeadRow[]) ?? []));
    }
  }, [isSuperAdmin]);

  const firstName = profile?.full_name.split(' ')[0];

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome, ${firstName}` : 'Dashboard'}
        description="Here's what's happening on the Crystal Pools website."
      />

      {error && <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isSuperAdmin && (
          <StatCard
            label="Total enquiries"
            value={stats?.leads_total}
            detail={stats ? `${stats.leads_new} new` : undefined}
            icon={Inbox}
            to="/enquiries"
          />
        )}
        {can(profile, 'blogs') && <StatCard
          label="Total blogs"
          value={stats?.blogs_total}
          detail={stats ? `${stats.blogs_published} published · ${stats.blogs_draft} drafts` : undefined}
          icon={FileText}
          to="/blogs"
        />}
        {can(profile, 'projects') && <StatCard
          label="Total projects"
          value={stats?.projects_total}
          detail={stats ? `${stats.projects_published} published` : undefined}
          icon={Image}
          to="/projects"
        />}
        {can(profile, 'testimonials') && <StatCard label="Testimonials" value={stats?.testimonials_total} icon={MessageSquareQuote} to="/testimonials" />}
      </div>

      {isSuperAdmin && (
        <section className="mt-8 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <h2 className="font-semibold">Recent enquiries</h2>
            <Link to="/enquiries" className="inline-flex items-center gap-1 text-sm text-brand-blue hover:underline">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {leads === null ? (
            <div className="p-5 space-y-3">
              {[0, 1, 2].map(i => <div key={i} className="h-10 rounded bg-slate-100 animate-pulse" />)}
            </div>
          ) : leads.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              No enquiries yet. Contact form submissions will appear here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Contact</th>
                    <th className="px-5 py-3 font-medium">Project type</th>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map(lead => (
                    <tr key={lead.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-800 whitespace-nowrap">{lead.name}</td>
                      <td className="px-5 py-3 text-slate-600">
                        <div>{lead.email}</div>
                        {lead.phone && <div className="text-xs text-slate-400">{lead.phone}</div>}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{lead.project_type || '—'}</td>
                      <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{dateFormat.format(new Date(lead.created_at))}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${STATUS_STYLES[lead.status]}`}>
                          {lead.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}

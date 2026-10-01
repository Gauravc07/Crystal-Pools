import { useCallback, useEffect, useState } from 'react';
import { Download, Inbox, Mail, Phone, Search, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate, formatDateTime } from '../lib/format';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import { useToast } from '../components/Toast';
import { Badge, ConfirmDialog, EmptyState, LoadingBlock, Modal, Pagination, Select, TextArea, TextInput } from '../components/ui';

type LeadStatus = 'new' | 'contacted' | 'closed';

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  project_type: string;
  message: string;
  source_page: string;
  status: LeadStatus;
  notes: string;
  created_at: string;
}

const STATUSES: { value: LeadStatus; label: string; tone: 'cyan' | 'amber' | 'slate' }[] = [
  { value: 'new', label: 'New', tone: 'cyan' },
  { value: 'contacted', label: 'Contacted', tone: 'amber' },
  { value: 'closed', label: 'Closed', tone: 'slate' },
];
const statusMeta = (s: LeadStatus) => STATUSES.find(x => x.value === s)!;

const PAGE_SIZE = 25;
const COLUMNS = 'id, name, email, phone, project_type, message, source_page, status, notes, created_at';

/** Escapes a value for PostgREST's or() filter syntax. */
const orValue = (v: string) => `"${v.replace(/["\\]/g, '\\$&')}"`;

function applyFilters<T extends { eq: Function; or: Function }>(query: T, status: LeadStatus | 'all', search: string): T {
  let q = query;
  if (status !== 'all') q = q.eq('status', status);
  const term = search.trim();
  if (term) {
    const like = orValue(`%${term}%`);
    q = q.or(`name.ilike.${like},email.ilike.${like},phone.ilike.${like}`);
  }
  return q;
}

function toCsv(rows: Lead[]) {
  const header = ['Date', 'Name', 'Email', 'Phone', 'Project type', 'Message', 'Status', 'Notes', 'Source page'];
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map(r => [
    formatDateTime(r.created_at), r.name, r.email, r.phone, r.project_type, r.message,
    statusMeta(r.status).label, r.notes, r.source_page,
  ].map(v => cell(String(v ?? ''))).join(','));
  return '\uFEFF' + [header.map(cell).join(','), ...lines].join('\r\n');
}

function LeadDetail({ lead, onClose, onSaved, onDeleted }: {
  lead: Lead;
  onClose: () => void;
  onSaved: (lead: Lead) => void;
  onDeleted: (id: string) => void;
}) {
  const notify = useToast();
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [notes, setNotes] = useState(lead.notes);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const dirty = status !== lead.status || notes !== lead.notes;

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase.from('leads').update({ status, notes }).eq('id', lead.id).select(COLUMNS).single();
    setSaving(false);
    if (error) return notify(error.message, 'error');
    notify('Enquiry updated.');
    onSaved(data as Lead);
  };

  const remove = async () => {
    setDeleting(true);
    const { error } = await supabase.from('leads').delete().eq('id', lead.id);
    setDeleting(false);
    if (error) return notify(error.message, 'error');
    notify('Enquiry deleted.');
    onDeleted(lead.id);
  };

  return (
    <>
      <Modal
        open
        wide
        onClose={onClose}
        title={lead.name}
        footer={
          <>
            <Button variant="ghost" className="mr-auto !text-red-600" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="w-4 h-4" /> Delete
            </Button>
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button onClick={save} loading={saving} disabled={!dirty}>Save changes</Button>
          </>
        }
      >
        <dl className="grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd><a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 text-brand-blue hover:underline"><Mail className="w-3.5 h-3.5" />{lead.email}</a></dd>
          </div>
          <div>
            <dt className="text-slate-500">Phone</dt>
            <dd>{lead.phone
              ? <a href={`tel:${lead.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 text-brand-blue hover:underline"><Phone className="w-3.5 h-3.5" />{lead.phone}</a>
              : '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Project type</dt>
            <dd className="text-slate-800">{lead.project_type || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Received</dt>
            <dd className="text-slate-800">{formatDateTime(lead.created_at)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Message</dt>
            <dd className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-slate-800">{lead.message}</dd>
          </div>
          {lead.source_page && (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Submitted from</dt>
              <dd className="text-slate-800">{lead.source_page}</dd>
            </div>
          )}
        </dl>
        <div className="mt-6 grid gap-4">
          <Select label="Status" value={status} onChange={e => setStatus(e.target.value as LeadStatus)}>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
          <TextArea
            label="Internal notes"
            hint="Only visible to admins."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Called on 12 Oct, site visit scheduled…"
          />
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete enquiry?"
        message={<>This permanently deletes the enquiry from <strong>{lead.name}</strong>. This cannot be undone.</>}
        loading={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

export default function Enquiries() {
  const notify = useToast();
  const [status, setStatus] = useState<LeadStatus | 'all'>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Lead[] | null>(null);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<LeadStatus | 'all', number>>({ all: 0, new: 0, contacted: 0, closed: 0 });
  const [selected, setSelected] = useState<Lead | null>(null);
  const [exporting, setExporting] = useState(false);

  // Debounce search typing
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadCounts = useCallback(async () => {
    const results = await Promise.all(
      (['all', 'new', 'contacted', 'closed'] as const).map(s =>
        applyFilters(supabase.from('leads').select('id', { count: 'exact', head: true }), s, '').then(r => [s, r.count ?? 0] as const),
      ),
    );
    setCounts(Object.fromEntries(results) as Record<LeadStatus | 'all', number>);
  }, []);

  const load = useCallback(async () => {
    setRows(null);
    const { data, count, error } = await applyFilters(
      supabase.from('leads').select(COLUMNS, { count: 'exact' }),
      status,
      search,
    )
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) {
      notify(error.message, 'error');
      setRows([]);
      return;
    }
    setRows(data as Lead[]);
    setTotal(count ?? 0);
  }, [status, search, page, notify]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCounts(); }, [loadCounts]);

  const exportCsv = async () => {
    setExporting(true);
    const { data, error } = await applyFilters(supabase.from('leads').select(COLUMNS), status, search)
      .order('created_at', { ascending: false })
      .limit(5000);
    setExporting(false);
    if (error) return notify(error.message, 'error');
    const blob = new Blob([toCsv(data as Lead[])], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `crystal-pools-enquiries-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const tabs: { value: LeadStatus | 'all'; label: string }[] = [{ value: 'all', label: 'All' }, ...STATUSES];

  return (
    <>
      <PageHeader
        title="Enquiries"
        description="Leads submitted through the website contact form."
        actions={
          <Button variant="secondary" onClick={exportCsv} loading={exporting} disabled={total === 0}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex flex-col gap-3 p-4 border-b border-slate-200 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(t => (
              <button
                key={t.value}
                onClick={() => { setStatus(t.value); setPage(0); }}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                  status === t.value ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t.label} <span className="ml-1 opacity-70 tabular-nums">{counts[t.value]}</span>
              </button>
            ))}
          </div>
          <div className="relative md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <TextInput
              placeholder="Search name, email or phone"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {rows === null ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={search || status !== 'all' ? 'No matching enquiries' : 'No enquiries yet'}
            description={search || status !== 'all' ? 'Try a different filter or search.' : 'Contact form submissions will appear here.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500 bg-slate-50">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Contact</th>
                  <th className="px-5 py-3 font-medium hidden lg:table-cell">Message</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(lead => (
                  <tr key={lead.id} onClick={() => setSelected(lead)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-800">{lead.name}</div>
                      {lead.project_type && <div className="text-xs text-slate-400">{lead.project_type}</div>}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      <div>{lead.email}</div>
                      {lead.phone && <div className="text-xs text-slate-400">{lead.phone}</div>}
                    </td>
                    <td className="px-5 py-3 text-slate-600 hidden lg:table-cell max-w-xs">
                      <p className="truncate">{lead.message}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{formatDate(lead.created_at)}</td>
                    <td className="px-5 py-3"><Badge tone={statusMeta(lead.status).tone}>{statusMeta(lead.status).label}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
      </div>

      {selected && (
        <LeadDetail
          lead={selected}
          onClose={() => setSelected(null)}
          onSaved={updated => {
            setSelected(null);
            setRows(prev => prev?.map(r => (r.id === updated.id ? updated : r)) ?? null);
            loadCounts();
          }}
          onDeleted={id => {
            setSelected(null);
            setRows(prev => prev?.filter(r => r.id !== id) ?? null);
            setTotal(t => t - 1);
            loadCounts();
          }}
        />
      )}
    </>
  );
}

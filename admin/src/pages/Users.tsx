import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, KeyRound, ShieldCheck, Trash2, UserPlus, Users as UsersIcon } from 'lucide-react';
import { PAGES, PAGE_GROUPS } from '../../../src/content';
import { supabase, ROLE_LABELS } from '../lib/supabase';
import type { Profile, Role } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { formatDate } from '../lib/format';
import { SECTION_PERMISSIONS } from '../nav';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import Field from '../components/Field';
import { useToast } from '../components/Toast';
import { Badge, ConfirmDialog, EmptyState, LoadingBlock, Modal, Select, Toggle } from '../components/ui';

type UserRow = Profile & { created_at: string };

const DEFAULT_EDITOR_PERMISSIONS = ['blogs', 'projects', 'testimonials'];

/** Postgres errors from the admin_* functions are already written for people. */
const friendly = (message: string) => (/permission denied|42501/i.test(message) ? 'Only Super Admins can do this.' : message);

function TempPassword({ email, password }: { email: string; password: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(`Email: ${email}\nTemporary password: ${password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="space-y-3 text-sm">
      <p className="text-slate-600">
        Share these sign-in details with the user privately. The password is shown <strong>only once</strong>, and they
        must choose a new one when they first sign in.
      </p>
      <div className="rounded-lg bg-slate-50 p-4 space-y-2">
        <div><span className="text-slate-500">Email: </span><span className="font-medium">{email}</span></div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-500">Temporary password: </span>
          <code className="rounded bg-white px-2 py-1 font-mono ring-1 ring-slate-200">{password}</code>
        </div>
      </div>
      <Button variant="secondary" onClick={copy} className="!py-2">
        {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied' : 'Copy sign-in details'}
      </Button>
    </div>
  );
}

/** Checkbox lists for an Editor's sections and pages. */
function PermissionPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const has = (p: string) => value.includes(p);
  const toggle = (p: string) => onChange(has(p) ? value.filter(x => x !== p) : [...value, p]);
  const pageKeys = PAGES.map(p => `page:${p.id}`);
  const allPages = pageKeys.every(has);

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">Sections</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {SECTION_PERMISSIONS.map(s => (
            <label key={s.value} className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
              <input type="checkbox" checked={has(s.value)} onChange={() => toggle(s.value)} className="mt-0.5 accent-[#0a5c86]" />
              <span>
                <span className="block text-slate-800">{s.label}</span>
                {s.hint && <span className="block text-xs text-slate-500">{s.hint}</span>}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-slate-700">Website pages they can edit</p>
          <button
            type="button"
            onClick={() => onChange(allPages ? value.filter(p => !p.startsWith('page:')) : [...new Set([...value, ...pageKeys])])}
            className="text-xs font-medium text-brand-blue hover:underline"
          >
            {allPages ? 'Clear all pages' : 'Select all pages'}
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
          {PAGE_GROUPS.map(group => (
            <div key={group} className="px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{group}</p>
              <div className="grid sm:grid-cols-2 gap-x-4">
                {PAGES.filter(p => p.group === group).map(p => (
                  <label key={p.id} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
                    <input type="checkbox" checked={has(`page:${p.id}`)} onChange={() => toggle(`page:${p.id}`)} className="accent-[#0a5c86]" />
                    <span className="text-slate-700 truncate">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AddUser({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const notify = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [permissions, setPermissions] = useState<string[]>(DEFAULT_EDITOR_PERMISSIONS);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    const { data, error } = await supabase.rpc('admin_create_user', {
      p_email: email, p_full_name: fullName, p_role: role, p_permissions: role === 'editor' ? permissions : [],
    });
    setSaving(false);
    if (error) return notify(friendly(error.message), 'error');
    setCreated((data as { temp_password: string }).temp_password);
    onCreated();
  };

  return (
    <Modal
      open
      wide={!created}
      onClose={onClose}
      title={created ? 'User created' : 'Add user'}
      footer={created
        ? <Button onClick={onClose}>Done</Button>
        : <><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={saving}>Create user</Button></>}
    >
      {created ? (
        <TempPassword email={email.trim().toLowerCase()} password={created} />
      ) : (
        <form className="grid gap-4" onSubmit={e => { e.preventDefault(); submit(); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" value={fullName} onChange={e => setFullName(e.target.value)} required />
            <Field label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <Select
            label="Role"
            value={role}
            onChange={e => setRole(e.target.value as Role)}
            hint={role === 'super_admin' ? 'Full access to everything, including enquiries, settings and users.' : 'Can only use the sections and pages ticked below.'}
          >
            <option value="editor">Editor</option>
            <option value="super_admin">Super Admin</option>
          </Select>
          {role === 'editor' && <PermissionPicker value={permissions} onChange={setPermissions} />}
        </form>
      )}
    </Modal>
  );
}

function EditAccess({ user, onClose, onSaved }: { user: UserRow; onClose: () => void; onSaved: () => void }) {
  const notify = useToast();
  const [permissions, setPermissions] = useState<string[]>(user.permissions);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ permissions }).eq('id', user.id);
    setSaving(false);
    if (error) return notify(friendly(error.message), 'error');
    notify(`Access updated for ${user.full_name}.`);
    onSaved();
  };

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={`Access — ${user.full_name || user.email}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Save access</Button></>}
    >
      <PermissionPicker value={permissions} onChange={setPermissions} />
    </Modal>
  );
}

function accessSummary(u: UserRow) {
  if (u.role === 'super_admin') return 'Everything';
  const sections = SECTION_PERMISSIONS.filter(s => u.permissions.includes(s.value)).map(s => s.label);
  const pages = u.permissions.filter(p => p.startsWith('page:')).length;
  const parts = [...sections, pages ? `${pages} page${pages > 1 ? 's' : ''}` : ''].filter(Boolean);
  return parts.length ? parts.join(', ') : 'No access yet';
}

export default function Users() {
  const { profile: me } = useAuth();
  const notify = useToast();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingAccess, setEditingAccess] = useState<UserRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reset, setReset] = useState<{ email: string; password: string } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'reset' | 'delete'; user: UserRow } | null>(null);

  const load = useCallback(() => {
    supabase
      .from('profiles')
      .select('id, email, full_name, role, is_active, must_change_password, permissions, created_at')
      .order('created_at')
      .then(({ data, error }) => {
        if (error) notify(error.message, 'error');
        setUsers((data as UserRow[]) ?? []);
      });
  }, [notify]);

  useEffect(load, [load]);

  const changeRole = async (user: UserRow, role: Role) => {
    setBusy(user.id);
    // A new Editor starts with the standard sections; a Super Admin doesn't need a list.
    const permissions = role === 'editor' ? (user.permissions.length ? user.permissions : DEFAULT_EDITOR_PERMISSIONS) : user.permissions;
    const { error } = await supabase.from('profiles').update({ role, permissions }).eq('id', user.id);
    setBusy(null);
    if (error) return notify(friendly(error.message), 'error');
    notify(`${user.full_name} is now ${role === 'editor' ? 'an Editor' : 'a Super Admin'}.`);
    load();
  };

  const setActive = async (user: UserRow, isActive: boolean) => {
    setBusy(user.id);
    const { error } = await supabase.rpc('admin_set_active', { p_user_id: user.id, p_active: isActive });
    setBusy(null);
    if (error) return notify(friendly(error.message), 'error');
    notify(isActive ? `${user.full_name} can sign in again.` : `${user.full_name} has been signed out and can no longer sign in.`);
    load();
  };

  const runConfirmed = async () => {
    if (!confirm) return;
    const { kind, user } = confirm;
    setBusy(user.id);
    if (kind === 'reset') {
      const { data, error } = await supabase.rpc('admin_reset_password', { p_user_id: user.id });
      if (error) notify(friendly(error.message), 'error');
      else setReset({ email: user.email, password: data as string });
    } else {
      const { error } = await supabase.rpc('admin_delete_user', { p_user_id: user.id });
      if (error) notify(friendly(error.message), 'error');
      else notify(`${user.full_name} was deleted.`);
    }
    setBusy(null);
    setConfirm(null);
    load();
  };

  return (
    <>
      <PageHeader
        title="Users"
        description="People who can sign in to this admin panel, their role and what they can access."
        actions={<Button onClick={() => setAdding(true)}><UserPlus className="w-4 h-4" /> Add user</Button>}
      />

      <div className="bg-white rounded-xl border border-slate-200">
        {users === null ? (
          <LoadingBlock />
        ) : users.length === 0 ? (
          <EmptyState icon={UsersIcon} title="No users" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500 bg-slate-50">
                <tr>
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Access</th>
                  <th className="px-5 py-3 font-medium">Sign-in</th>
                  <th className="px-5 py-3 font-medium hidden md:table-cell">Added</th>
                  <th className="px-5 py-3 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => {
                  const isMe = u.id === me?.id;
                  return (
                    <tr key={u.id} className={busy === u.id ? 'opacity-60' : ''}>
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-800">
                          {u.full_name || '—'} {isMe && <span className="text-xs font-normal text-slate-400">(you)</span>}
                        </div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                        {u.must_change_password && <div className="mt-1"><Badge tone="amber">Awaiting first sign-in</Badge></div>}
                      </td>
                      <td className="px-5 py-3">
                        <Select
                          aria-label={`Role for ${u.full_name}`}
                          value={u.role}
                          disabled={isMe || busy === u.id}
                          onChange={e => changeRole(u, e.target.value as Role)}
                          className="w-36"
                        >
                          <option value="super_admin">{ROLE_LABELS.super_admin}</option>
                          <option value="editor">{ROLE_LABELS.editor}</option>
                        </Select>
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-slate-600 max-w-56">{accessSummary(u)}</div>
                        {u.role === 'editor' && (
                          <button onClick={() => setEditingAccess(u)} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-blue hover:underline">
                            <ShieldCheck className="w-3.5 h-3.5" /> Edit access
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Toggle
                          checked={u.is_active}
                          disabled={isMe || busy === u.id}
                          onChange={v => setActive(u, v)}
                          label={u.is_active ? 'Allowed' : 'Disabled'}
                        />
                      </td>
                      <td className="px-5 py-3 text-slate-500 whitespace-nowrap hidden md:table-cell">{formatDate(u.created_at)}</td>
                      <td className="px-5 py-3">
                        {!isMe && (
                          <div className="flex justify-end gap-1">
                            <button onClick={() => setConfirm({ kind: 'reset', user: u })} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" title="Reset password" aria-label="Reset password">
                              <KeyRound className="w-4 h-4" />
                            </button>
                            <button onClick={() => setConfirm({ kind: 'delete', user: u })} className="p-2 rounded-lg text-red-500 hover:bg-red-50" title="Delete user" aria-label="Delete user">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adding && <AddUser onClose={() => setAdding(false)} onCreated={load} />}
      {editingAccess && <EditAccess user={editingAccess} onClose={() => setEditingAccess(null)} onSaved={() => { setEditingAccess(null); load(); }} />}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.kind === 'reset' ? 'Reset password?' : 'Delete user?'}
        confirmLabel={confirm?.kind === 'reset' ? 'Reset password' : 'Delete'}
        message={confirm?.kind === 'reset'
          ? <>A new temporary password will be created for <strong>{confirm.user.full_name}</strong>. They are signed out everywhere and their current password stops working.</>
          : <><strong>{confirm?.user.full_name}</strong> will lose access permanently. Content they created is kept.</>}
        loading={!!busy}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />

      <Modal open={!!reset} onClose={() => setReset(null)} title="Password reset" footer={<Button onClick={() => setReset(null)}>Done</Button>}>
        {reset && <TempPassword email={reset.email} password={reset.password} />}
      </Modal>
    </>
  );
}

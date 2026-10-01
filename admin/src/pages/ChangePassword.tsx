import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import AuthCard from '../components/AuthCard';
import PasswordForm from '../components/PasswordForm';
import PageHeader from '../components/PageHeader';

/** Forced on first login (standalone screen), otherwise available from the account menu. */
export default function ChangePassword() {
  const { profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);

  if (profile?.must_change_password) {
    return (
      <AuthCard title="Set your password" subtitle="For security, choose a new password before continuing.">
        <PasswordForm
          submitLabel="Save and continue"
          onDone={async () => {
            await refreshProfile();
            navigate('/', { replace: true });
          }}
        />
        <button onClick={signOut} className="block w-full mt-4 text-center text-sm text-slate-500 hover:text-slate-700">
          Sign out
        </button>
      </AuthCard>
    );
  }

  return (
    <>
      <PageHeader title="Change password" description="Update the password you use to sign in." />
      <div className="max-w-md bg-white rounded-xl border border-slate-200 p-6">
        {saved && (
          <div className="mb-5 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircle2 className="w-4 h-4" /> Password updated.
          </div>
        )}
        <PasswordForm key={String(saved)} submitLabel="Update password" onDone={() => setSaved(true)} />
      </div>
    </>
  );
}

import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { FullPageSpinner } from '../auth/guards';
import AuthCard from '../components/AuthCard';
import PasswordForm from '../components/PasswordForm';

// Landing page for the emailed reset link. supabase-js reads the recovery token
// from the URL and signs the user in; they then choose a new password here.
export default function ResetPassword() {
  const { session, refreshProfile } = useAuth();
  const navigate = useNavigate();

  if (session === undefined) return <FullPageSpinner />;

  if (!session) {
    return (
      <AuthCard title="Link expired" subtitle="This reset link is invalid or has already been used.">
        <Link to="/forgot-password" className="block text-center text-sm text-brand-blue hover:underline">Request a new link</Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password">
      <PasswordForm
        submitLabel="Save password"
        onDone={async () => {
          await refreshProfile();
          navigate('/', { replace: true });
        }}
      />
    </AuthCard>
  );
}

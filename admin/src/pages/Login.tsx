import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import AuthCard from '../components/AuthCard';
import Field, { FormError } from '../components/Field';
import Button from '../components/Button';

export default function Login() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (session) return <Navigate to={from} replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      // Same message for unknown email and wrong password
      setError(error.status === 429 ? 'Too many attempts. Please wait a minute and try again.' : 'Incorrect email or password.');
      return;
    }
    navigate(from, { replace: true });
  };

  return (
    <AuthCard title="Sign in" subtitle="Use the email and password you were given.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
        <Field label="Password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
        <FormError message={error} />
        <Button type="submit" loading={loading} className="w-full">Sign in</Button>
      </form>
      <div className="mt-5 text-center">
        <Link to="/forgot-password" className="text-sm text-brand-blue hover:underline">Forgot password?</Link>
      </div>
    </AuthCard>
  );
}

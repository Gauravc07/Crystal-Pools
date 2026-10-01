import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AuthCard from '../components/AuthCard';
import Field, { FormError } from '../components/Field';
import Button from '../components/Button';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error?.status === 429) {
      setError('Too many requests. Please wait a few minutes and try again.');
      return;
    }
    // Don't reveal whether the email has an account
    setSent(true);
  };

  if (sent) {
    return (
      <AuthCard title="Check your email">
        <div className="flex items-start gap-3 rounded-lg bg-cyan-50 p-3 text-sm text-cyan-900">
          <MailCheck className="w-5 h-5 shrink-0" />
          <p>If an admin account exists for <strong>{email}</strong>, a password reset link has been sent to it.</p>
        </div>
        <Link to="/login" className="block mt-5 text-center text-sm text-brand-blue hover:underline">Back to sign in</Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset password" subtitle="Enter your email and we'll send you a reset link.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
        <FormError message={error} />
        <Button type="submit" loading={loading} className="w-full">Send reset link</Button>
      </form>
      <Link to="/login" className="block mt-5 text-center text-sm text-brand-blue hover:underline">Back to sign in</Link>
    </AuthCard>
  );
}

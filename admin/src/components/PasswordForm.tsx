import { useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import Field, { FormError } from './Field';
import Button from './Button';

const MIN_LENGTH = 10;

function validate(password: string, confirm: string): string | null {
  if (password.length < MIN_LENGTH) return `Password must be at least ${MIN_LENGTH} characters.`;
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return 'Password must contain letters and numbers.';
  if (password !== confirm) return 'Passwords do not match.';
  return null;
}

/** Sets a new password for the signed-in user and clears the "must change" flag. */
export default function PasswordForm({ submitLabel, onDone }: { submitLabel: string; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const invalid = validate(password, confirm);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      setError(error.code === 'same_password' ? 'New password must be different from the current one.' : error.message);
      return;
    }
    await supabase.rpc('clear_must_change_password');
    setLoading(false);
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        value={password}
        onChange={e => setPassword(e.target.value)}
        hint={`At least ${MIN_LENGTH} characters, with letters and numbers.`}
      />
      <Field label="Confirm new password" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} />
      <FormError message={error} />
      <Button type="submit" loading={loading} className="w-full">{submitLabel}</Button>
    </form>
  );
}

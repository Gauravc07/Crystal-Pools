import { useId, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export default function Field({ label, hint, type = 'text', className = '', ...rest }: Props) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && reveal ? 'text' : type}
          {...rest}
          className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900
            placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 focus:border-brand-cyan
            ${isPassword ? 'pr-10' : ''}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal(r => !r)}
            className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-600"
            aria-label={reveal ? 'Hide password' : 'Show password'}
          >
            {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>;
}

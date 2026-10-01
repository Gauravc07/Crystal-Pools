import { useEffect, useId } from 'react';
import type { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { X } from 'lucide-react';
import Button from './Button';

const inputClass = `w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900
  placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 focus:border-brand-cyan
  disabled:bg-slate-50 disabled:text-slate-500`;

export function Label({ htmlFor, children, extra }: { htmlFor?: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between mb-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">{children}</label>
      {extra && <span className="text-xs text-slate-400">{extra}</span>}
    </div>
  );
}

export function CharCount({ value, max }: { value: string; max: number }) {
  return <span className={value.length > max ? 'text-amber-600' : ''}>{value.length}/{max}</span>;
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  extra?: ReactNode;
}

export function TextArea({ label, hint, extra, className = '', ...rest }: TextAreaProps) {
  const id = useId();
  return (
    <div className={className}>
      <Label htmlFor={id} extra={extra}>{label}</Label>
      <textarea id={id} {...rest} className={`${inputClass} min-h-24`} />
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
}

export function Select({ label, hint, className = '', children, ...rest }: SelectProps) {
  const id = useId();
  return (
    <div className={className}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <select id={id} {...rest} className={inputClass}>{children}</select>
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function Toggle({ checked, onChange, label, description, disabled }: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand-blue' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
      </button>
      <span>
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </span>
    </label>
  );
}

export function Card({ title, description, children, className = '' }: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-white rounded-xl border border-slate-200 p-5 sm:p-6 ${className}`}>
      {title && <h2 className="font-semibold text-slate-900">{title}</h2>}
      {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      <div className={title || description ? 'mt-5' : ''}>{children}</div>
    </section>
  );
}

type BadgeTone = 'cyan' | 'green' | 'amber' | 'slate' | 'red';

const TONES: Record<BadgeTone, string> = {
  cyan: 'bg-cyan-50 text-cyan-800 ring-cyan-200',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
};

export function Badge({ tone = 'slate', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="mx-auto w-12 h-12 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ className = 'w-6 h-6' }: { className?: string }) {
  return <span className={`inline-block border-2 border-brand-blue border-t-transparent rounded-full animate-spin ${className}`} />;
}

export function LoadingBlock() {
  return (
    <div className="flex justify-center py-16">
      <Spinner />
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92vh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-xl`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-5 overflow-y-auto">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', loading, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button onClick={onConfirm} loading={loading} className="!bg-red-600 hover:!bg-red-700">{confirmLabel}</Button>
        </>
      }
    >
      <div className="text-sm text-slate-600">{message}</div>
    </Modal>
  );
}

export function Pagination({ page, pageSize, total, onChange }: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 text-sm text-slate-500">
      <span>{from}–{to} of {total}</span>
      <div className="flex gap-2">
        <Button variant="secondary" className="!py-1.5" disabled={page === 0} onClick={() => onChange(page - 1)}>Previous</Button>
        <Button variant="secondary" className="!py-1.5" disabled={page >= pages - 1} onClick={() => onChange(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

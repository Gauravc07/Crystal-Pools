import type { ReactNode } from 'react';
import { Droplets } from 'lucide-react';

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-lg bg-brand-blue flex items-center justify-center">
        <Droplets className="w-5 h-5 text-white" />
      </div>
      <div className="leading-tight">
        <div className={`font-display font-semibold ${light ? 'text-white' : 'text-slate-900'}`}>Crystal Pools</div>
        <div className={`text-xs ${light ? 'text-slate-400' : 'text-slate-500'}`}>Admin Panel</div>
      </div>
    </div>
  );
}

export default function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-br from-slate-50 via-white to-cyan-50">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Wordmark />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

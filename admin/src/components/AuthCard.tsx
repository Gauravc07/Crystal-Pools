import type { ReactNode } from 'react';

/** Crystal Pools logo + 'Admin Panel' label. On dark backgrounds the logo sits on a white tile. */
export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`shrink-0 rounded-xl ${light ? 'bg-white p-1 shadow-sm' : ''}`}>
        <img src="/logo.png" alt="Crystal Pools" className="w-11 h-11 object-contain" />
      </div>
      <div className="leading-tight">
        <div className={`font-display font-semibold ${light ? 'text-white' : 'text-slate-900'}`}>Crystal Pools</div>
        <div className={`text-xs ${light ? 'text-slate-400' : 'text-slate-500'}`}>Admin Panel</div>
      </div>
    </div>
  );
}

/** Full logo for the sign-in screens. */
function BrandLogo() {
  return (
    <div className="flex flex-col items-center">
      <img src="/logo.png" alt="Crystal Pools — Committed to excellence" className="w-44 h-auto" />
      <span className="mt-1 text-xs font-medium uppercase tracking-[0.25em] text-slate-400">Admin Panel</span>
    </div>
  );
}

export default function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-br from-slate-50 via-white to-cyan-50">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <BrandLogo />
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

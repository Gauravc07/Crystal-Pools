import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

type Tone = 'success' | 'error';
interface ToastItem { id: number; message: string; tone: Tone }

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const notify = useCallback((message: string, tone: Tone = 'success') => {
    const id = Date.now() + Math.random();
    setItems(prev => [...prev, { id, message, tone }]);
    setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), tone === 'error' ? 6000 : 3500);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[60] flex flex-col gap-2 sm:w-96" aria-live="polite">
        {items.map(t => (
          <div
            key={t.id}
            className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm shadow-lg ring-1 ${
              t.tone === 'success' ? 'bg-white text-slate-800 ring-slate-200' : 'bg-red-50 text-red-800 ring-red-200'
            }`}
          >
            {t.tone === 'success'
              ? <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
              : <AlertCircle className="w-4.5 h-4.5 shrink-0" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

import { useRef, useState } from 'react';
import { FileText, RefreshCw, RotateCcw, Trash2, Upload } from 'lucide-react';
import { mediaUrl, uploadFile } from '../../lib/storage';
import { useToast } from '../../components/Toast';
import { Spinner } from '../../components/ui';

interface Props {
  pageId: string;
  kind: 'image' | 'file';
  /** Current value: a storage path, a website path (/images/...), or '' for none */
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
  /** Allow clearing to "none" (optional images, datasheets) */
  allowEmpty?: boolean;
  disabled?: boolean;
}

const ACCEPT = { image: 'image/jpeg,image/png,image/webp', file: 'application/pdf' };

/** Image / PDF picker for page content. Uploads into the "pages" bucket under the page's folder. */
export default function MediaField({ pageId, kind, value, defaultValue, onChange, allowEmpty, disabled }: Props) {
  const notify = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const url = mediaUrl('pages', value);
  const isDefault = value === defaultValue;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      onChange(await uploadFile('pages', file, `${pageId}/${kind === 'image' ? 'images' : 'files'}`, { optimize: kind === 'image' }));
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const fileName = value ? decodeURIComponent(value.split('/').pop() ?? '') : '';

  return (
    <div>
      {kind === 'image' ? (
        <div className="relative w-full max-w-sm aspect-video overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          {url
            ? <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
            : <div className="flex h-full items-center justify-center text-xs text-slate-400">No image</div>}
          {isDefault && url && (
            <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-slate-600">Built-in</span>
          )}
          {uploading && <div className="absolute inset-0 flex items-center justify-center bg-white/70"><Spinner /></div>}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm max-w-sm">
          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
          {url
            ? <a href={url} target="_blank" rel="noreferrer" className="truncate text-brand-blue hover:underline">{fileName}</a>
            : <span className="text-slate-400">No file</span>}
          {uploading && <Spinner className="w-4 h-4 ml-auto" />}
        </div>
      )}

      {!disabled && (
        <div className="mt-2 flex flex-wrap gap-3">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-blue hover:underline">
            {url ? <RefreshCw className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />} {url ? 'Replace' : 'Upload'}
          </button>
          {!isDefault && defaultValue && (
            <button type="button" onClick={() => onChange(defaultValue)} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:underline">
              <RotateCcw className="w-3.5 h-3.5" /> Use built-in
            </button>
          )}
          {allowEmpty && value && (
            <button type="button" onClick={() => onChange('')} className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:underline">
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </button>
          )}
        </div>
      )}
      <input ref={inputRef} type="file" accept={ACCEPT[kind]} hidden onChange={e => handleFile(e.target.files?.[0])} />
    </div>
  );
}

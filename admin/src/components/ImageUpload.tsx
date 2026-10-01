import { useRef, useState } from 'react';
import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { mediaUrl, uploadFile } from '../lib/storage';
import type { Bucket } from '../lib/storage';
import { useToast } from './Toast';
import { Label, Spinner } from './ui';

interface Props {
  label: string;
  bucket: Bucket;
  folder: string;
  value: string | null;
  onChange: (value: string | null) => void;
  hint?: string;
  accept?: string;
  /** 'image' shows a thumbnail, 'video' a player */
  kind?: 'image' | 'video';
  aspect?: string;
  disabled?: boolean;
}

/**
 * Single-file upload with preview. Uploads immediately and reports the storage path.
 * Replaced files are left in storage until the record is saved, so "Cancel" never breaks the live site.
 */
export default function ImageUpload({
  label, bucket, folder, value, onChange, hint, accept = 'image/jpeg,image/png,image/webp',
  kind = 'image', aspect = 'aspect-video', disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const notify = useToast();
  const url = mediaUrl(bucket, value);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadFile(bucket, file, folder, { optimize: kind === 'image' });
      onChange(path);
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <Label>{label}</Label>
      <div className={`relative ${aspect} w-full overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50`}>
        {url ? (
          kind === 'video'
            ? <video src={url} className="h-full w-full object-cover" muted loop autoPlay playsInline />
            : <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed"
          >
            <ImagePlus className="w-6 h-6" />
            Click to upload
          </button>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Spinner />
          </div>
        )}
      </div>
      {url && !disabled && (
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-blue hover:underline">
            <RefreshCw className="w-3.5 h-3.5" /> Replace
          </button>
          <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:underline">
            <Trash2 className="w-3.5 h-3.5" /> Remove
          </button>
        </div>
      )}
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
      <input ref={inputRef} type="file" accept={accept} hidden onChange={e => handleFile(e.target.files?.[0])} />
    </div>
  );
}

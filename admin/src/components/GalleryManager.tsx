import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, Star, Trash2 } from 'lucide-react';
import { mediaUrl, uploadFile } from '../lib/storage';
import type { Bucket } from '../lib/storage';
import type { GalleryImage } from '../lib/projects';
import { useToast } from './Toast';
import { Spinner } from './ui';
import Button from './Button';

interface Props {
  bucket: Bucket;
  folder: string;
  images: GalleryImage[];
  onChange: (images: GalleryImage[]) => void;
  cover?: string | null;
  onSetCover?: (path: string) => void;
  disabled?: boolean;
}

/** Multi-image upload with ordering, alt text and "set as cover". */
export default function GalleryManager({ bucket, folder, images, onChange, cover, onSetCover, disabled }: Props) {
  const notify = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    setProgress({ done: 0, total: list.length });
    const added: GalleryImage[] = [];
    for (const file of list) {
      try {
        const path = await uploadFile(bucket, file, folder);
        added.push({ path, alt: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') });
      } catch (err) {
        notify(`${file.name}: ${(err as Error).message}`, 'error');
      }
      setProgress(p => (p ? { ...p, done: p.done + 1 } : p));
    }
    onChange([...images, ...added]);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const move = (index: number, delta: number) => {
    const next = [...images];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange(next);
  };

  const setAlt = (index: number, alt: string) => onChange(images.map((img, i) => (i === index ? { ...img, alt } : img)));

  return (
    <div>
      {images.length > 0 && (
        <ul className="grid gap-4 grid-cols-2 md:grid-cols-3">
          {images.map((img, i) => {
            const isCover = cover === img.path;
            return (
              <li key={img.path} className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                <div className="relative aspect-4/3 bg-slate-100">
                  <img src={mediaUrl(bucket, img.path) ?? ''} alt={img.alt} className="w-full h-full object-cover" loading="lazy" />
                  {isCover && (
                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-brand-gold px-2 py-0.5 text-xs font-medium text-slate-900">
                      <Star className="w-3 h-3 fill-current" /> Cover
                    </span>
                  )}
                </div>
                <div className="p-2 space-y-2">
                  <input
                    value={img.alt}
                    onChange={e => setAlt(i, e.target.value)}
                    disabled={disabled}
                    placeholder="Describe the photo"
                    aria-label="Image description"
                    className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-cyan/40"
                  />
                  {!disabled && (
                    <div className="flex items-center justify-between">
                      <div className="flex">
                        <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="p-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Move left">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button type="button" disabled={i === images.length - 1} onClick={() => move(i, 1)} className="p-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Move right">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex">
                        {onSetCover && !isCover && (
                          <button type="button" onClick={() => onSetCover(img.path)} className="p-1 rounded text-slate-500 hover:bg-slate-100" title="Set as cover" aria-label="Set as cover">
                            <Star className="w-4 h-4" />
                          </button>
                        )}
                        <button type="button" onClick={() => onChange(images.filter((_, j) => j !== i))} className="p-1 rounded text-red-500 hover:bg-red-50" aria-label="Remove image">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!disabled && (
        <div className={images.length ? 'mt-4' : ''}>
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={!!progress}>
            {progress ? <><Spinner className="w-4 h-4" /> Uploading {progress.done}/{progress.total}…</> : <><ImagePlus className="w-4 h-4" /> Add photos</>}
          </Button>
          <p className="mt-2 text-xs text-slate-500">Select several at once. JPG, PNG or WebP, max 5 MB each — large photos are resized automatically.</p>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e => addFiles(e.target.files)} />
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, Search } from 'lucide-react';
import { listLibrary, uploadToLibrary } from '../lib/library';
import type { LibraryImage } from '../lib/library';
import { mediaUrl } from '../lib/storage';
import { useToast } from './Toast';
import { LoadingBlock, Modal, Spinner, TextInput } from './ui';
import Button from './Button';

/** Modal to pick an image from the shared library (or upload new ones into it). */
export default function LibraryPicker({ open, onClose, onSelect }: {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
}) {
  const notify = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<LibraryImage[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = () => listLibrary().then(setImages).catch(err => { notify(err.message, 'error'); setImages([]); });

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    load();
  }, [open]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    let last: string | null = null;
    for (const file of Array.from(files)) {
      try { last = await uploadToLibrary(file); } catch (err) { notify(`${file.name}: ${(err as Error).message}`, 'error'); }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
    await load();
    if (last) setSelected(last);
  };

  const visible = (images ?? []).filter(i => i.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <Modal
      open={open}
      wide
      onClose={onClose}
      title="Choose from library"
      footer={
        <>
          <Button variant="secondary" className="mr-auto" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Spinner className="w-4 h-4" /> : <ImagePlus className="w-4 h-4" />} Upload new
          </Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { if (selected) { onSelect(selected); onClose(); } }} disabled={!selected}>Use image</Button>
        </>
      }
    >
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <TextInput placeholder="Search by file name" value={query} onChange={e => setQuery(e.target.value)} className="pl-9 !py-2" />
      </div>
      {images === null ? (
        <LoadingBlock />
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          {images.length ? 'No images match.' : 'The library is empty. Upload images to reuse them on any page.'}
        </p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {visible.map(img => {
            const isSelected = selected === img.path;
            return (
              <li key={img.path}>
                <button
                  type="button"
                  onClick={() => setSelected(img.path)}
                  className={`relative block w-full overflow-hidden rounded-lg border-2 ${isSelected ? 'border-brand-blue' : 'border-transparent hover:border-slate-300'}`}
                >
                  <img src={mediaUrl('pages', img.path) ?? ''} alt="" loading="lazy" className="aspect-video w-full object-cover bg-slate-100" />
                  {isSelected && <span className="absolute right-2 top-2 rounded-full bg-brand-blue p-1 text-white"><Check className="w-3.5 h-3.5" /></span>}
                </button>
                <p className="mt-1 truncate text-xs text-slate-500" title={img.name}>{img.name}</p>
              </li>
            );
          })}
        </ul>
      )}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" multiple hidden onChange={e => upload(e.target.files)} />
    </Modal>
  );
}

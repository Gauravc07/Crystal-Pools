import { supabase } from './supabase';
import { uploadFile } from './storage';

/** Shared image library: files in the "pages" bucket under library/. Stored values are "library/<file>". */
export interface LibraryImage {
  path: string;
  name: string;
  size: number;
  created_at: string;
}

export async function listLibrary(): Promise<LibraryImage[]> {
  const { data, error } = await supabase.storage.from('pages').list('library', {
    limit: 1000,
    sortBy: { column: 'created_at', order: 'desc' },
  });
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter(f => f.id && f.name !== '.emptyFolderPlaceholder')
    .map(f => ({
      path: `library/${f.name}`,
      name: f.name,
      size: (f.metadata as { size?: number } | null)?.size ?? 0,
      created_at: f.created_at ?? '',
    }));
}

export const uploadToLibrary = (file: File) => uploadFile('pages', file, 'library');

export async function deleteFromLibrary(path: string) {
  const { error } = await supabase.storage.from('pages').remove([path]);
  if (error) throw new Error(error.message);
}

export const formatBytes = (n: number) =>
  n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

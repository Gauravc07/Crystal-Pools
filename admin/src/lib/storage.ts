import { supabase } from './supabase';

/**
 * Where the website's own images (/images/...) are loaded from. The built admin is served
 * from the website's domain (/admin), so they are same-origin; the admin dev server is not.
 */
const SITE_ASSETS_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_PUBLIC_SITE_URL || 'https://www.crystalpools.in').replace(/\/$/, '')
  : '';

export type Bucket = 'blog' | 'projects' | 'testimonials' | 'site' | 'pages';

/** True for values that are already URLs (e.g. legacy /images/... paths) rather than storage paths. */
export function isExternal(value: string) {
  return value.startsWith('/') || /^https?:\/\//.test(value);
}

/** Resolves a stored value (storage path or absolute URL) to something an <img> can load. */
export function mediaUrl(bucket: Bucket, value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^https?:\/\//.test(value)) return value;
  if (value.startsWith('/')) return SITE_ASSETS_URL + value;
  return supabase.storage.from(bucket).getPublicUrl(value).data.publicUrl;
}

const OPTIMIZABLE = ['image/jpeg', 'image/png', 'image/webp'];

/** Downscales to maxSize on the longest edge and re-encodes as WebP when that is smaller. */
async function optimizeImage(file: File, maxSize = 2000, quality = 0.85): Promise<Blob> {
  if (!OPTIMIZABLE.includes(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const webp = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality));
    return webp && webp.size < file.size ? webp : file;
  } catch {
    return file;
  }
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'application/pdf': 'pdf',
};

function friendlyUploadError(message: string) {
  if (/maximum allowed size|too large|payload/i.test(message)) return 'This file is too large.';
  if (/mime|content type|not supported/i.test(message)) return 'This file type is not allowed here.';
  if (/row-level security|unauthorized|403/i.test(message)) return 'You do not have permission to upload here.';
  return `Upload failed: ${message}`;
}

/** Uploads a file and returns its storage path (store this in the database). */
export async function uploadFile(bucket: Bucket, file: File, folder: string, { optimize = true } = {}): Promise<string> {
  const body = optimize ? await optimizeImage(file) : file;
  const type = body.type || file.type;
  const ext = EXTENSIONS[type] ?? file.name.split('.').pop()?.toLowerCase() ?? 'bin';
  const path = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType: type,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw new Error(friendlyUploadError(error.message));
  return path;
}

/** Deletes an uploaded file. Legacy URLs (not in storage) are ignored. Errors are non-fatal. */
export async function removeFile(bucket: Bucket, value: string | null | undefined) {
  if (!value || isExternal(value)) return;
  await supabase.storage.from(bucket).remove([value]);
}

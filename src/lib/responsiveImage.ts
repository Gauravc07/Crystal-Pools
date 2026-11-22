import variants from '../config/imageVariants.json';

type VariantInfo = { w: number; v: number[] };
const MAP = variants as Record<string, VariantInfo>;

/** The smaller copies of a site image (made by scripts/image-variants.mjs), as srcset text. */
export function srcSetFor(src: string | null | undefined): string | undefined {
  if (!src) return undefined;
  const path = src.split(/[?#]/)[0];
  const info = MAP[path];
  if (!info) return undefined;
  const base = path.replace(/\.(webp|jpe?g|png)$/i, '');
  return [...info.v.map(w => `${base}-${w}w.webp ${w}w`), `${src} ${info.w}w`].join(', ');
}

/**
 * Spread onto an <img>: lets phones download a copy that fits their screen.
 * "sizes" defaults to the full screen width, so the browser never picks a copy smaller than it
 * shows (no quality loss); it only skips the extra pixels a phone can't display.
 * Images without copies (uploads, small files) are left exactly as they are.
 */
export function responsive(src: string | null | undefined, sizes = '100vw'): { srcSet?: string; sizes?: string } {
  const srcSet = srcSetFor(src);
  return srcSet ? { srcSet, sizes } : {};
}

import { useState, useRef, useEffect } from 'react';
import type { CSSProperties } from 'react';

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function CrossfadeVideo({ src, className, isVisible, onPlayingChange }: {
  src: string;
  className?: string;
  isVisible: boolean;
  /** Tells the page when the video is really showing, so a still image behind it can step aside */
  onPlayingChange?: (playing: boolean) => void;
}) {
  const v1 = useRef<HTMLVideoElement>(null);
  const v2 = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState<1 | 2>(1);

  // Respect user motion preference — skip video entirely if reduced motion is on
  if (prefersReducedMotion) return null;

  useEffect(() => {
    if (!onPlayingChange) return;
    const vids = [v1.current, v2.current].filter(Boolean) as HTMLVideoElement[];
    const playing = () => onPlayingChange(true);
    const failed = () => onPlayingChange(false);
    for (const v of vids) { v.addEventListener('playing', playing); v.addEventListener('error', failed); }
    return () => { for (const v of vids) { v.removeEventListener('playing', playing); v.removeEventListener('error', failed); } };
  }, [onPlayingChange]);

  // Loop crossfade: the incoming copy fades in ON TOP while the outgoing one stays fully visible
  // underneath until the fade ends, so nothing behind the video ever shows through.
  const layer = (n: 1 | 2): CSSProperties => (active === n
    ? { opacity: 1, zIndex: 2, transition: 'opacity 500ms ease-in-out' }
    : { opacity: 0, zIndex: 1, transition: 'opacity 0s linear 500ms' });

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (active === 1 && v2.current) {
      timeout = setTimeout(() => v2.current?.pause(), 600);
    } else if (active === 2 && v1.current) {
      timeout = setTimeout(() => v1.current?.pause(), 600);
    }
    return () => clearTimeout(timeout);
  }, [active]);

  useEffect(() => {
    const handleTimeUpdate1 = () => {
      if (!v1.current || !v2.current) return;
      if (active === 1 && v1.current.duration && v1.current.currentTime >= v1.current.duration - 0.5) {
        v2.current.currentTime = 0;
        v2.current.play().catch(() => {});
        setActive(2);
      }
    };
    
    const handleTimeUpdate2 = () => {
      if (!v1.current || !v2.current) return;
      if (active === 2 && v2.current.duration && v2.current.currentTime >= v2.current.duration - 0.5) {
        v1.current.currentTime = 0;
        v1.current.play().catch(() => {});
        setActive(1);
      }
    };

    const vid1 = v1.current;
    const vid2 = v2.current;

    if (vid1) vid1.addEventListener('timeupdate', handleTimeUpdate1);
    if (vid2) vid2.addEventListener('timeupdate', handleTimeUpdate2);

    return () => {
      if (vid1) vid1.removeEventListener('timeupdate', handleTimeUpdate1);
      if (vid2) vid2.removeEventListener('timeupdate', handleTimeUpdate2);
    };
  }, [active]);

  return (
    <div className={`${className} transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <video
        ref={v1}
        src={src}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={layer(1)}
      />
      <video
        ref={v2}
        src={src}
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={layer(2)}
      />
    </div>
  );
}

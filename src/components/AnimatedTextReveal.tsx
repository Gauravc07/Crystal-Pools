import { Fragment, useRef, useEffect } from 'react';
import type { FC } from 'react';
import { motion, useScroll, useTransform, useMotionValue, MotionValue } from 'motion/react';

interface AnimatedTextRevealProps {
  text: string;
  className?: string;
  containerClassName?: string;
  // Legacy props kept so existing callers don't break — no longer used
  initialBlur?: number;
  initialOpacity?: number;
}

export default function AnimatedTextReveal({
  text,
  className = '',
  containerClassName = 'py-8',
}: AnimatedTextRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 85%', 'end 50%'],
  });

  const totalChars = text.length;

  // Maps scroll progress → character index across the full text
  const cursorRaw = useTransform(scrollYProgress, [0, 1], [0, totalChars]);

  // Ratchet: cursor only ever moves forward so typed characters never disappear
  // when the user scrolls back up.
  const cursor = useMotionValue(cursorRaw.get());

  useEffect(() => {
    const unsub = cursorRaw.on('change', (v) => {
      if (v > cursor.get()) cursor.set(v);
    });
    return unsub;
  }, [cursorRaw, cursor]);

  // Split into words; track each word's start index in the full string
  const words = text.split(' ');
  let charIndex = 0;

  return (
    <div ref={containerRef} className={`relative ${containerClassName}`}>
      <div className={className}>
        {words.map((word, wi) => {
          const wordStart = charIndex;
          charIndex += word.length + (wi < words.length - 1 ? 1 : 0); // +1 for space

          return (
            // inline-block keeps each word from breaking across lines
            <Fragment key={wi}>
            <span className="inline-block mr-[0.25em] mb-[0.1em]">
              {word.split('').map((char, ci) => (
                <Char
                  key={ci}
                  char={char}
                  charIndex={wordStart + ci}
                  cursor={cursor}
                />
              ))}
            </span>
            {/* Zero-size space: the gap comes from the margin, but crawlers need a real space between words */}
            {wi < words.length - 1 && <span style={{ fontSize: 0 }}> </span>}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

const Char: FC<{
  char: string;
  charIndex: number;
  cursor: MotionValue<number>;
}> = ({ char, charIndex, cursor }) => {
  // Each character fades in over a very narrow cursor window (0.8 char-widths)
  // giving a crisp typewriter appearance without any blur.
  const opacity = useTransform(cursor, [charIndex, charIndex + 0.8], [0, 1]);

  return (
    <motion.span className="inline" style={{ opacity }}>
      {char}
    </motion.span>
  );
};
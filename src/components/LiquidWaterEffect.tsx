import { useEffect, useRef } from 'react';

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const StaticBackground = () => (
  <div className="absolute inset-0 w-full h-full bg-linear-to-br from-[#0a5c86] to-[#041d2f] overflow-hidden">
  </div>
);

function LiquidWaterEffectCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let particles: { x: number; y: number; vx: number; vy: number; radius: number; life: number; maxLife: number; color: string }[] = [];

    const colors = ['rgba(10, 180, 255, 0.4)', 'rgba(20, 200, 255, 0.3)', 'rgba(50, 220, 255, 0.5)', 'rgba(0, 120, 200, 0.6)'];

    const resize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener('resize', resize);
    resize();

    let mouseX = width / 2;
    let mouseY = height / 2;
    let isMoving = false;
    let timeout: ReturnType<typeof setTimeout>;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const newX = e.clientX - rect.left;
      const newY = e.clientY - rect.top;

      const dx = newX - mouseX;
      const dy = newY - mouseY;

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        for (let i = 0; i < 3; i++) {
          particles.push({
            x: newX + (Math.random() - 0.5) * 20,
            y: newY + (Math.random() - 0.5) * 20,
            vx: dx * 0.05 + (Math.random() - 0.5) * 2,
            vy: dy * 0.05 + (Math.random() - 0.5) * 2,
            radius: Math.random() * 40 + 10,
            life: 1,
            maxLife: Math.random() * 60 + 40,
            color: colors[Math.floor(Math.random() * colors.length)]
          });
        }
      }

      mouseX = newX;
      mouseY = newY;
      isMoving = true;
      clearTimeout(timeout);
      timeout = setTimeout(() => { isMoving = false; }, 100);
    };

    container.addEventListener('mousemove', handleMouseMove);

    let animationFrameId: number;

    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * 3000,
        y: Math.random() * 2000,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 100 + 50,
        life: Math.random() * 100,
        maxLife: 100,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    const render = () => {
      ctx.fillStyle = 'rgba(4, 29, 47, 0.4)';
      ctx.fillRect(0, 0, width, height);

      if (Math.random() < 0.1) {
         particles.push({
            x: Math.random() * width,
            y: height + 50,
            vx: (Math.random() - 0.5) * 1,
            vy: -Math.random() * 2 - 0.5,
            radius: Math.random() * 60 + 20,
            life: 1,
            maxLife: Math.random() * 300 + 100,
            color: colors[Math.floor(Math.random() * colors.length)]
          });
      }

      particles.forEach((p, index) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;

        p.x += Math.sin(p.life / 20) * 0.5;

        const opacity = Math.sin((p.life / p.maxLife) * Math.PI);
        if (p.life >= p.maxLife) {
          particles.splice(index, 1);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * opacity, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      container.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full bg-linear-to-br from-[#0a5c86] to-[#041d2f] overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full mix-blend-screen" />
    </div>
  );
}

export default function LiquidWaterEffect() {
  if (prefersReducedMotion) return <StaticBackground />;
  return <LiquidWaterEffectCanvas />;
}

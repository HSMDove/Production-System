import { useEffect, useRef } from "react";

interface Dot {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  size: number;
  depth: number;
  speedX: number;
  speedY: number;
  opacity: number;
  hue: number;
}

export function FloatingDotsBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const count = Math.min(80, Math.floor((window.innerWidth * window.innerHeight) / 12000));

    dotsRef.current = Array.from({ length: count }, () => {
      const depth = Math.random();
      const size = 2 + depth * 6;
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        baseX: 0,
        baseY: 0,
        size,
        depth,
        speedX: (Math.random() - 0.5) * 0.3 * (1 - depth * 0.5),
        speedY: (Math.random() - 0.5) * 0.2 * (1 - depth * 0.5),
        opacity: 0.08 + depth * 0.18,
        hue: 220 + Math.random() * 40,
      };
    });
    dotsRef.current.forEach((d) => {
      d.baseX = d.x;
      d.baseY = d.y;
    });

    const handleMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouse);

    let time = 0;
    const animate = () => {
      time += 0.005;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      for (const dot of dotsRef.current) {
        dot.x += dot.speedX;
        dot.y += dot.speedY;

        const floatX = Math.sin(time * 2 + dot.baseX * 0.01) * 8 * dot.depth;
        const floatY = Math.cos(time * 1.5 + dot.baseY * 0.01) * 6 * dot.depth;

        let drawX = dot.x + floatX;
        let drawY = dot.y + floatY;

        const dx = mx - drawX;
        const dy = my - drawY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          const push = (1 - dist / 120) * 15 * dot.depth;
          drawX -= (dx / dist) * push;
          drawY -= (dy / dist) * push;
        }

        if (dot.x < -20) dot.x = canvas.width + 20;
        if (dot.x > canvas.width + 20) dot.x = -20;
        if (dot.y < -20) dot.y = canvas.height + 20;
        if (dot.y > canvas.height + 20) dot.y = -20;

        const blur = (1 - dot.depth) * 4;
        ctx.filter = blur > 0.5 ? `blur(${blur}px)` : "none";

        ctx.beginPath();
        ctx.arc(drawX, drawY, dot.size, 0, Math.PI * 2);

        const isDark = document.documentElement.classList.contains("dark");
        const alpha = dot.opacity * (isDark ? 1.2 : 0.8);
        ctx.fillStyle = isDark
          ? `hsla(${dot.hue}, 60%, 65%, ${alpha})`
          : `hsla(${dot.hue}, 50%, 45%, ${alpha})`;
        ctx.fill();
      }

      ctx.filter = "none";

      for (let i = 0; i < dotsRef.current.length; i++) {
        for (let j = i + 1; j < dotsRef.current.length; j++) {
          const a = dotsRef.current[i];
          const b = dotsRef.current[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100 && Math.abs(a.depth - b.depth) < 0.3) {
            const isDark = document.documentElement.classList.contains("dark");
            const lineAlpha = (1 - dist / 100) * 0.06 * (isDark ? 1.5 : 1);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = isDark
              ? `rgba(160, 180, 255, ${lineAlpha})`
              : `rgba(80, 100, 180, ${lineAlpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

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

    const count = Math.min(42, Math.floor((window.innerWidth * window.innerHeight) / 22000));

    dotsRef.current = Array.from({ length: count }, () => {
      const depth = Math.random();
      const size = 1.5 + depth * 3.5;
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        baseX: 0,
        baseY: 0,
        size,
        depth,
        speedX: (Math.random() - 0.5) * 0.12 * (1 - depth * 0.5),
        speedY: (Math.random() - 0.5) * 0.1 * (1 - depth * 0.5),
        opacity: 0.035 + depth * 0.08,
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
        if (dist > 0 && dist < 120) {
          const push = (1 - dist / 120) * 8 * dot.depth;
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
        const alpha = dot.opacity * (isDark ? 1.05 : 0.9);
        ctx.fillStyle = isDark
          ? `hsla(${dot.hue}, 54%, 66%, ${alpha})`
          : `hsla(${dot.hue}, 42%, 40%, ${alpha})`;
        ctx.fill();
      }

      ctx.filter = "none";

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

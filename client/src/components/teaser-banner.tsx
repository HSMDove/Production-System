import { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";

const STORAGE_KEY = "nasaq2-teaser-dismissed";

export function TeaserBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
      onClick={dismiss}
    >
      <div
        className="relative mx-4 max-w-sm w-full rounded-2xl border bg-card shadow-2xl overflow-hidden"
        style={{ animation: "teaser-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both" }}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
          style={{
            backgroundImage: "repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 50%)",
            backgroundSize: "12px 12px",
          }}
        />

        <button
          onClick={dismiss}
          className="absolute top-3 left-3 z-10 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          data-testid="button-dismiss-teaser"
          aria-label="إغلاق"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-8 py-10 text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <Sparkles className="h-3 w-3 opacity-60" />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground tracking-widest uppercase">قريباً</p>
            <h2 className="text-2xl font-bold tracking-tight">
              نَسَق{" "}
              <span className="text-primary">2</span>
            </h2>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            انظرونا — نسخة جديدة كلياً قيد التطوير
          </p>

          <div className="flex items-center justify-center gap-1.5 pt-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="block h-1.5 w-1.5 rounded-full bg-primary"
                style={{ animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </div>
        </div>

        <style>{`
          @keyframes teaser-in {
            from { opacity: 0; transform: scale(0.88) translateY(16px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
}

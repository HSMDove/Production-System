import { X, Megaphone, ExternalLink } from "lucide-react";

interface FikriAdCardProps {
  onDismiss: () => void;
}

export function FikriAdCard({ onDismiss }: FikriAdCardProps) {
  return (
    <div
      className="ad-chat-glass relative mx-1 p-3"
      data-testid="fikri-ad-card"
    >
      {/* Dismiss */}
      <button
        onClick={onDismiss}
        className="absolute top-2 left-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/15 text-foreground/50 hover:bg-black/30 transition-colors"
        aria-label="إغلاق الإعلان"
        data-testid="fikri-ad-dismiss"
      >
        <X className="h-2.5 w-2.5" />
      </button>

      {/* Header row */}
      <div className="flex items-center gap-2 mb-2 pr-4">
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          <Megaphone className="h-2.5 w-2.5" />
          مُموَّل
        </span>
        <span className="text-xs text-muted-foreground/60">محتوى راعٍ</span>
      </div>

      {/* Body */}
      <div className="flex items-center gap-3">
        <div
          className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center text-lg"
          style={{
            background: "rgba(247,203,70,0.15)",
            border: "1px solid rgba(247,203,70,0.35)",
          }}
        >
          ✨
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-foreground leading-snug">
            أعلن في نَسَق وتواصل مع القراء التقنيين
          </p>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-600 hover:text-amber-500 dark:text-amber-400"
            data-testid="fikri-ad-cta"
          >
            <ExternalLink className="h-3 w-3" />
            اعرف أكثر
          </a>
        </div>
      </div>
    </div>
  );
}

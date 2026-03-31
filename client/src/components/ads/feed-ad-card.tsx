import { Megaphone, ExternalLink } from "lucide-react";

export function FeedAdCard() {
  return (
    <div
      className="ad-golden-glass flex flex-row gap-3 p-4 min-h-[100px]"
      data-testid="feed-ad-card"
    >
      {/* Gold accent bar */}
      <div className="flex flex-col items-center self-stretch">
        <div className="w-1.5 flex-1 rounded-full bg-amber-400/70" />
      </div>

      {/* Ad thumbnail placeholder */}
      <div className="flex-shrink-0">
        <div
          className="w-20 h-20 rounded-lg flex items-center justify-center text-2xl"
          style={{
            background: "rgba(247,203,70,0.15)",
            border: "1px solid rgba(247,203,70,0.35)",
          }}
        >
          ✨
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
        <div className="space-y-1">
          {/* Sponsored badge + source row */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              <Megaphone className="h-2.5 w-2.5" />
              مُموَّل
            </span>
            <span className="font-medium text-muted-foreground/70">إعلان راعٍ</span>
          </div>

          {/* Headline */}
          <h3 className="text-base font-semibold leading-snug line-clamp-2 text-foreground">
            أعلن هنا وتواصل مع الجمهور التقني في MENA
          </h3>

          {/* Body */}
          <p className="hidden sm:block text-sm text-muted-foreground line-clamp-2">
            منصة نَسَق تستقطب المهتمين بالتقنية والإعلام الرقمي. فرصة للوصول إلى جمهور مستهدف.
          </p>
        </div>

        {/* Action */}
        <div className="flex items-center gap-1">
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-bold text-amber-600 hover:text-amber-500 dark:text-amber-400 transition-colors"
            data-testid="feed-ad-cta"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            اعرف أكثر
          </a>
        </div>
      </div>
    </div>
  );
}

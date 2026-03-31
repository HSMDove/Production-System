import { useEffect, useState } from "react";
import { X, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";

const VISIT_KEY   = "nasaq_ad_visit_count";
const DISMISS_KEY = "nasaq_folder_ad_dismissed_at";
const SESSION_KEY = "nasaq_visit_counted";
const REAPPEAR_AFTER = 2; // reappear after 2 more visits

function getVisitCount(): number {
  return parseInt(localStorage.getItem(VISIT_KEY) || "0", 10);
}

function getDismissedAt(): number {
  return parseInt(localStorage.getItem(DISMISS_KEY) || "0", 10);
}

function incrementVisitIfNeeded(): number {
  if (!sessionStorage.getItem(SESSION_KEY)) {
    const next = getVisitCount() + 1;
    localStorage.setItem(VISIT_KEY, String(next));
    sessionStorage.setItem(SESSION_KEY, "1");
    return next;
  }
  return getVisitCount();
}

export function FolderAdCard() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const currentVisit = incrementVisitIfNeeded();
    const dismissedAt  = getDismissedAt();

    if (dismissedAt === 0) {
      // Never dismissed — always show
      setVisible(true);
    } else if (currentVisit >= dismissedAt + REAPPEAR_AFTER) {
      // Enough visits have passed — reset dismiss and show again
      localStorage.removeItem(DISMISS_KEY);
      setVisible(true);
    }
    // Otherwise: still hidden
  }, []);

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.setItem(DISMISS_KEY, String(getVisitCount()));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="ad-folder-glass group flex h-full min-h-[14rem] flex-col rounded-[1.618rem] p-4 relative"
      data-testid="folder-ad-card"
    >
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 left-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/20 text-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/40"
        aria-label="إغلاق الإعلان"
        data-testid="folder-ad-dismiss"
      >
        <X className="h-3 w-3" />
      </button>

      {/* Sponsored badge */}
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          <Megaphone className="h-2.5 w-2.5" />
          مُموَّل
        </span>
      </div>

      {/* Ad icon */}
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
        style={{
          background: "rgba(247,203,70,0.18)",
          border: "1.5px solid rgba(247,203,70,0.45)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 0 2px 8px rgba(247,203,70,0.25)",
        }}
      >
        ✨
      </div>

      {/* Ad text */}
      <div className="flex-1">
        <h3 className="text-base font-bold leading-snug text-foreground">
          أعلن في نَسَق
        </h3>
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
          تواصل مع جمهور تقني مُتخصص في منطقة MENA.
        </p>
      </div>

      {/* CTA */}
      <div className="mt-3 border-t border-amber-400/20 pt-3">
        <a
          href="#"
          className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-500 dark:text-amber-400"
          onClick={(e) => e.preventDefault()}
        >
          اعرف أكثر →
        </a>
      </div>
    </div>
  );
}

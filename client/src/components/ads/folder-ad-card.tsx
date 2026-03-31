import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AdSlotRenderer } from "@/components/ads/ad-slot-renderer";
import { useAdSettings } from "@/hooks/use-ad-settings";

const VISIT_KEY      = "nasaq_ad_visit_count";
const DISMISS_KEY    = "nasaq_folder_ad_dismissed_at";
const SESSION_KEY    = "nasaq_visit_counted";
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
  const { configs } = useAdSettings();
  const config = configs.folder;

  useEffect(() => {
    const currentVisit = incrementVisitIfNeeded();
    const dismissedAt  = getDismissedAt();

    if (dismissedAt === 0) {
      setVisible(true);
    } else if (currentVisit >= dismissedAt + REAPPEAR_AFTER) {
      localStorage.removeItem(DISMISS_KEY);
      setVisible(true);
    }
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

      {/* Dynamic content */}
      <div className="flex-1">
        <AdSlotRenderer config={config} />
      </div>
    </div>
  );
}

import { X } from "lucide-react";
import { AdSlotRenderer } from "@/components/ads/ad-slot-renderer";
import { useAdSettings } from "@/hooks/use-ad-settings";

interface FikriAdCardProps {
  onDismiss: () => void;
}

export function FikriAdCard({ onDismiss }: FikriAdCardProps) {
  const { configs } = useAdSettings();
  const config = configs.fikri;

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

      {/* Dynamic content — with right padding to avoid dismiss button overlap */}
      <div className="pr-4">
        <AdSlotRenderer config={config} />
      </div>
    </div>
  );
}

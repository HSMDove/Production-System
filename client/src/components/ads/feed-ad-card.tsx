import { AdSlotRenderer } from "@/components/ads/ad-slot-renderer";
import { useAdSettings } from "@/hooks/use-ad-settings";

export function FeedAdCard() {
  const { configs } = useAdSettings();
  const config = configs.feed;

  return (
    <div
      className="ad-golden-glass flex flex-row gap-3 p-4 min-h-[100px]"
      data-testid="feed-ad-card"
    >
      {/* Gold accent bar */}
      <div className="flex flex-col items-center self-stretch">
        <div className="w-1.5 flex-1 rounded-full bg-amber-400/70" />
      </div>

      {/* Dynamic content */}
      <div className="flex-1 min-w-0">
        <AdSlotRenderer config={config} />
      </div>
    </div>
  );
}

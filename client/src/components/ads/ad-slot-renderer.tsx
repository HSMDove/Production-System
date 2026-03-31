import { useEffect, useRef } from "react";
import { ExternalLink, Megaphone } from "lucide-react";
import type { AdSlotConfig } from "@/hooks/use-ad-settings";

// Extend Window to recognise adsbygoogle without TS errors
declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

// ─── AdSense Unit ────────────────────────────────────────────────────────────

interface AdSenseUnitProps {
  clientId: string;
  slotId: string;
}

export function AdSenseUnit({ clientId, slotId }: AdSenseUnitProps) {
  const insRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    // Only push once per ins element — guard against StrictMode double-invocation
    // and re-renders.
    const ins = insRef.current;
    if (!ins) return;
    if (ins.getAttribute("data-adsbygoogle-status")) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Silently swallow — AdSense may not be loaded yet in development
    }
  }, [clientId, slotId]);

  return (
    <ins
      ref={insRef}
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-client={clientId}
      data-ad-slot={slotId}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}

// ─── Sponsor Card ─────────────────────────────────────────────────────────────

interface SponsorCardProps {
  config: AdSlotConfig;
}

function SponsorCard({ config }: SponsorCardProps) {
  const { sponsorTitle, sponsorDesc, sponsorUrl, sponsorImageUrl } = config;

  return (
    <>
      {/* Sponsor badge */}
      <div className="mb-2 flex items-center gap-1">
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          <Megaphone className="h-2.5 w-2.5" />
          مُموَّل
        </span>
      </div>

      <div className="flex items-start gap-3">
        {/* Sponsor image */}
        {sponsorImageUrl ? (
          <img
            src={sponsorImageUrl}
            alt={sponsorTitle || "راعٍ"}
            className="h-14 w-14 flex-shrink-0 rounded-xl object-cover border border-amber-400/30"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div
            className="h-14 w-14 flex-shrink-0 rounded-xl flex items-center justify-center text-2xl"
            style={{
              background: "rgba(247,203,70,0.15)",
              border: "1px solid rgba(247,203,70,0.35)",
            }}
          >
            ✨
          </div>
        )}

        {/* Sponsor text */}
        <div className="flex-1 min-w-0">
          {sponsorTitle && (
            <p className="font-bold text-sm leading-snug text-foreground line-clamp-2">
              {sponsorTitle}
            </p>
          )}
          {sponsorDesc && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
              {sponsorDesc}
            </p>
          )}
          {sponsorUrl && (
            <a
              href={sponsorUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-500 dark:text-amber-400 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              اعرف أكثر
            </a>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Placeholder ──────────────────────────────────────────────────────────────

function PlaceholderCard() {
  return (
    <>
      <div className="mb-2 flex items-center gap-1">
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          <Megaphone className="h-2.5 w-2.5" />
          مُموَّل
        </span>
      </div>

      <div className="flex items-start gap-3">
        <div
          className="h-14 w-14 flex-shrink-0 rounded-xl flex items-center justify-center text-2xl"
          style={{
            background: "rgba(247,203,70,0.15)",
            border: "1px solid rgba(247,203,70,0.35)",
          }}
        >
          ✨
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-snug text-foreground">
            أعلن في نَسَق
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            تواصل مع جمهور تقني مُتخصص في منطقة MENA.
          </p>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-500 dark:text-amber-400 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            اعرف أكثر
          </a>
        </div>
      </div>
    </>
  );
}

// ─── Main Renderer ────────────────────────────────────────────────────────────

interface AdSlotRendererProps {
  config: AdSlotConfig;
}

export function AdSlotRenderer({ config }: AdSlotRendererProps) {
  if (config.mode === "adsense" && config.adsenseClientId && config.adsenseSlotId) {
    return (
      <AdSenseUnit
        clientId={config.adsenseClientId}
        slotId={config.adsenseSlotId}
      />
    );
  }

  if (config.mode === "sponsor") {
    return <SponsorCard config={config} />;
  }

  return <PlaceholderCard />;
}

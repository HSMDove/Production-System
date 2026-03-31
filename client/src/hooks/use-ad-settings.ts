import { useQuery } from "@tanstack/react-query";

export interface AdSlotConfig {
  mode: "placeholder" | "adsense" | "sponsor";
  adsenseClientId?: string;
  adsenseSlotId?: string;
  sponsorTitle?: string;
  sponsorDesc?: string;
  sponsorUrl?: string;
  sponsorImageUrl?: string;
}

const DEFAULT_CONFIG: AdSlotConfig = { mode: "placeholder" };

const DEFAULT_CONFIGS = {
  folder: DEFAULT_CONFIG,
  feed:   DEFAULT_CONFIG,
  fikri:  DEFAULT_CONFIG,
};

export interface AdSettings {
  folderAds: boolean;
  feedAds:   boolean;
  fikriAds:  boolean;
  configs: {
    folder: AdSlotConfig;
    feed:   AdSlotConfig;
    fikri:  AdSlotConfig;
  };
}

export function useAdSettings(): AdSettings {
  const { data } = useQuery<AdSettings>({
    queryKey: ["/api/system-settings/ads"],
    queryFn: () =>
      fetch("/api/system-settings/ads").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  return {
    folderAds: data?.folderAds ?? true,
    feedAds:   data?.feedAds   ?? true,
    fikriAds:  data?.fikriAds  ?? true,
    configs:   data?.configs   ?? DEFAULT_CONFIGS,
  };
}

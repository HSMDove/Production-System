import { useQuery } from "@tanstack/react-query";

export interface AdSettings {
  folderAds: boolean;
  feedAds: boolean;
  fikriAds: boolean;
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
  };
}

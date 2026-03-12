import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { X, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";

export function TopBannerDisplay() {
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  const { data: banner } = useQuery<any>({
    queryKey: ["/api/banners/active"],
    enabled: isAuthenticated && !location.startsWith("/login") && !location.startsWith("/admin"),
  });

  if (!banner || dismissed || !isAuthenticated) return null;
  if (location.startsWith("/login") || location.startsWith("/verify") || location.startsWith("/admin")) return null;

  return (
    <div
      className="w-full py-2 px-4 text-center text-sm font-medium text-white flex items-center justify-center gap-3 relative"
      style={{ backgroundColor: banner.bgColor || "#3b82f6" }}
      dir="rtl"
      data-testid="top-banner"
    >
      <span>{banner.text}</span>
      {banner.linkUrl && (
        <a
          href={banner.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline inline-flex items-center gap-1 hover:opacity-80"
          data-testid="banner-link"
        >
          {banner.linkText || "اقرأ المزيد"}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
      <button
        onClick={() => setDismissed(true)}
        className="absolute left-3 top-1/2 -translate-y-1/2 hover:opacity-70"
        data-testid="dismiss-banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

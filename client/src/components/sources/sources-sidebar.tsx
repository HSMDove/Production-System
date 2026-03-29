import { Rss, Globe, Layers } from "lucide-react";
import { SiYoutube, SiX, SiTiktok } from "react-icons/si";
import { Button } from "@/components/ui/button";
import type { Source } from "@/lib/types";

interface SourcesSidebarProps {
  sources: Source[];
  selectedSourceId: string | null;
  onSourceSelect: (sourceId: string | null) => void;
}

function getSourceIcon(type: string) {
  switch (type) {
    case "youtube":
      return <SiYoutube className="h-4 w-4 flex-shrink-0 text-red-500" />;
    case "twitter":
      return <SiX className="h-4 w-4 flex-shrink-0 text-foreground/70" />;
    case "tiktok":
      return <SiTiktok className="h-4 w-4 flex-shrink-0 text-pink-500" />;
    case "website":
      return <Globe className="h-4 w-4 flex-shrink-0 text-blue-500" />;
    case "rss":
    default:
      return <Rss className="h-4 w-4 flex-shrink-0 text-orange-500" />;
  }
}

export function SourcesSidebar({ sources, selectedSourceId, onSourceSelect }: SourcesSidebarProps) {
  return (
    <div className="hidden md:flex w-52 lg:w-56 flex-shrink-0 liquid-glass-sidebar rounded-[20px] overflow-hidden">
      <div className="w-full px-3 py-4 space-y-1 overflow-y-auto">

        {/* Section label */}
        <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-widest text-foreground/40 select-none">
          المصادر
        </p>

        {/* View All */}
        <button
          className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-150 ${
            selectedSourceId === null
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
              : "text-foreground/70 hover:bg-white/15 hover:text-foreground"
          }`}
          onClick={() => onSourceSelect(null)}
          data-testid="button-view-all"
        >
          <Layers className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">عرض الكل</span>
          {sources.length > 0 && selectedSourceId === null && (
            <span className="mr-auto text-[10px] font-black opacity-70">{sources.length}</span>
          )}
        </button>

        {sources.length > 0 && (
          <div className="my-2 h-px bg-white/15" />
        )}

        {/* Source list */}
        {sources.map((source) => (
          <button
            key={source.id}
            className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all duration-150 ${
              selectedSourceId === source.id
                ? "bg-white/20 font-semibold text-foreground shadow-sm"
                : "text-foreground/65 hover:bg-white/12 hover:text-foreground"
            }`}
            onClick={() => onSourceSelect(source.id)}
            data-testid={`button-source-${source.id}`}
          >
            {getSourceIcon(source.type)}
            <span className="truncate">{source.name}</span>
          </button>
        ))}

        {sources.length === 0 && (
          <p className="text-xs text-foreground/40 text-center py-6" data-testid="text-no-sources">
            لا توجد مصادر
          </p>
        )}
      </div>
    </div>
  );
}

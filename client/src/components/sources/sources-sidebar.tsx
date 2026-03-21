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
      return <SiYoutube className="h-4 w-4 text-red-500 flex-shrink-0" />;
    case "twitter":
      return <SiX className="h-4 w-4 flex-shrink-0" />;
    case "tiktok":
      return <SiTiktok className="h-4 w-4 flex-shrink-0" />;
    case "website":
      return <Globe className="h-4 w-4 text-blue-500 flex-shrink-0" />;
    case "rss":
    default:
      return <Rss className="h-4 w-4 text-orange-500 flex-shrink-0" />;
  }
}

export function SourcesSidebar({ sources, selectedSourceId, onSourceSelect }: SourcesSidebarProps) {
  return (
    <div className="hidden md:flex w-52 lg:w-56 flex-shrink-0 border-l bg-muted/20 rounded-lg overflow-y-auto">
      <div className="p-2 space-y-1 w-full">
        <Button
          variant={selectedSourceId === null ? "default" : "ghost"}
          className="w-full justify-start gap-2"
          size="sm"
          onClick={() => onSourceSelect(null)}
          data-testid="button-view-all"
        >
          <Layers className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">عرض الكل</span>
        </Button>
        
        <div className="h-px bg-border my-2" />
        
        {sources.map((source) => (
          <Button
            key={source.id}
            variant={selectedSourceId === source.id ? "secondary" : "ghost"}
            className="w-full justify-start gap-2"
            size="sm"
            onClick={() => onSourceSelect(source.id)}
            data-testid={`button-source-${source.id}`}
          >
            {getSourceIcon(source.type)}
            <span className="truncate text-sm">{source.name}</span>
          </Button>
        ))}
        
        {sources.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4" data-testid="text-no-sources">
            لا توجد مصادر
          </p>
        )}
      </div>
    </div>
  );
}

import { Filter, ArrowUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { sourceTypeLabels } from "@/lib/types";

interface ContentFiltersProps {
  sourceType: string;
  onSourceTypeChange: (type: string) => void;
  sortOrder: "newest" | "oldest";
  onSortOrderChange: (order: "newest" | "oldest") => void;
}

export function ContentFilters({
  sourceType,
  onSourceTypeChange,
  sortOrder,
  onSortOrderChange,
}: ContentFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={sourceType} onValueChange={onSourceTypeChange}>
          <SelectTrigger className="w-[140px]" data-testid="select-filter-source-type">
            <SelectValue placeholder="نوع المصدر" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            {Object.entries(sourceTypeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        variant="outline"
        size="default"
        onClick={() => onSortOrderChange(sortOrder === "newest" ? "oldest" : "newest")}
        className="gap-2"
        data-testid="button-toggle-sort"
      >
        <ArrowUpDown className="h-4 w-4" />
        {sortOrder === "newest" ? "الأحدث أولاً" : "الأقدم أولاً"}
      </Button>
    </div>
  );
}

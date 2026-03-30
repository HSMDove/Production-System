import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";

interface AddFolderCardProps {
  onClick: () => void;
}

export function AddFolderCard({ onClick }: AddFolderCardProps) {
  return (
    <Card
      onClick={onClick}
      className="folder-surface liquid-glass-folder group flex min-h-[14rem] cursor-pointer items-center justify-center rounded-[1.618rem] border-2 border-dashed border-white/20 transition-all duration-300 hover:border-primary/40 hover:scale-[1.01]"
      data-testid="button-add-folder"
    >
      <div className="flex flex-col items-center gap-3 text-muted-foreground transition-colors duration-300 group-hover:text-primary">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-current transition-all duration-300 group-hover:bg-primary/10">
          <Plus className="h-7 w-7" />
        </div>
        <span className="font-black text-sm">إضافة مجلد جديد</span>
      </div>
    </Card>
  );
}

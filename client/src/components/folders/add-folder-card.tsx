import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";

interface AddFolderCardProps {
  onClick: () => void;
}

export function AddFolderCard({ onClick }: AddFolderCardProps) {
  return (
    <Card
      onClick={onClick}
      className="folder-surface flex min-h-[7rem] cursor-pointer items-center justify-center border-[3px] border-dashed border-border/75 bg-card/60 backdrop-blur-sm"
      data-testid="button-add-folder"
    >
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-current">
          <Plus className="h-6 w-6" />
        </div>
        <span className="font-medium">إضافة مجلد جديد</span>
      </div>
    </Card>
  );
}

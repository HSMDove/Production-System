import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";

interface AddFolderCardProps {
  onClick: () => void;
}

export function AddFolderCard({ onClick }: AddFolderCardProps) {
  return (
    <Card
      onClick={onClick}
      className="flex min-h-[160px] cursor-pointer items-center justify-center border-2 border-dashed transition-all duration-200 hover:border-primary hover:bg-muted/50"
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

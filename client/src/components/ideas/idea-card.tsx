import { GripVertical, MoreVertical, Pencil, Trash2, FileText, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { IdeaWithFolder } from "@/lib/types";
import { ideaCategoryLabels, categoryColors } from "@/lib/types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface IdeaCardProps {
  idea: IdeaWithFolder;
  onEdit: (idea: IdeaWithFolder) => void;
  onDelete: (idea: IdeaWithFolder) => void;
  isDragging?: boolean;
}

export function IdeaCard({ idea, onEdit, onDelete, isDragging }: IdeaCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: idea.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const categoryColor = categoryColors[idea.category] || categoryColors.other;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="group"
      data-testid={`card-idea-${idea.id}`}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <button
            className="mt-1 cursor-grab touch-none opacity-0 group-hover:opacity-100 transition-opacity"
            {...attributes}
            {...listeners}
            data-testid={`button-drag-idea-${idea.id}`}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium leading-tight mb-2 line-clamp-2" data-testid={`text-idea-title-${idea.id}`}>
              {idea.title}
            </h4>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <Badge 
                variant="secondary" 
                className={`text-xs ${categoryColor.bg} ${categoryColor.text}`}
              >
                {ideaCategoryLabels[idea.category] || idea.category}
              </Badge>
              {idea.folder && (
                <Badge variant="outline" className="text-xs">
                  {idea.folder.name}
                </Badge>
              )}
            </div>
            {idea.estimatedDuration && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{idea.estimatedDuration}</span>
              </div>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                data-testid={`button-idea-menu-${idea.id}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => onEdit(idea)} data-testid={`menu-item-edit-idea-${idea.id}`}>
                <Pencil className="ml-2 h-4 w-4" />
                تعديل
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(idea)}
                className="text-destructive focus:text-destructive"
                data-testid={`menu-item-delete-idea-${idea.id}`}
              >
                <Trash2 className="ml-2 h-4 w-4" />
                حذف
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {idea.notes && (
          <div className="mt-2 pt-2 border-t">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <FileText className="h-3 w-3" />
              <span className="line-clamp-1">{idea.notes}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

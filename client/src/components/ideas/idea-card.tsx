import { useState, useRef, useEffect } from "react";
import { GripVertical, MoreVertical, Pencil, Trash2, FileText, Clock, Image, Link2, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  onInlineUpdate?: (ideaId: string, field: string, value: string) => void;
  onCardClick?: (idea: IdeaWithFolder) => void;
  isDragging?: boolean;
}

function InlineEditField({ 
  value, 
  onSave, 
  fieldType = "input",
  className = "",
  testId,
}: {
  value: string;
  onSave: (newValue: string) => void;
  fieldType?: "input" | "textarea";
  className?: string;
  testId?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const savedRef = useRef(false);

  useEffect(() => {
    if (editing && inputRef.current) {
      savedRef.current = false;
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = () => {
    if (savedRef.current) return;
    savedRef.current = true;
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    savedRef.current = true;
    setEditValue(value);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (editing) {
    return (
      <div className="flex items-start gap-1" onClick={(e) => e.stopPropagation()}>
        {fieldType === "textarea" ? (
          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className="text-sm min-h-[60px]"
            data-testid={testId ? `${testId}-editing` : undefined}
          />
        ) : (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className="text-sm"
            data-testid={testId ? `${testId}-editing` : undefined}
          />
        )}
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={handleSave} data-testid={testId ? `${testId}-save` : undefined}>
          <Check className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onMouseDown={handleCancel} data-testid={testId ? `${testId}-cancel` : undefined}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <span 
      className={`cursor-pointer hover:bg-muted/50 rounded px-0.5 -mx-0.5 transition-colors ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      title="اضغط للتعديل"
      data-testid={testId}
    >
      {value}
    </span>
  );
}

export function IdeaCard({ idea, onEdit, onDelete, onInlineUpdate, onCardClick, isDragging }: IdeaCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: idea.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const categoryColor = categoryColors[idea.category] || categoryColors.other;
  const wasDraggingRef = useRef(false);

  useEffect(() => {
    if (isSortableDragging) {
      wasDraggingRef.current = true;
    }
  }, [isSortableDragging]);

  const handleInlineUpdate = (field: string, value: string) => {
    if (onInlineUpdate) {
      onInlineUpdate(idea.id, field, value);
    }
  };

  const handleCardClick = () => {
    if (wasDraggingRef.current) {
      wasDraggingRef.current = false;
      return;
    }
    onCardClick?.(idea);
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="group cursor-pointer glass-surface rounded-[1.35rem] hover:scale-[1.01] transition-all duration-300"
      onClick={handleCardClick}
      data-testid={`card-idea-${idea.id}`}
    >
      <CardContent className="p-[calc(0.75rem*1.618)]">
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
            <h4 className="font-medium leading-tight mb-2 line-clamp-2" dir="auto" data-testid={`text-idea-title-${idea.id}`}>
              {onInlineUpdate ? (
                <InlineEditField
                  value={idea.title}
                  onSave={(val) => handleInlineUpdate("title", val)}
                  testId={`inline-edit-title-${idea.id}`}
                />
              ) : (
                idea.title
              )}
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
        {(idea.description || idea.thumbnailText || idea.sourceContentTitles?.length || idea.notes) && (
          <div className="mt-2 pt-2 border-t space-y-1.5">
            {idea.description && (
              <div className="text-xs text-muted-foreground" dir="auto">
                {onInlineUpdate ? (
                  <InlineEditField
                    value={idea.description}
                    onSave={(val) => handleInlineUpdate("description", val)}
                    fieldType="textarea"
                    className="line-clamp-2"
                    testId={`inline-edit-description-${idea.id}`}
                  />
                ) : (
                  <span className="line-clamp-2">{idea.description}</span>
                )}
              </div>
            )}
            {idea.thumbnailText && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Image className="h-3 w-3 shrink-0" />
                {onInlineUpdate ? (
                  <InlineEditField
                    value={idea.thumbnailText}
                    onSave={(val) => handleInlineUpdate("thumbnailText", val)}
                    className="line-clamp-1"
                    testId={`inline-edit-thumbnail-${idea.id}`}
                  />
                ) : (
                  <span className="line-clamp-1" data-testid={`text-idea-thumbnail-${idea.id}`}>{idea.thumbnailText}</span>
                )}
              </div>
            )}
            {idea.sourceContentTitles && idea.sourceContentTitles.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Link2 className="h-3 w-3 shrink-0" />
                <span data-testid={`text-idea-sources-count-${idea.id}`}>{idea.sourceContentTitles.length} مصادر</span>
              </div>
            )}
            {idea.notes && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="h-3 w-3 shrink-0" />
                <span className="line-clamp-1">{idea.notes}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useState, useRef, useEffect } from "react";
import { ExternalLink, Clock, Users, Image, Link2, FileText, Pencil, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import type { IdeaWithFolder } from "@/lib/types";
import { ideaCategoryLabels, ideaStatusLabels, categoryColors, statusColors } from "@/lib/types";

interface IdeaDetailModalProps {
  idea: IdeaWithFolder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (ideaId: string, field: string, value: string) => void;
}

function EditableField({
  label,
  value,
  fieldKey,
  ideaId,
  onSave,
  multiline = false,
  icon: Icon,
}: {
  label: string;
  value: string;
  fieldKey: string;
  ideaId: string;
  onSave: (ideaId: string, field: string, value: string) => void;
  multiline?: boolean;
  icon?: typeof Clock;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const savedRef = useRef(false);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      savedRef.current = false;
      inputRef.current.focus();
    }
  }, [editing]);

  const handleSave = () => {
    if (savedRef.current) return;
    savedRef.current = true;
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      onSave(ideaId, fieldKey, trimmed);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    savedRef.current = true;
    setEditValue(value);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !multiline) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          {Icon && <Icon className="h-4 w-4" />}
          {label}
        </div>
        {!editing && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={() => setEditing(true)}
            data-testid={`button-edit-${fieldKey}`}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        )}
      </div>
      {editing ? (
        <div className="flex items-start gap-1.5">
          {multiline ? (
            <Textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              className="min-h-[120px]"
              data-testid={`modal-edit-${fieldKey}`}
            />
          ) : (
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              data-testid={`modal-edit-${fieldKey}`}
            />
          )}
          <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={handleSave} data-testid={`button-save-${fieldKey}`}>
            <Check className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onMouseDown={handleCancel} data-testid={`button-cancel-${fieldKey}`}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          className="text-sm leading-relaxed whitespace-pre-wrap cursor-pointer rounded-md p-2 hover:bg-muted/50 transition-colors min-h-[2rem]"
          dir="auto"
          onClick={() => setEditing(true)}
          data-testid={`modal-field-${fieldKey}`}
        >
          {value || <span className="text-muted-foreground italic">اضغط للإضافة...</span>}
        </div>
      )}
    </div>
  );
}

export function IdeaDetailModal({ idea, open, onOpenChange, onUpdate }: IdeaDetailModalProps) {
  if (!idea) return null;

  const categoryColor = categoryColors[idea.category] || categoryColors.other;
  const statusColor = statusColors[idea.status] || statusColors.raw_idea;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-idea-detail">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge
              variant="secondary"
              className={`${categoryColor.bg} ${categoryColor.text}`}
            >
              {ideaCategoryLabels[idea.category] || idea.category}
            </Badge>
            <Badge
              variant="secondary"
              className={`${statusColor.bg} ${statusColor.text}`}
            >
              {ideaStatusLabels[idea.status] || idea.status}
            </Badge>
            {idea.folder && (
              <Badge variant="outline">{idea.folder.name}</Badge>
            )}
          </div>
          <DialogTitle className="text-xl leading-tight" dir="auto" data-testid="modal-idea-title">
            {idea.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          <EditableField
            label="عنوان الفيديو"
            value={idea.title}
            fieldKey="title"
            ideaId={idea.id}
            onSave={onUpdate}
            icon={FileText}
          />

          <Separator />

          <EditableField
            label="نص الصورة المصغرة"
            value={idea.thumbnailText || ""}
            fieldKey="thumbnailText"
            ideaId={idea.id}
            onSave={onUpdate}
            icon={Image}
          />

          <Separator />

          <EditableField
            label="السكربت / الوصف"
            value={idea.description || ""}
            fieldKey="description"
            ideaId={idea.id}
            onSave={onUpdate}
            multiline
            icon={FileText}
          />

          <Separator />

          <EditableField
            label="السكربت الكامل"
            value={idea.script || ""}
            fieldKey="script"
            ideaId={idea.id}
            onSave={onUpdate}
            multiline
            icon={FileText}
          />

          {(idea.sourceContentTitles?.length || idea.sourceContentUrls?.length) && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <Link2 className="h-4 w-4" />
                  المصادر
                </div>
                <div className="space-y-2">
                  {idea.sourceContentTitles?.map((sourceTitle, idx) => {
                    const url = idea.sourceContentUrls?.[idx];
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-2 text-sm rounded-md border p-2.5 bg-muted/30"
                        data-testid={`modal-source-${idx}`}
                      >
                        <Link2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium leading-tight" dir="auto">{sourceTitle}</p>
                          {url && (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              فتح المصدر
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {(idea.estimatedDuration || idea.targetAudience) && (
            <>
              <Separator />
              <div className="flex flex-wrap gap-4">
                {idea.estimatedDuration && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{idea.estimatedDuration}</span>
                  </div>
                )}
                {idea.targetAudience && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{idea.targetAudience}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {idea.notes && (
            <>
              <Separator />
              <EditableField
                label="ملاحظات"
                value={idea.notes}
                fieldKey="notes"
                ideaId={idea.id}
                onSave={onUpdate}
                multiline
                icon={FileText}
              />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

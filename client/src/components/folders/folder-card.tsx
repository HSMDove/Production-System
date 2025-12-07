import { Link } from "wouter";
import { Folder, MoreVertical, Pencil, Trash2, Rss } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Folder as FolderType } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface FolderCardProps {
  folder: FolderType & { _count?: { sources: number; content: number } };
  onEdit: (folder: FolderType) => void;
  onDelete: (folder: FolderType) => void;
}

export function FolderCard({ folder, onEdit, onDelete }: FolderCardProps) {
  const sourceCount = folder._count?.sources ?? 0;
  const contentCount = folder._count?.content ?? 0;

  return (
    <Link href={`/folder/${folder.id}`}>
      <Card 
        className="group cursor-pointer transition-all duration-200 hover:border-primary/50 hover:shadow-md"
        data-testid={`card-folder-${folder.id}`}
      >
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-md"
              style={{ backgroundColor: folder.color || "#3b82f6" }}
            >
              <Folder className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold leading-tight" data-testid={`text-folder-name-${folder.id}`}>
                {folder.name}
              </h3>
              {folder.description && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                  {folder.description}
                </p>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`button-folder-menu-${folder.id}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  onEdit(folder);
                }}
                data-testid={`menu-item-edit-folder-${folder.id}`}
              >
                <Pencil className="ml-2 h-4 w-4" />
                تعديل
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  onDelete(folder);
                }}
                className="text-destructive focus:text-destructive"
                data-testid={`menu-item-delete-folder-${folder.id}`}
              >
                <Trash2 className="ml-2 h-4 w-4" />
                حذف
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Rss className="h-4 w-4" />
              <span>{sourceCount} مصدر</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>{contentCount} خبر</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            أُنشئ {formatDistanceToNow(new Date(folder.createdAt), { addSuffix: true, locale: ar })}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

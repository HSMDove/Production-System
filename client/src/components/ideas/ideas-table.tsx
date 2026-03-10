import { MoreVertical, Pencil, Trash2, ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { IdeaWithFolder } from "@/lib/types";
import { ideaStatusLabels, ideaCategoryLabels, statusColors, categoryColors } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface IdeasTableProps {
  ideas: IdeaWithFolder[];
  onEdit: (idea: IdeaWithFolder) => void;
  onDelete: (idea: IdeaWithFolder) => void;
  sortField: "title" | "category" | "status" | "createdAt";
  sortOrder: "asc" | "desc";
  onSort: (field: "title" | "category" | "status" | "createdAt") => void;
}

export function IdeasTable({
  ideas,
  onEdit,
  onDelete,
  sortField,
  sortOrder,
  onSort,
}: IdeasTableProps) {
  const SortableHeader = ({ field, children }: { field: typeof sortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1 font-medium -mr-3"
      onClick={() => onSort(field)}
      data-testid={`button-sort-${field}`}
    >
      {children}
      <ArrowUpDown className={`h-4 w-4 ${sortField === field ? "text-primary" : "text-muted-foreground"}`} />
    </Button>
  );

  if (ideas.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p className="text-lg mb-2">لا توجد أفكار بعد</p>
        <p className="text-sm">قم بتوليد أفكار من المجلدات أو أضف فكرة يدوياً</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table className="min-w-[700px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">
              <SortableHeader field="title">العنوان</SortableHeader>
            </TableHead>
            <TableHead className="w-[120px]">
              <SortableHeader field="category">الفئة</SortableHeader>
            </TableHead>
            <TableHead className="w-[130px]">
              <SortableHeader field="status">الحالة</SortableHeader>
            </TableHead>
            <TableHead className="w-[100px]">المدة</TableHead>
            <TableHead className="w-[120px]">المجلد</TableHead>
            <TableHead className="w-[130px]">
              <SortableHeader field="createdAt">التاريخ</SortableHeader>
            </TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ideas.map((idea, index) => {
            const statusColor = statusColors[idea.status] || statusColors.raw_idea;
            const categoryColor = categoryColors[idea.category] || categoryColors.other;
            
            return (
              <TableRow
                key={idea.id}
                className={index % 2 === 0 ? "bg-background" : "bg-muted/30"}
                data-testid={`row-idea-${idea.id}`}
              >
                <TableCell className="font-medium">
                  <div>
                    <span className="line-clamp-1" data-testid={`text-idea-table-title-${idea.id}`}>
                      {idea.title}
                    </span>
                    {idea.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {idea.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="secondary" 
                    className={`${categoryColor.bg} ${categoryColor.text}`}
                  >
                    {ideaCategoryLabels[idea.category] || idea.category}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="secondary"
                    className={`${statusColor.bg} ${statusColor.text}`}
                  >
                    {ideaStatusLabels[idea.status] || idea.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {idea.estimatedDuration || "-"}
                </TableCell>
                <TableCell>
                  {idea.folder ? (
                    <Badge variant="outline">{idea.folder.name}</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDistanceToNow(new Date(idea.createdAt), { addSuffix: true, locale: ar })}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-table-idea-menu-${idea.id}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => onEdit(idea)} data-testid={`menu-item-table-edit-${idea.id}`}>
                        <Pencil className="ml-2 h-4 w-4" />
                        تعديل
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(idea)}
                        className="text-destructive focus:text-destructive"
                        data-testid={`menu-item-table-delete-${idea.id}`}
                      >
                        <Trash2 className="ml-2 h-4 w-4" />
                        حذف
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

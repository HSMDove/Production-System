import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { LayoutGrid, Table as TableIcon, Plus, Filter, Sparkles } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { KanbanBoard } from "@/components/ideas/kanban-board";
import { IdeasTable } from "@/components/ideas/ideas-table";
import { IdeaDialog } from "@/components/ideas/idea-dialog";
import { IdeaDetailModal } from "@/components/ideas/idea-detail-modal";
import { SmartGenerateDialog } from "@/components/ideas/smart-generate-dialog";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { IdeaWithFolder, Folder, IdeaStatus, IdeaCategory } from "@/lib/types";
import { ideaCategoryLabels, ideaStatusLabels } from "@/lib/types";

type SortField = "title" | "category" | "status" | "createdAt";
type ViewMode = "kanban" | "table";

export default function Ideas() {
  const { toast } = useToast();
  
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [ideaDialogOpen, setIdeaDialogOpen] = useState(false);
  const [smartGenerateOpen, setSmartGenerateOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<IdeaWithFolder | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detailIdea, setDetailIdea] = useState<IdeaWithFolder | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const { data: ideas, isLoading: ideasLoading } = useQuery<IdeaWithFolder[]>({
    queryKey: ["/api/ideas"],
  });

  const { data: folders } = useQuery<Folder[]>({
    queryKey: ["/api/folders"],
  });

  const filteredIdeas = useMemo(() => {
    if (!ideas) return [];
    let filtered = [...ideas];

    if (categoryFilter !== "all") {
      filtered = filtered.filter((idea) => idea.category === categoryFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((idea) => idea.status === statusFilter);
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "title":
          comparison = a.title.localeCompare(b.title, "ar");
          break;
        case "category":
          comparison = a.category.localeCompare(b.category);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "createdAt":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [ideas, categoryFilter, statusFilter, sortField, sortOrder]);

  const createIdeaMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/ideas", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
      setIdeaDialogOpen(false);
      toast({ title: "تم إضافة الفكرة بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في إضافة الفكرة", variant: "destructive" });
    },
  });

  const updateIdeaMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & any) => {
      return apiRequest("PATCH", `/api/ideas/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
      setIdeaDialogOpen(false);
      setSelectedIdea(null);
      toast({ title: "تم تحديث الفكرة بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في تحديث الفكرة", variant: "destructive" });
    },
  });

  const deleteIdeaMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/ideas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
      setDeleteDialogOpen(false);
      setSelectedIdea(null);
      toast({ title: "تم حذف الفكرة بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في حذف الفكرة", variant: "destructive" });
    },
  });

  const handleCardClick = (idea: IdeaWithFolder) => {
    setDetailIdea(idea);
    setDetailModalOpen(true);
  };

  const handleDetailUpdate = (ideaId: string, field: string, value: string) => {
    inlineUpdateMutation.mutate({ id: ideaId, [field]: value });
    if (detailIdea && detailIdea.id === ideaId) {
      setDetailIdea({ ...detailIdea, [field]: value });
    }
  };

  const handleAddIdea = () => {
    setSelectedIdea(null);
    setIdeaDialogOpen(true);
  };

  const handleEditIdea = (idea: IdeaWithFolder) => {
    setSelectedIdea(idea);
    setIdeaDialogOpen(true);
  };

  const handleDeleteIdea = (idea: IdeaWithFolder) => {
    setSelectedIdea(idea);
    setDeleteDialogOpen(true);
  };

  const handleIdeaSubmit = (values: any) => {
    if (selectedIdea) {
      updateIdeaMutation.mutate({ id: selectedIdea.id, ...values });
    } else {
      createIdeaMutation.mutate(values);
    }
  };

  const inlineUpdateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      return apiRequest("PATCH", `/api/ideas/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
      toast({ title: "تم التحديث" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في تحديث الفكرة", variant: "destructive" });
    },
  });

  const handleInlineUpdate = (ideaId: string, field: string, value: string) => {
    inlineUpdateMutation.mutate({ id: ideaId, [field]: value });
  };

  const handleStatusChange = (ideaId: string, newStatus: IdeaStatus) => {
    updateIdeaMutation.mutate({ id: ideaId, status: newStatus });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const ideasCount = ideas?.length || 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold" data-testid="text-ideas-title">الأفكار</h1>
              <Badge variant="secondary">{ideasCount}</Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              إدارة أفكار الفيديو ومتابعة سير العمل
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setSmartGenerateOpen(true)}
              data-testid="button-smart-generate"
            >
              <Sparkles className="ml-2 h-4 w-4" />
              توليد ذكي
            </Button>
            <Button onClick={handleAddIdea} data-testid="button-add-idea">
              <Plus className="ml-2 h-4 w-4" />
              فكرة جديدة
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-filter-category">
                  <SelectValue placeholder="الفئة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الفئات</SelectItem>
                  {Object.entries(ideaCategoryLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                {Object.entries(ideaStatusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="kanban" data-testid="button-view-kanban">
                <LayoutGrid className="h-4 w-4 ml-2" />
                كانبان
              </TabsTrigger>
              <TabsTrigger value="table" data-testid="button-view-table">
                <TableIcon className="h-4 w-4 ml-2" />
                جدول
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {ideasLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-[400px]" />
          </div>
        ) : viewMode === "kanban" ? (
          <KanbanBoard
            ideas={filteredIdeas}
            onEdit={handleEditIdea}
            onDelete={handleDeleteIdea}
            onInlineUpdate={handleInlineUpdate}
            onCardClick={handleCardClick}
            onStatusChange={handleStatusChange}
            activeId={activeId}
            setActiveId={setActiveId}
          />
        ) : (
          <IdeasTable
            ideas={filteredIdeas}
            onEdit={handleEditIdea}
            onDelete={handleDeleteIdea}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
          />
        )}
      </div>

      <IdeaDialog
        open={ideaDialogOpen}
        onOpenChange={setIdeaDialogOpen}
        idea={selectedIdea}
        folders={folders}
        onSubmit={handleIdeaSubmit}
        isLoading={createIdeaMutation.isPending || updateIdeaMutation.isPending}
      />

      <SmartGenerateDialog
        open={smartGenerateOpen}
        onOpenChange={setSmartGenerateOpen}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="حذف الفكرة"
        description={`هل أنت متأكد من حذف الفكرة "${selectedIdea?.title}"؟`}
        onConfirm={() => selectedIdea && deleteIdeaMutation.mutate(selectedIdea.id)}
        isLoading={deleteIdeaMutation.isPending}
      />

      <IdeaDetailModal
        idea={detailIdea}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        onUpdate={handleDetailUpdate}
      />
    </MainLayout>
  );
}

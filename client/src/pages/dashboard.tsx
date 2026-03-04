import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Columns2, FolderOpen } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { FolderCard } from "@/components/folders/folder-card";
import { AddFolderCard } from "@/components/folders/add-folder-card";
import { FolderDialog } from "@/components/folders/folder-dialog";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { Folder } from "@/lib/types";

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const welcomeMessages = [
    "مرحباً",
    "أهلاً وسهلاً",
    "تو مانور الموقع يا",
    "يا هلا والله بـ",
    "نورتنا يا",
    "يسعد مساك يا",
    "حي الله"
  ];
  
  const emojis = ["👋", "✨", "🚀", "🤝", "🔥", "💎", "🌟"];
  
  const [welcomePrefix] = useState(() => welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)]);
  const [emoji] = useState(() => emojis[Math.floor(Math.random() * emojis.length)]);

  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);

  const { data: folders, isLoading } = useQuery<(Folder & { _count: { sources: number; content: number } })[]>({
    queryKey: ["/api/folders"],
  });

  const createFolderMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; color?: string }) => {
      return apiRequest("POST", "/api/folders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setFolderDialogOpen(false);
      toast({ title: "تم إنشاء المجلد بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في إنشاء المجلد", variant: "destructive" });
    },
  });

  const updateFolderMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; description?: string; color?: string }) => {
      return apiRequest("PATCH", `/api/folders/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setFolderDialogOpen(false);
      setSelectedFolder(null);
      toast({ title: "تم تحديث المجلد بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في تحديث المجلد", variant: "destructive" });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/folders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setDeleteDialogOpen(false);
      setSelectedFolder(null);
      toast({ title: "تم حذف المجلد بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في حذف المجلد", variant: "destructive" });
    },
  });

  const handleAddFolder = () => {
    setSelectedFolder(null);
    setFolderDialogOpen(true);
  };

  const handleEditFolder = (folder: Folder) => {
    setSelectedFolder(folder);
    setFolderDialogOpen(true);
  };

  const handleDeleteFolder = (folder: Folder) => {
    setSelectedFolder(folder);
    setDeleteDialogOpen(true);
  };

  const handleFolderSubmit = (values: { name: string; description?: string; color?: string }) => {
    if (selectedFolder) {
      updateFolderMutation.mutate({ id: selectedFolder.id, ...values });
    } else {
      createFolderMutation.mutate(values);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap bg-primary/5 p-6 rounded-3xl border border-primary/10 shadow-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10">
            <h1 className="text-3xl font-black tracking-tight" data-testid="text-page-title">
              {welcomePrefix} {user?.name || "مستخدم"} {emoji}
            </h1>
            <p className="text-muted-foreground mt-2 max-w-md">
              نظّم مصادرك وأفكارك في نَهْج، وجهتك لإنتاج المحتوى التقني الاحترافي
            </p>
          </div>
          <div className="flex gap-3 relative z-10">
            <Link href="/split-view">
              <Button variant="outline" className="gap-2 bg-background/50 backdrop-blur border-primary/20 hover:border-primary/50 transition-colors shadow-sm" data-testid="button-split-view">
                <Columns2 className="h-4 w-4 text-primary" />
                عرض مقسم
              </Button>
            </Link>
            <Button onClick={handleAddFolder} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.3)] border-none">
              <FolderOpen className="h-4 w-4" />
              مجلد جديد
            </Button>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <div className="w-1 h-6 bg-primary rounded-full" />
            المجلدات
          </h2>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[160px] rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {folders?.map((folder) => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  onEdit={handleEditFolder}
                  onDelete={handleDeleteFolder}
                />
              ))}
              <AddFolderCard onClick={handleAddFolder} />
            </div>
          )}
        </div>
      </div>

      <FolderDialog
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        folder={selectedFolder}
        onSubmit={handleFolderSubmit}
        isLoading={createFolderMutation.isPending || updateFolderMutation.isPending}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="حذف المجلد"
        description={`هل أنت متأكد من حذف المجلد "${selectedFolder?.name}"؟ سيتم حذف جميع المصادر والمحتوى المرتبط به.`}
        onConfirm={() => selectedFolder && deleteFolderMutation.mutate(selectedFolder.id)}
        isLoading={deleteFolderMutation.isPending}
      />
    </MainLayout>
  );
}

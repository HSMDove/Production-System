import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Columns2, FolderOpen } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { FolderCard } from "@/components/folders/folder-card";
import { AddFolderCard } from "@/components/folders/add-folder-card";
import { FolderAdCard } from "@/components/ads/folder-ad-card";
import { FolderDialog } from "@/components/folders/folder-dialog";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useAdSettings } from "@/hooks/use-ad-settings";
import type { Folder } from "@/lib/types";

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { folderAds } = useAdSettings();
  
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
        <div className="dashboard-hero-shell flex flex-wrap items-start justify-between gap-4 p-6 sm:p-7">
          <div className="relative z-10 max-w-2xl">
            <h1 className="text-3xl font-black tracking-tight" data-testid="text-page-title">
              {welcomePrefix} {user?.name || "مستخدم"} {emoji}
            </h1>
            <p className="text-muted-foreground mt-2 max-w-md">
              نظّم مصادرك وأفكارك في نَسَق، واصنع محتوى راقي...
            </p>
          </div>
          <div className="relative z-10 flex flex-wrap gap-3">
            <Link href="/split-view">
              <Button variant="outline" className="gap-2" data-testid="button-split-view">
                <Columns2 className="h-4 w-4 text-primary" />
                عرض مقسم
              </Button>
            </Link>
            <Button onClick={handleAddFolder} className="gap-2">
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
            <div className="grid auto-rows-fr gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[17rem] rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid auto-rows-fr gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {folders?.map((folder, idx) => (
                <>
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    onEdit={handleEditFolder}
                    onDelete={handleDeleteFolder}
                  />
                  {folderAds && idx === 2 && <FolderAdCard key="folder-ad" />}
                </>
              ))}
              {folderAds && (folders?.length ?? 0) < 3 && <FolderAdCard key="folder-ad-end" />}
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

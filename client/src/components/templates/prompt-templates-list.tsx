import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Star, Film } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PromptTemplateDialog } from "./prompt-template-dialog";
import { DeleteDialog } from "@/components/common/delete-dialog";
import type { PromptTemplate } from "@shared/schema";

export function PromptTemplatesList() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);

  const { data: templates, isLoading } = useQuery<PromptTemplate[]>({
    queryKey: ["/api/prompt-templates"],
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/prompt-templates/${id}/set-default`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prompt-templates"] });
      toast({ title: "تم تعيين القالب الافتراضي" });
    },
    onError: () => {
      toast({ title: "فشل في تعيين القالب الافتراضي", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/prompt-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prompt-templates"] });
      toast({ title: "تم حذف السلسلة" });
      setDeleteDialogOpen(false);
    },
    onError: () => {
      toast({ title: "فشل في حذف السلسلة", variant: "destructive" });
    },
  });

  const handleEdit = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    setDialogOpen(true);
  };

  const handleDelete = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    setDeleteDialogOpen(true);
  };

  const handleNewTemplate = () => {
    setSelectedTemplate(null);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" />
            سلاسل المحتوى
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Film className="h-5 w-5 text-primary" />
                سلاسل المحتوى
              </CardTitle>
              <CardDescription>
                أنشئ فورمات المحتوى الخاصة بك (ثلاثيات، شورتس، أخبار يومية...) مع تعليمات مخصصة للذكاء الاصطناعي
              </CardDescription>
            </div>
            <Button onClick={handleNewTemplate} data-testid="button-new-template">
              <Plus className="h-4 w-4 ml-2" />
              سلسلة جديدة
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!templates || templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Film className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>لا توجد سلاسل محتوى بعد</p>
              <p className="text-sm mt-1">
                أنشئ سلسلة مثل "ثلاثيات تقنية" أو "شورتس" مع تعليمات مخصصة
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between gap-4 p-4 rounded-md border bg-card"
                  data-testid={`template-item-${template.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium">{template.name}</h4>
                      {template.isDefault && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="h-3 w-3" />
                          افتراضي
                        </Badge>
                      )}
                      <Badge variant="outline">
                        {template.defaultCount ?? 2} {(template.defaultCount ?? 2) === 1 ? "فكرة" : "أفكار"}
                      </Badge>
                    </div>
                    {template.description && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {template.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!template.isDefault && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDefaultMutation.mutate(template.id)}
                        disabled={setDefaultMutation.isPending}
                        data-testid={`button-set-default-${template.id}`}
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(template)}
                      data-testid={`button-edit-template-${template.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(template)}
                      data-testid={`button-delete-template-${template.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PromptTemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={selectedTemplate}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="حذف السلسلة"
        description={`هل أنت متأكد من حذف "${selectedTemplate?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        onConfirm={() => selectedTemplate && deleteMutation.mutate(selectedTemplate.id)}
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}

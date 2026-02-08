import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sparkles, Loader2, Check, Minus, Plus, ExternalLink, Image, FileText, Link2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PromptTemplate, Folder, Idea } from "@shared/schema";
import { ideaCategoryLabels, categoryColors } from "@/lib/types";

interface SmartGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TemplateCount {
  templateId: string;
  count: number;
}

export function SmartGenerateDialog({
  open,
  onOpenChange,
}: SmartGenerateDialogProps) {
  const { toast } = useToast();
  const [days, setDays] = useState("7");
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [templateCounts, setTemplateCounts] = useState<TemplateCount[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedIdeas, setGeneratedIdeas] = useState<Idea[]>([]);
  const [showResults, setShowResults] = useState(false);

  const { data: templates } = useQuery<PromptTemplate[]>({
    queryKey: ["/api/prompt-templates"],
  });

  const { data: folders } = useQuery<Folder[]>({
    queryKey: ["/api/folders"],
  });

  useEffect(() => {
    if (templates && templates.length > 0 && templateCounts.length === 0) {
      setTemplateCounts(
        templates.map((t) => ({
          templateId: t.id,
          count: t.defaultCount ?? 2,
        }))
      );
    }
  }, [templates, templateCounts.length]);

  useEffect(() => {
    if (folders && folders.length > 0 && !selectedFolderId) {
      setSelectedFolderId(folders[0].id);
    }
  }, [folders, selectedFolderId]);

  const updateCount = (templateId: string, delta: number) => {
    setTemplateCounts((prev) =>
      prev.map((tc) =>
        tc.templateId === templateId
          ? { ...tc, count: Math.max(0, Math.min(10, tc.count + delta)) }
          : tc
      )
    );
  };

  const setCount = (templateId: string, count: number) => {
    setTemplateCounts((prev) =>
      prev.map((tc) =>
        tc.templateId === templateId ? { ...tc, count } : tc
      )
    );
  };

  const totalIdeas = templateCounts.reduce((sum, tc) => sum + tc.count, 0);
  const activeTemplates = templateCounts.filter((tc) => tc.count > 0);

  const handleGenerate = async () => {
    if (!selectedFolderId || activeTemplates.length === 0) return;

    setIsGenerating(true);
    setProgress(10);
    setGeneratedIdeas([]);

    try {
      setProgress(30);
      const response = await apiRequest("POST", "/api/generate-smart-ideas", {
        folderId: selectedFolderId,
        days: parseInt(days),
        templates: activeTemplates.map((tc) => ({
          templateId: tc.templateId,
          count: tc.count,
        })),
      });

      setProgress(90);

      const data = response as { success?: boolean; ideas?: Idea[]; totalGenerated?: number; error?: string };
      
      if (data.error || !data.ideas) {
        throw new Error(data.error || "Invalid response from server");
      }

      setGeneratedIdeas(data.ideas);
      setProgress(100);
      setShowResults(true);
      setIsGenerating(false);

      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
      toast({
        title: `تم توليد ${data.totalGenerated || data.ideas.length} فكرة بنجاح`,
      });
    } catch (error) {
      toast({
        title: "خطأ في التوليد",
        description: "فشل في توليد الأفكار. حاول مرة أخرى.",
        variant: "destructive",
      });
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setIsGenerating(false);
      setProgress(0);
      setShowResults(false);
      setGeneratedIdeas([]);
    }, 300);
  };

  const selectedFolder = folders?.find((f) => f.id === selectedFolderId);

  if (showResults && generatedIdeas.length > 0) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              تم توليد {generatedIdeas.length} فكرة
            </DialogTitle>
            <DialogDescription>
              أفكار مبنية على الأخبار الحقيقية من مجلد "{selectedFolder?.name}"
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 max-h-[60vh]">
            <div className="space-y-4 p-1">
              {generatedIdeas.map((idea) => (
                <IdeaResultCard key={idea.id} idea={idea} templates={templates} />
              ))}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button onClick={handleClose} data-testid="button-close-results">
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="dialog-smart-generate">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            توليد أفكار ذكية
          </DialogTitle>
          <DialogDescription>
            اختر سلاسل المحتوى وعدد الأفكار لكل سلسلة، والذكاء الاصطناعي سيولّد أفكاراً مبنية على الأخبار الحقيقية
          </DialogDescription>
        </DialogHeader>

        {!isGenerating ? (
          <>
            <div className="space-y-5 py-2 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>المجلد</Label>
                  <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
                    <SelectTrigger data-testid="select-folder">
                      <SelectValue placeholder="اختر المجلد" />
                    </SelectTrigger>
                    <SelectContent>
                      {folders?.map((folder) => (
                        <SelectItem key={folder.id} value={folder.id}>
                          {folder.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>فترة الأخبار</Label>
                  <Select value={days} onValueChange={setDays}>
                    <SelectTrigger data-testid="select-days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">يوم واحد</SelectItem>
                      <SelectItem value="3">3 أيام</SelectItem>
                      <SelectItem value="7">أسبوع</SelectItem>
                      <SelectItem value="14">أسبوعين</SelectItem>
                      <SelectItem value="30">شهر</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">سلاسل المحتوى</Label>
                  <Badge variant="secondary">
                    {totalIdeas} فكرة إجمالاً
                  </Badge>
                </div>

                {!templates || templates.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground border rounded-md">
                    <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">لا توجد سلاسل محتوى بعد</p>
                    <p className="text-xs mt-1">
                      أنشئ سلاسل من صفحة الإعدادات أولاً
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templates.map((template) => {
                      const tc = templateCounts.find(
                        (tc) => tc.templateId === template.id
                      );
                      const count = tc?.count ?? 0;

                      return (
                        <div
                          key={template.id}
                          className={`flex items-center justify-between gap-3 p-3 rounded-md border transition-colors ${
                            count > 0
                              ? "border-primary/30 bg-primary/5"
                              : "border-border"
                          }`}
                          data-testid={`template-row-${template.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm">
                              {template.name}
                            </h4>
                            {template.description && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {template.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => updateCount(template.id, -1)}
                              disabled={count <= 0}
                              data-testid={`button-decrease-${template.id}`}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span
                              className="w-8 text-center font-medium tabular-nums"
                              data-testid={`text-count-${template.id}`}
                            >
                              {count}
                            </span>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => updateCount(template.id, 1)}
                              disabled={count >= 10}
                              data-testid={`button-increase-${template.id}`}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={handleClose}
                data-testid="button-cancel-generate"
              >
                إلغاء
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={totalIdeas === 0 || !selectedFolderId || !templates || templates.length === 0}
                data-testid="button-start-generate"
              >
                <Sparkles className="ml-2 h-4 w-4" />
                توليد {totalIdeas} فكرة
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="py-8 space-y-6">
            <div className="flex flex-col items-center text-center">
              {progress < 100 ? (
                <>
                  <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                  <p className="font-medium mb-2">
                    جارٍ تحليل الأخبار وتوليد {totalIdeas} فكرة...
                  </p>
                  <p className="text-sm text-muted-foreground">
                    الذكاء الاصطناعي يقرأ الأخبار الحقيقية ويبني الأفكار عليها
                  </p>
                </>
              ) : (
                <>
                  <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                    <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="font-medium mb-2">
                    تم توليد الأفكار بنجاح!
                  </p>
                </>
              )}
            </div>
            <Progress value={progress} className="h-2" data-testid="progress-generate" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function IdeaResultCard({
  idea,
  templates,
}: {
  idea: Idea;
  templates?: PromptTemplate[];
}) {
  const template = templates?.find((t) => t.id === idea.templateId);
  const catColors = categoryColors[idea.category] || categoryColors.other;

  return (
    <Card data-testid={`result-card-${idea.id}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base leading-relaxed" data-testid={`text-idea-title-${idea.id}`}>
              {idea.title}
            </h3>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {template && (
                <Badge variant="outline" className="text-xs">
                  {template.name}
                </Badge>
              )}
              <Badge className={`${catColors.bg} ${catColors.text} text-xs`}>
                {ideaCategoryLabels[idea.category] || idea.category}
              </Badge>
              {idea.estimatedDuration && (
                <span className="text-xs text-muted-foreground">
                  {idea.estimatedDuration}
                </span>
              )}
            </div>
          </div>
        </div>

        {idea.thumbnailText && (
          <div className="flex items-start gap-2 p-2.5 rounded-md bg-muted/50 border">
            <Image className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-0.5">نص الصورة المصغرة</p>
              <p className="text-sm font-medium" data-testid={`text-thumbnail-${idea.id}`}>{idea.thumbnailText}</p>
            </div>
          </div>
        )}

        {idea.script && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">السكريبت</span>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid={`text-script-${idea.id}`}>
              {idea.script}
            </p>
          </div>
        )}

        {idea.sourceContentTitles && idea.sourceContentTitles.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                المصادر ({idea.sourceContentTitles.length})
              </span>
            </div>
            <div className="space-y-1">
              {idea.sourceContentTitles.map((title, idx) => {
                const url = idea.sourceContentUrls?.[idx];
                return (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-sm p-2 rounded bg-muted/30"
                  >
                    <span className="text-muted-foreground shrink-0 mt-0.5 text-xs">{idx + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm" data-testid={`text-source-title-${idea.id}-${idx}`}>{title}</p>
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary flex items-center gap-1 mt-0.5"
                          data-testid={`link-source-${idea.id}-${idx}`}
                        >
                          <ExternalLink className="h-3 w-3" />
                          المصدر الأصلي
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

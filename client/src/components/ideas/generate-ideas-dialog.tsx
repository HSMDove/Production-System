import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Loader2, Check } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { PromptTemplate } from "@shared/schema";

interface GenerateIdeasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderName: string;
  onGenerate: (days: number, templateId?: string) => void;
  isGenerating: boolean;
  progress: number;
  generatedCount: number;
}

export function GenerateIdeasDialog({
  open,
  onOpenChange,
  folderName,
  onGenerate,
  isGenerating,
  progress,
  generatedCount,
}: GenerateIdeasDialogProps) {
  const [days, setDays] = useState("3");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("builtin");

  const { data: templates } = useQuery<PromptTemplate[]>({
    queryKey: ["/api/prompt-templates"],
  });

  // Set initial template to user's default if one exists
  // Also reset to builtin if the selected template no longer exists
  useEffect(() => {
    if (templates) {
      // Check if current selection still exists (unless it's builtin)
      if (selectedTemplateId !== "builtin") {
        const stillExists = templates.find((t) => t.id === selectedTemplateId);
        if (!stillExists) {
          // Reset to default or builtin
          const defaultTemplate = templates.find((t) => t.isDefault);
          setSelectedTemplateId(defaultTemplate?.id ?? "builtin");
          return;
        }
      }
      // On first load, select user's default if available
      if (selectedTemplateId === "builtin") {
        const defaultTemplate = templates.find((t) => t.isDefault);
        if (defaultTemplate) {
          setSelectedTemplateId(defaultTemplate.id);
        }
      }
    }
  }, [templates, selectedTemplateId]);

  const handleGenerate = () => {
    // Pass the selectedTemplateId directly - "builtin" will be recognized by the API
    onGenerate(parseInt(days), selectedTemplateId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-generate-ideas">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            توليد أفكار فيديو
          </DialogTitle>
          <DialogDescription>
            سيقوم الذكاء الاصطناعي بتحليل المحتوى في مجلد "{folderName}" وتوليد أفكار فيديو مناسبة لقناة نظام الإنتاج
          </DialogDescription>
        </DialogHeader>

        {!isGenerating ? (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>تحليل محتوى آخر</Label>
                <Select value={days} onValueChange={setDays}>
                  <SelectTrigger data-testid="select-generate-days">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">اليوم</SelectItem>
                    <SelectItem value="3">3 أيام</SelectItem>
                    <SelectItem value="7">أسبوع</SelectItem>
                    <SelectItem value="14">أسبوعين</SelectItem>
                    <SelectItem value="30">شهر</SelectItem>
                    <SelectItem value="90">3 أشهر</SelectItem>
                    <SelectItem value="180">6 أشهر</SelectItem>
                    <SelectItem value="365">سنة</SelectItem>
                    <SelectItem value="1095">3 سنوات</SelectItem>
                    <SelectItem value="1825">5 سنوات</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>قالب التوليد</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger data-testid="select-prompt-template">
                    <SelectValue placeholder="اختر قالب التوليد" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="builtin">القالب المدمج (نظام الإنتاج)</SelectItem>
                    {templates?.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                        {template.isDefault && " (افتراضي)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-md border p-3 bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  سيتم توليد أفكار بصيغ نظام الإنتاج المعتمدة:
                </p>
                <ul className="mt-2 text-sm space-y-1">
                  <li>• ثلاثيات (Thalathiyat)</li>
                  <li>• ليه؟ (Leh?)</li>
                  <li>• Tech I Use</li>
                  <li>• ملخص الأخبار</li>
                  <li>• تحليل معمّق</li>
                </ul>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-generate"
              >
                إلغاء
              </Button>
              <Button onClick={handleGenerate} data-testid="button-start-generate">
                <Sparkles className="ml-2 h-4 w-4" />
                بدء التوليد
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="py-8 space-y-6">
            <div className="flex flex-col items-center text-center">
              {progress < 100 ? (
                <>
                  <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                  <p className="font-medium mb-2">جارٍ تحليل المحتوى وتوليد الأفكار...</p>
                  <p className="text-sm text-muted-foreground">
                    قد يستغرق هذا بضع ثوانٍ
                  </p>
                </>
              ) : (
                <>
                  <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                    <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="font-medium mb-2">تم توليد {generatedCount} فكرة بنجاح!</p>
                  <p className="text-sm text-muted-foreground">
                    يمكنك مراجعتها في صفحة الأفكار
                  </p>
                </>
              )}
            </div>
            <Progress value={progress} className="h-2" data-testid="progress-generate" />
            {progress >= 100 && (
              <div className="flex justify-center">
                <Button onClick={() => onOpenChange(false)} data-testid="button-close-generate">
                  إغلاق
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

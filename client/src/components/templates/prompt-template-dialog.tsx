import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PromptTemplate } from "@shared/schema";

const formSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  description: z.string().optional(),
  promptContent: z.string().min(1, "محتوى القالب مطلوب"),
});

type FormData = z.infer<typeof formSchema>;

interface PromptTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: PromptTemplate | null;
}

export function PromptTemplateDialog({
  open,
  onOpenChange,
  template,
}: PromptTemplateDialogProps) {
  const { toast } = useToast();
  const isEditing = !!template;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: template?.name || "",
      description: template?.description || "",
      promptContent: template?.promptContent || getDefaultPromptTemplate(),
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("POST", "/api/prompt-templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prompt-templates"] });
      toast({ title: "تم إنشاء القالب بنجاح" });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "فشل في إنشاء القالب", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("PATCH", `/api/prompt-templates/${template!.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prompt-templates"] });
      toast({ title: "تم تحديث القالب بنجاح" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "فشل في تحديث القالب", variant: "destructive" });
    },
  });

  const onSubmit = (data: FormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "تعديل القالب" : "قالب جديد"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "قم بتعديل محتوى قالب الأوامر"
              : "أنشئ قالب أوامر مخصص لتوليد الأفكار"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اسم القالب</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="مثال: قالب الأخبار السريعة"
                      {...field}
                      data-testid="input-template-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الوصف (اختياري)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="وصف مختصر للقالب"
                      {...field}
                      data-testid="input-template-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="promptContent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>محتوى القالب</FormLabel>
                  <FormDescription>
                    استخدم {"{{FOLDER_NAME}}"} لاسم المجلد و {"{{CONTENT_SUMMARY}}"} لملخص المحتوى
                  </FormDescription>
                  <FormControl>
                    <Textarea
                      className="min-h-[300px] font-mono text-sm"
                      placeholder="اكتب نص الأمر هنا..."
                      {...field}
                      data-testid="input-template-content"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                data-testid="button-save-template"
              >
                {isPending ? "جاري الحفظ..." : isEditing ? "حفظ التغييرات" : "إنشاء القالب"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function getDefaultPromptTemplate(): string {
  return `أنت منتج محتوى تقني عربي متخصص في إنشاء أفكار فيديوهات لقناة يوتيوب تقنية عربية تُدعى "Tech Voice".

بناءً على الأخبار التقنية التالية في مجال "{{FOLDER_NAME}}":

{{CONTENT_SUMMARY}}

قم بإنشاء 3-5 أفكار فيديو مبتكرة. لكل فكرة، قدم:
- عنوان جذاب بالعربية
- وصف مختصر (2-3 جمل)
- نوع الفيديو من القائمة التالية فقط: thalathiyat (ثلاثيات - فيديوهات قصيرة), leh (ليه - شرح أسباب), tech_i_use (تقنية أستخدمها), news_roundup (ملخص أخبار), deep_dive (تعمق), comparison (مقارنة), tutorial (شرح), other (أخرى)
- المدة التقريبية (مثل: 5-8 دقائق)
- الجمهور المستهدف

أجب بصيغة JSON فقط بالشكل التالي:
{
  "ideas": [
    {
      "title": "العنوان",
      "description": "الوصف",
      "category": "نوع الفيديو",
      "estimatedDuration": "المدة",
      "targetAudience": "الجمهور"
    }
  ]
}`;
}

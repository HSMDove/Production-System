import { useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PromptTemplate } from "@shared/schema";

const formSchema = z.object({
  name: z.string().min(1, "اسم السلسلة مطلوب"),
  description: z.string().optional(),
  promptContent: z.string().min(1, "تعليمات المحتوى مطلوبة"),
  defaultCount: z.number().min(1).max(10).default(2),
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
      name: "",
      description: "",
      promptContent: "",
      defaultCount: 2,
    },
  });

  useEffect(() => {
    if (open) {
      if (template) {
        form.reset({
          name: template.name,
          description: template.description || "",
          promptContent: template.promptContent,
          defaultCount: template.defaultCount ?? 2,
        });
      } else {
        form.reset({
          name: "",
          description: "",
          promptContent: "",
          defaultCount: 2,
        });
      }
    }
  }, [open, template, form]);

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
            {isEditing ? "تعديل سلسلة المحتوى" : "سلسلة محتوى جديدة"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "عدّل اسم السلسلة وتعليمات الذكاء الاصطناعي"
              : "أنشئ سلسلة محتوى جديدة مع تعليمات مخصصة للذكاء الاصطناعي"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اسم السلسلة</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="مثال: ثلاثيات تقنية، أخبار سريعة، شورتس..."
                      {...field}
                      data-testid="input-template-name"
                    />
                  </FormControl>
                  <FormDescription>
                    اسم الفورمات أو السلسلة (مثل: ثلاثيات، أخبار يومية، شورتس)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>وصف مختصر (اختياري)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="وصف قصير يظهر في قائمة السلاسل"
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
              name="defaultCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>العدد الافتراضي</FormLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(v) => field.onChange(parseInt(v))}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-default-count">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} {n === 1 ? "فكرة" : "أفكار"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    عدد الأفكار الافتراضي عند التوليد
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="promptContent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>تعليمات المحتوى</FormLabel>
                  <FormDescription>
                    اكتب التعليمات بكلامك العادي. النظام يضيف الأخبار واسم المجلد والعدد تلقائياً - لا حاجة لأي رموز خاصة.
                  </FormDescription>
                  <FormControl>
                    <Textarea
                      className="min-h-[250px] text-sm"
                      placeholder={`مثال: ابحث في الأخبار عن أخبار متعلقة ببعض وادمجها في فيديو واحد بعنوان جذاب\n\nأو: اختر أخبار مناسبة لفيديو شورتس قصير (أقل من دقيقة) مع التركيز على الأخبار المثيرة\n\nأو: ركّز على أخبار الذكاء الاصطناعي وقدّمها بأسلوب مبسّط للجمهور العربي`}
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
                {isPending ? "جاري الحفظ..." : isEditing ? "حفظ التغييرات" : "إنشاء السلسلة"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

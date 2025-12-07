import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { IdeaWithFolder, Folder } from "@/lib/types";
import { ideaStatusLabels, ideaCategoryLabels } from "@/lib/types";

const ideaFormSchema = z.object({
  title: z.string().min(1, "عنوان الفكرة مطلوب"),
  description: z.string().optional(),
  category: z.enum(["thalathiyat", "leh", "tech_i_use", "news_roundup", "deep_dive", "comparison", "tutorial", "other"]),
  status: z.enum(["raw_idea", "needs_research", "ready_for_script", "script_in_progress", "ready_for_filming", "completed"]),
  estimatedDuration: z.string().optional(),
  targetAudience: z.string().optional(),
  notes: z.string().optional(),
  folderId: z.string().nullable().optional(),
});

type IdeaFormValues = z.infer<typeof ideaFormSchema>;

interface IdeaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idea?: IdeaWithFolder | null;
  folders?: Folder[];
  onSubmit: (values: IdeaFormValues) => void;
  isLoading?: boolean;
}

export function IdeaDialog({
  open,
  onOpenChange,
  idea,
  folders = [],
  onSubmit,
  isLoading,
}: IdeaDialogProps) {
  const form = useForm<IdeaFormValues>({
    resolver: zodResolver(ideaFormSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "other",
      status: "raw_idea",
      estimatedDuration: "",
      targetAudience: "",
      notes: "",
      folderId: null,
    },
  });

  useEffect(() => {
    if (idea) {
      form.reset({
        title: idea.title,
        description: idea.description || "",
        category: idea.category,
        status: idea.status,
        estimatedDuration: idea.estimatedDuration || "",
        targetAudience: idea.targetAudience || "",
        notes: idea.notes || "",
        folderId: idea.folderId || null,
      });
    } else {
      form.reset({
        title: "",
        description: "",
        category: "other",
        status: "raw_idea",
        estimatedDuration: "",
        targetAudience: "",
        notes: "",
        folderId: null,
      });
    }
  }, [idea, form]);

  const handleSubmit = (values: IdeaFormValues) => {
    onSubmit(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-idea">
        <DialogHeader>
          <DialogTitle>
            {idea ? "تعديل الفكرة" : "إضافة فكرة جديدة"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>عنوان الفكرة</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="عنوان الفيديو المقترح"
                      {...field}
                      data-testid="input-idea-title"
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
                  <FormLabel>الوصف</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="وصف تفصيلي للفكرة"
                      className="resize-none"
                      rows={3}
                      {...field}
                      data-testid="input-idea-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الفئة</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-idea-category">
                          <SelectValue placeholder="اختر الفئة" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(ideaCategoryLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الحالة</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-idea-status">
                          <SelectValue placeholder="اختر الحالة" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(ideaStatusLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="estimatedDuration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>المدة المتوقعة</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="مثال: 10 دقائق"
                        {...field}
                        data-testid="input-idea-duration"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="targetAudience"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الجمهور المستهدف</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="مثال: مهتمين بالتقنية"
                        {...field}
                        data-testid="input-idea-audience"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {folders.length > 0 && (
              <FormField
                control={form.control}
                name="folderId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>المجلد</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-idea-folder">
                          <SelectValue placeholder="اختر المجلد (اختياري)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">بدون مجلد</SelectItem>
                        {folders.map((folder) => (
                          <SelectItem key={folder.id} value={folder.id}>
                            {folder.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ملاحظات</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="ملاحظات إضافية..."
                      className="resize-none"
                      rows={3}
                      {...field}
                      data-testid="input-idea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-idea"
              >
                إلغاء
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading}
                data-testid="button-submit-idea"
              >
                {isLoading ? "جارٍ الحفظ..." : idea ? "حفظ التغييرات" : "إضافة الفكرة"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

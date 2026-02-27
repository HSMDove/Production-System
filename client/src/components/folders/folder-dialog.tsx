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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { Folder } from "@/lib/types";

const folderFormSchema = z.object({
  name: z.string().min(1, "اسم المجلد مطلوب"),
  description: z.string().optional(),
  color: z.string().default("#3b82f6"),
});

type FolderFormValues = z.infer<typeof folderFormSchema>;

interface FolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder?: Folder | null;
  onSubmit: (values: FolderFormValues) => void;
  isLoading?: boolean;
}

const colorOptions = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
];

export function FolderDialog({
  open,
  onOpenChange,
  folder,
  onSubmit,
  isLoading,
}: FolderDialogProps) {
  const form = useForm<FolderFormValues>({
    resolver: zodResolver(folderFormSchema),
    defaultValues: {
      name: "",
      description: "",
      color: "#3b82f6",
    },
  });

  useEffect(() => {
    if (folder) {
      form.reset({
        name: folder.name,
        description: folder.description || "",
        color: folder.color || "#3b82f6",
      });
    } else {
      form.reset({
        name: "",
        description: "",
        color: "#3b82f6",
      });
    }
  }, [folder, form]);

  const handleSubmit = (values: FolderFormValues) => {
    onSubmit(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-folder">
        <DialogHeader>
          <DialogTitle>
            {folder ? "تعديل المجلد" : "إنشاء مجلد جديد"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اسم المجلد</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="مثال: الذكاء الاصطناعي"
                      {...field}
                      data-testid="input-folder-name"
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
                    <Textarea
                      placeholder="وصف مختصر للمجلد"
                      className="resize-none"
                      {...field}
                      data-testid="input-folder-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اللون</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {colorOptions.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => field.onChange(color)}
                          className={`h-8 w-8 rounded-md transition-all ${
                            field.value === color
                              ? "ring-2 ring-offset-2 ring-primary"
                              : ""
                          }`}
                          style={{ backgroundColor: color }}
                          data-testid={`button-color-${color}`}
                        />
                      ))}
                    </div>
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
                data-testid="button-cancel-folder"
              >
                إلغاء
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading}
                data-testid="button-submit-folder"
              >
                {isLoading ? "جارٍ الحفظ..." : folder ? "حفظ التغييرات" : "إنشاء المجلد"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

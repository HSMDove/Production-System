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
import { Button } from "@/components/ui/button";
import type { Source } from "@/lib/types";
import { sourceTypeLabels } from "@/lib/types";

const sourceFormSchema = z.object({
  name: z.string().min(1, "اسم المصدر مطلوب"),
  url: z.string().url("الرابط غير صحيح"),
  type: z.enum(["rss", "website", "youtube", "twitter", "tiktok"]),
});

type SourceFormValues = z.infer<typeof sourceFormSchema>;

interface SourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string;
  source?: Source | null;
  onSubmit: (values: SourceFormValues & { folderId: string }) => void;
  isLoading?: boolean;
}

export function SourceDialog({
  open,
  onOpenChange,
  folderId,
  source,
  onSubmit,
  isLoading,
}: SourceDialogProps) {
  const form = useForm<SourceFormValues>({
    resolver: zodResolver(sourceFormSchema),
    defaultValues: {
      name: "",
      url: "",
      type: "rss",
    },
  });

  useEffect(() => {
    if (source) {
      form.reset({
        name: source.name,
        url: source.url,
        type: source.type,
      });
    } else {
      form.reset({
        name: "",
        url: "",
        type: "rss",
      });
    }
  }, [source, form]);

  const handleSubmit = (values: SourceFormValues) => {
    onSubmit({ ...values, folderId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-source">
        <DialogHeader>
          <DialogTitle>
            {source ? "تعديل المصدر" : "إضافة مصدر جديد"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اسم المصدر</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="مثال: The Verge"
                      {...field}
                      data-testid="input-source-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الرابط</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://example.com/rss"
                      dir="ltr"
                      className="text-left"
                      {...field}
                      data-testid="input-source-url"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نوع المصدر</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-source-type">
                        <SelectValue placeholder="اختر نوع المصدر" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(sourceTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value} data-testid={`option-source-type-${value}`}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-source"
              >
                إلغاء
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading}
                data-testid="button-submit-source"
              >
                {isLoading ? "جارٍ الحفظ..." : source ? "حفظ التغييرات" : "إضافة المصدر"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

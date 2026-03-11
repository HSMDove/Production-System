import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Loader2 } from "lucide-react";
import type { Source } from "@/lib/types";
import { sourceTypeLabels } from "@/lib/types";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const sourceFormSchema = z.object({
  name: z.string().min(1, "اسم المصدر مطلوب"),
  url: z.string().url("الرابط غير صحيح"),
  type: z.enum(["rss", "website", "youtube", "twitter", "tiktok"]),
});

const scoutFormSchema = z.object({
  domain: z.string().min(2, "اكتب المجال المطلوب"),
  language: z.enum(["ar", "en", "all"]),
  sourceTypes: z.array(z.enum(["youtube", "website", "twitter"])).min(1, "اختر نوع مصدر واحد على الأقل"),
  depth: z.enum(["quick", "deep"]),
  contentNature: z.enum(["trending", "evergreen"]),
  desiredCount: z.union([z.literal(2), z.literal(4), z.literal(6)]),
});

type SourceFormValues = z.infer<typeof sourceFormSchema>;
type ScoutFormValues = z.infer<typeof scoutFormSchema>;

interface SourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string;
  source?: Source | null;
  onSubmit: (values: SourceFormValues & { folderId: string }) => void;
  isLoading?: boolean;
}

type ScoutResponse = {
  added: Source[];
  skipped: Array<{ url: string; reason: string }>;
  suggestions: Array<{ name: string; url: string; type: "youtube" | "website" | "twitter"; score: number; reason: string }>;
};

export function SourceDialog({
  open,
  onOpenChange,
  folderId,
  source,
  onSubmit,
  isLoading,
}: SourceDialogProps) {
  const { toast } = useToast();
  const [showScoutWizard, setShowScoutWizard] = useState(false);

  const form = useForm<SourceFormValues>({
    resolver: zodResolver(sourceFormSchema),
    defaultValues: {
      name: "",
      url: "",
      type: "rss",
    },
  });

  const scoutForm = useForm<ScoutFormValues>({
    resolver: zodResolver(scoutFormSchema),
    defaultValues: {
      domain: "",
      language: "all",
      sourceTypes: ["youtube", "website"],
      depth: "quick",
      contentNature: "trending",
      desiredCount: 4,
    },
  });

  const scoutMutation = useMutation({
    mutationFn: async (payload: ScoutFormValues) => {
      return apiRequest<ScoutResponse>("POST", `/api/folders/${folderId}/magic-scout`, payload);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders", folderId, "sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders", folderId, "content"] });
      toast({
        title: "تم تنفيذ فكري الكشّاف",
        description: `تمت إضافة ${result.added.length} مصدر جديد${result.skipped.length ? `، وتخطي ${result.skipped.length}` : ""}`,
      });
      setShowScoutWizard(false);
      scoutForm.reset({
        domain: "",
        language: "all",
        sourceTypes: ["youtube", "website"],
        depth: "quick",
        contentNature: "trending",
        desiredCount: 4,
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "تعذّر تنفيذ البحث",
        description: error?.message || "حدث خطأ أثناء بحث فكري عن المصادر",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (source) {
      form.reset({
        name: source.name,
        url: source.url,
        type: source.type,
      });
      setShowScoutWizard(false);
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

  const selectedScoutTypes = scoutForm.watch("sourceTypes");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-testid="dialog-source">
        <DialogHeader>
          <DialogTitle>
            {source ? "تعديل المصدر" : "إضافة مصدر جديد"}
          </DialogTitle>
        </DialogHeader>

        {!source && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium">بدلاً من البحث اليدوي</p>
                  <p className="text-sm text-muted-foreground">دع فكري يبحث ويختار لك مصادر موثوقة تلقائياً.</p>
                </div>
                <Button
                  type="button"
                  variant={showScoutWizard ? "secondary" : "default"}
                  className="gap-2"
                  onClick={() => setShowScoutWizard((prev) => !prev)}
                  data-testid="button-open-magic-scout"
                >
                  <Sparkles className="h-4 w-4" />
                  أطلب من فكري البحث عن مصادر
                </Button>
              </div>

              {showScoutWizard && (
                <Form {...scoutForm}>
                  <form onSubmit={scoutForm.handleSubmit((values) => scoutMutation.mutate(values))} className="space-y-4 border-t pt-4">
                    <FormField
                      control={scoutForm.control}
                      name="domain"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ما هو مجالك؟</FormLabel>
                          <FormControl>
                            <Input placeholder="مثال: الذكاء الاصطناعي في التعليم" {...field} data-testid="input-scout-domain" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={scoutForm.control}
                        name="language"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>لغة المصادر</FormLabel>
                            <div className="flex gap-2 flex-wrap">
                              {[{ value: "ar", label: "عربي" }, { value: "en", label: "إنجليزي" }, { value: "all", label: "الكل" }].map((item) => (
                                <Button key={item.value} type="button" size="sm" variant={field.value === item.value ? "default" : "outline"} onClick={() => field.onChange(item.value)}>
                                  {item.label}
                                </Button>
                              ))}
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={scoutForm.control}
                        name="desiredCount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>كم مصدر تريد؟</FormLabel>
                            <div className="flex gap-2 flex-wrap">
                              {[2, 4, 6].map((count) => (
                                <Button key={count} type="button" size="sm" variant={field.value === count ? "default" : "outline"} onClick={() => field.onChange(count as 2 | 4 | 6)}>
                                  {count}
                                </Button>
                              ))}
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={scoutForm.control}
                      name="sourceTypes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>نوع المصادر</FormLabel>
                          <div className="flex gap-2 flex-wrap">
                            {[
                              { value: "youtube", label: "يوتيوب" },
                              { value: "website", label: "مواقع" },
                              { value: "twitter", label: "X" },
                            ].map((item) => {
                              const active = selectedScoutTypes.includes(item.value as "youtube" | "website" | "twitter");
                              return (
                                <Button
                                  key={item.value}
                                  type="button"
                                  size="sm"
                                  variant={active ? "default" : "outline"}
                                  onClick={() => {
                                    const set = new Set(selectedScoutTypes);
                                    if (set.has(item.value as any)) {
                                      set.delete(item.value as any);
                                    } else {
                                      set.add(item.value as any);
                                    }
                                    field.onChange(Array.from(set));
                                  }}
                                >
                                  {item.label}
                                </Button>
                              );
                            })}
                            <Button
                              type="button"
                              size="sm"
                              variant={selectedScoutTypes.length === 3 ? "default" : "outline"}
                              onClick={() => field.onChange(["youtube", "website", "twitter"])}
                            >
                              الكل
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={scoutForm.control}
                        name="depth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>مستوى العمق</FormLabel>
                            <div className="flex gap-2 flex-wrap">
                              <Button type="button" size="sm" variant={field.value === "quick" ? "default" : "outline"} onClick={() => field.onChange("quick")}>سريع وبسيط</Button>
                              <Button type="button" size="sm" variant={field.value === "deep" ? "default" : "outline"} onClick={() => field.onChange("deep")}>عميق وتفصيلي</Button>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={scoutForm.control}
                        name="contentNature"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>طبيعة المحتوى</FormLabel>
                            <div className="flex gap-2 flex-wrap">
                              <Button type="button" size="sm" variant={field.value === "trending" ? "default" : "outline"} onClick={() => field.onChange("trending")}>أخبار وتريندات</Button>
                              <Button type="button" size="sm" variant={field.value === "evergreen" ? "default" : "outline"} onClick={() => field.onChange("evergreen")}>تعليمي ومستمر</Button>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
                        <Badge variant="outline">بحث ويب عميق</Badge>
                        <Badge variant="outline">فلترة جودة</Badge>
                        <Badge variant="outline">إضافة تلقائية للمجلد</Badge>
                      </div>
                      <Button type="submit" disabled={scoutMutation.isPending} data-testid="button-run-magic-scout">
                        {scoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "ابدأ البحث"}
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        )}

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

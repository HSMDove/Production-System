import { useEffect, useState } from "react";
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
  color: z.string().default("#6d8df7"),
  emoji: z.string().default("📁"),
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
  "#6d8df7",
  "#63c3ab",
  "#e6b363",
  "#e5867a",
  "#9a84f7",
  "#e58fbd",
  "#58b8c6",
  "#e89b69",
];

const emojiOptions = [
  "📁", "📂", "🗂️", "📰", "🌐", "💻", "📱", "🤖",
  "🧠", "🔬", "🚀", "💡", "📊", "📈", "🎯", "⚡",
  "🔥", "💎", "🏠", "🏢", "🎮", "🎬", "📸", "🎵",
  "📚", "✍️", "🛡️", "⚙️", "🔗", "🗞️", "📡", "🌍",
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
      color: "#6d8df7",
      emoji: "📁",
    },
  });

  useEffect(() => {
    if (folder) {
      form.reset({
        name: folder.name,
        description: folder.description || "",
        color: folder.color || "#6d8df7",
        emoji: folder.emoji || "📁",
      });
    } else {
      form.reset({
        name: "",
        description: "",
        color: "#6d8df7",
        emoji: "📁",
      });
    }
  }, [folder, form]);

  const handleSubmit = (values: FolderFormValues) => {
    onSubmit(values);
  };

  const selectedColor = form.watch("color");

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
            <div className="flex items-start gap-3">
              <FormField
                control={form.control}
                name="emoji"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الشعار</FormLabel>
                    <FormControl>
                      <EmojiPicker
                        value={field.value}
                        onChange={field.onChange}
                        color={selectedColor}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="flex-1">
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
            </div>
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
                          className={`h-9 w-9 rounded-xl border-[2px] border-border shadow-[0_3px_0_0_rgba(0,0,0,0.22)] transition-all ${
                            field.value === color
                              ? "ring-2 ring-offset-2 ring-primary scale-105"
                              : ""
                          }`}
                          style={{
                            backgroundColor: color,
                            backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0))",
                          }}
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

function EmojiPicker({ value, onChange, color }: { value: string; onChange: (v: string) => void; color: string }) {
  const [showGrid, setShowGrid] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowGrid(!showGrid)}
        className="flex h-11 w-11 items-center justify-center rounded-xl border-[2px] border-border text-xl transition-transform hover:scale-110"
        style={{
          backgroundColor: color,
          backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0))",
        }}
        data-testid="button-emoji-picker"
      >
        {value}
      </button>
      {showGrid && (
        <div className="absolute top-full right-0 mt-2 z-50 w-[240px] rounded-xl border-[3px] border-border bg-popover p-2 shadow-[var(--nb-shadow)]">
          <div className="grid grid-cols-8 gap-1">
            {emojiOptions.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => { onChange(emoji); setShowGrid(false); }}
                className={`emoji-picker-item flex h-7 w-7 items-center justify-center rounded-lg text-base hover:bg-muted ${value === emoji ? "bg-primary/20 ring-1 ring-primary" : ""}`}
                data-testid={`button-emoji-${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

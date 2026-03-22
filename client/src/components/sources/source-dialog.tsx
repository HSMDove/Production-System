import { useEffect, useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, LinkIcon, Globe, Youtube, Twitter, Sparkles } from "lucide-react";
import type { Source } from "@/lib/types";
import { sourceTypeLabels } from "@/lib/types";

interface AnalyzeResult {
  type: string;
  name: string | null;
  verified: boolean;
  feedUrl: string | null;
  error: string | null;
}

interface SourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string;
  source?: Source | null;
  onSubmit: (values: { name: string; url: string; type: string; folderId: string }) => void;
  isLoading?: boolean;
}

const typeIcons: Record<string, typeof Globe> = {
  youtube: Youtube,
  twitter: Twitter,
  website: Globe,
  rss: Globe,
  tiktok: Globe,
};

const typeBadgeColors: Record<string, string> = {
  youtube: "bg-red-500/15 text-red-600 border-red-500/30",
  twitter: "bg-sky-500/15 text-sky-600 border-sky-500/30",
  rss: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  website: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  tiktok: "bg-pink-500/15 text-pink-600 border-pink-500/30",
};

export function SourceDialog({
  open,
  onOpenChange,
  folderId,
  source,
  onSubmit,
  isLoading,
}: SourceDialogProps) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [nameEdited, setNameEdited] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAnalyzedUrl = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      if (source) {
        setUrl(source.url);
        setName(source.name);
        setAnalysis({ type: source.type, name: source.name, verified: true, feedUrl: null, error: null });
        setNameEdited(true);
        lastAnalyzedUrl.current = source.url;
      } else {
        setUrl("");
        setName("");
        setAnalysis(null);
        setNameEdited(false);
        lastAnalyzedUrl.current = "";
      }
      setAnalyzing(false);
    }
  }, [open, source]);

  const analyzeUrl = useCallback(async (rawUrl: string) => {
    if (!rawUrl || rawUrl.length < 5) {
      setAnalysis(null);
      return;
    }
    const normalizedUrl = rawUrl.trim();
    if (normalizedUrl === lastAnalyzedUrl.current) return;
    lastAnalyzedUrl.current = normalizedUrl;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const res = await fetch("/api/sources/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: normalizedUrl }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "خطأ في الخادم" }));
        setAnalysis({ type: "website", name: null, verified: false, feedUrl: null, error: errData.error || "خطأ في التحليل" });
        return;
      }
      const data: AnalyzeResult = await res.json();
      setAnalysis(data);
      if (data.name && !nameEdited) {
        setName(data.name);
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setAnalysis({ type: "website", name: null, verified: false, feedUrl: null, error: "فشل الاتصال بالخادم" });
    } finally {
      setAnalyzing(false);
    }
  }, [nameEdited]);

  const handleUrlChange = (value: string) => {
    setUrl(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => analyzeUrl(value), 800);
  };

  const handleUrlBlur = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (url.trim().length >= 5 && url.trim() !== lastAnalyzedUrl.current) {
      analyzeUrl(url);
    }
  };

  const handleNameChange = (value: string) => {
    setName(value);
    setNameEdited(true);
  };

  const handleSubmit = () => {
    if (!url.trim() || !name.trim()) return;
    const type = analysis?.type || "website";
    onSubmit({ name: name.trim(), url: url.trim(), type, folderId });
  };

  const canSubmit = url.trim().length > 0 && name.trim().length > 0 && !analyzing && !isLoading && (source ? true : analysis?.verified === true);

  const TypeIcon = analysis ? typeIcons[analysis.type] || Globe : LinkIcon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-source">
        <DialogHeader>
          <DialogTitle>
            {source ? "تعديل المصدر" : "إضافة مصدر جديد"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-2">
              <LinkIcon className="h-3.5 w-3.5" />
              رابط المصدر
            </label>
            <div className="relative">
              <Input
                placeholder="الصق الرابط هنا — يوتيوب، تويتر، موقع..."
                dir="ltr"
                className="text-left pr-10"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                onBlur={handleUrlBlur}
                data-testid="input-source-url"
                autoFocus={!source}
              />
              <div className="absolute left-2 top-1/2 -translate-y-1/2">
                {analyzing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {!analyzing && analysis?.verified && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                {!analyzing && analysis && !analysis.verified && <XCircle className="h-4 w-4 text-red-500" />}
              </div>
            </div>
          </div>

          {analysis && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`gap-1 text-xs ${typeBadgeColors[analysis.type] || ""}`}>
                <TypeIcon className="h-3 w-3" />
                {sourceTypeLabels[analysis.type] || analysis.type}
              </Badge>
              {analysis.verified && (
                <Badge variant="outline" className="gap-1 text-xs bg-green-500/10 text-green-600 border-green-500/30">
                  <CheckCircle2 className="h-3 w-3" />
                  جاهز للجلب
                </Badge>
              )}
              {analysis.feedUrl && analysis.type !== "twitter" && (
                <Badge variant="outline" className="gap-1 text-xs bg-orange-500/10 text-orange-600 border-orange-500/30">
                  <Sparkles className="h-3 w-3" />
                  RSS
                </Badge>
              )}
            </div>
          )}

          {analysis?.error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2" data-testid="text-source-error">
              {analysis.error}
            </p>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-2">
              اسم المصدر
              {analysis?.name && !nameEdited && (
                <span className="text-[10px] text-muted-foreground font-normal">(تم اكتشافه تلقائياً)</span>
              )}
            </label>
            <Input
              placeholder={analyzing ? "جارٍ اكتشاف الاسم..." : "مثال: The Verge"}
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={analyzing}
              data-testid="input-source-name"
            />
          </div>
        </div>

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
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-testid="button-submit-source"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin ml-1.5" /> جارٍ الحفظ...</>
            ) : source ? "حفظ التغييرات" : "إضافة المصدر"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

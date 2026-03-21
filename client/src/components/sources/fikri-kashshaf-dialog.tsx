import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Telescope,
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Globe,
  Youtube,
  Twitter,
  Layers,
  Zap,
  BookOpen,
  TrendingUp,
  GraduationCap,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface FikriKashshafDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string;
}

interface DiscoverPrefs {
  field: string;
  language: "arabic" | "english" | "all";
  sourceTypes: "youtube" | "website" | "twitter" | "all";
  depth: "quick" | "deep";
  contentNature: "news" | "educational";
  count: 2 | 4 | 6;
}

interface DiscoveredSource {
  id: string;
  name: string;
  url: string;
  type: string;
}

type WizardStep = "field" | "language" | "sourceTypes" | "depth" | "contentNature" | "count" | "loading" | "done" | "error";

const STEP_ORDER: WizardStep[] = ["field", "language", "sourceTypes", "depth", "contentNature", "count"];
const TOTAL_STEPS = STEP_ORDER.length;

function OptionButton({
  selected,
  onClick,
  icon,
  label,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full rounded-xl border-2 px-4 py-3 text-right transition-all duration-150",
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
      )}
      data-testid={`option-${label}`}
    >
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", selected ? "bg-primary/20" : "bg-muted")}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className={cn("h-4 w-4 shrink-0 rounded-full border-2 transition-all", selected ? "border-primary bg-primary" : "border-border")} />
    </button>
  );
}

export function FikriKashshafDialog({ open, onOpenChange, folderId }: FikriKashshafDialogProps) {
  const [step, setStep] = useState<WizardStep>("field");
  const [prefs, setPrefs] = useState<DiscoverPrefs>({
    field: "",
    language: "all",
    sourceTypes: "all",
    depth: "deep",
    contentNature: "news",
    count: 4,
  });
  const [addedSources, setAddedSources] = useState<DiscoveredSource[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const currentStepIdx = STEP_ORDER.indexOf(step);
  const progressValue = currentStepIdx >= 0 ? Math.round(((currentStepIdx + 1) / TOTAL_STEPS) * 100) : 100;

  const discoverMutation = useMutation({
    mutationFn: async (p: DiscoverPrefs) => {
      return apiRequest<{ success: boolean; addedSources: DiscoveredSource[]; message?: string }>(
        "POST",
        `/api/folders/${folderId}/discover-sources`,
        p
      );
    },
    onSuccess: (data) => {
      setAddedSources(data.addedSources || []);
      queryClient.invalidateQueries({ queryKey: ["/api/folders", folderId, "sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders", folderId, "content"] });
      setStep("done");
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || "حدث خطأ أثناء البحث");
      setStep("error");
    },
  });

  const handleNext = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx < STEP_ORDER.length - 1) {
      setStep(STEP_ORDER[idx + 1]);
    } else {
      setStep("loading");
      discoverMutation.mutate(prefs);
    }
  };

  const handleBack = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]);
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep("field");
      setPrefs({ field: "", language: "all", sourceTypes: "all", depth: "deep", contentNature: "news", count: 4 });
      setAddedSources([]);
      setErrorMsg("");
    }, 300);
  };

  const canProceed = step === "field" ? prefs.field.trim().length > 0 : true;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" dir="rtl" data-testid="dialog-fikri-kashshaf">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Telescope className="h-4 w-4 text-primary" />
            </div>
            <span>فكري الكشّاف</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Progress bar - only shown during wizard steps */}
          {currentStepIdx >= 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>الخطوة {currentStepIdx + 1} من {TOTAL_STEPS}</span>
                <span>{progressValue}%</span>
              </div>
              <Progress value={progressValue} className="h-1.5" />
            </div>
          )}

          {/* Step: field */}
          {step === "field" && (
            <div className="space-y-3" data-testid="step-field">
              <p className="font-semibold">ما هو مجالك؟</p>
              <p className="text-sm text-muted-foreground">اكتب المجال الذي تريد فكري أن يبحث له عن مصادر موثوقة</p>
              <Input
                placeholder="مثال: الذكاء الاصطناعي، التسويق الرقمي، علم النفس..."
                value={prefs.field}
                onChange={(e) => setPrefs((p) => ({ ...p, field: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && canProceed && handleNext()}
                autoFocus
                data-testid="input-field"
              />
            </div>
          )}

          {/* Step: language */}
          {step === "language" && (
            <div className="space-y-3" data-testid="step-language">
              <p className="font-semibold">لغة المصادر؟</p>
              <div className="space-y-2">
                <OptionButton
                  selected={prefs.language === "arabic"}
                  onClick={() => setPrefs((p) => ({ ...p, language: "arabic" }))}
                  icon={<span className="text-lg">🇸🇦</span>}
                  label="عربي فقط"
                  description="مصادر باللغة العربية"
                />
                <OptionButton
                  selected={prefs.language === "english"}
                  onClick={() => setPrefs((p) => ({ ...p, language: "english" }))}
                  icon={<span className="text-lg">🇺🇸</span>}
                  label="إنجليزي فقط"
                  description="مصادر باللغة الإنجليزية"
                />
                <OptionButton
                  selected={prefs.language === "all"}
                  onClick={() => setPrefs((p) => ({ ...p, language: "all" }))}
                  icon={<Globe className="h-4 w-4" />}
                  label="الكل"
                  description="عربي وإنجليزي معاً"
                />
              </div>
            </div>
          )}

          {/* Step: sourceTypes */}
          {step === "sourceTypes" && (
            <div className="space-y-3" data-testid="step-source-types">
              <p className="font-semibold">نوع المصادر؟</p>
              <div className="space-y-2">
                <OptionButton
                  selected={prefs.sourceTypes === "youtube"}
                  onClick={() => setPrefs((p) => ({ ...p, sourceTypes: "youtube" }))}
                  icon={<Youtube className="h-4 w-4 text-red-500" />}
                  label="يوتيوب فقط"
                  description="قنوات يوتيوب"
                />
                <OptionButton
                  selected={prefs.sourceTypes === "website"}
                  onClick={() => setPrefs((p) => ({ ...p, sourceTypes: "website" }))}
                  icon={<Globe className="h-4 w-4 text-blue-500" />}
                  label="مواقع فقط"
                  description="مواقع إخبارية ومدونات وRSS"
                />
                <OptionButton
                  selected={prefs.sourceTypes === "twitter"}
                  onClick={() => setPrefs((p) => ({ ...p, sourceTypes: "twitter" }))}
                  icon={<Twitter className="h-4 w-4" />}
                  label="X فقط"
                  description="حسابات منصة X (تويتر)"
                />
                <OptionButton
                  selected={prefs.sourceTypes === "all"}
                  onClick={() => setPrefs((p) => ({ ...p, sourceTypes: "all" }))}
                  icon={<Layers className="h-4 w-4" />}
                  label="الكل"
                  description="جميع أنواع المصادر"
                />
              </div>
            </div>
          )}

          {/* Step: depth */}
          {step === "depth" && (
            <div className="space-y-3" data-testid="step-depth">
              <p className="font-semibold">مستوى العمق؟</p>
              <div className="space-y-2">
                <OptionButton
                  selected={prefs.depth === "quick"}
                  onClick={() => setPrefs((p) => ({ ...p, depth: "quick" }))}
                  icon={<Zap className="h-4 w-4 text-yellow-500" />}
                  label="سريع وبسيط"
                  description="مصادر إخبارية خفيفة وسهلة"
                />
                <OptionButton
                  selected={prefs.depth === "deep"}
                  onClick={() => setPrefs((p) => ({ ...p, depth: "deep" }))}
                  icon={<BookOpen className="h-4 w-4 text-purple-500" />}
                  label="عميق وتفصيلي"
                  description="مصادر متخصصة وتحليلية معمّقة"
                />
              </div>
            </div>
          )}

          {/* Step: contentNature */}
          {step === "contentNature" && (
            <div className="space-y-3" data-testid="step-content-nature">
              <p className="font-semibold">طبيعة المحتوى؟</p>
              <div className="space-y-2">
                <OptionButton
                  selected={prefs.contentNature === "news"}
                  onClick={() => setPrefs((p) => ({ ...p, contentNature: "news" }))}
                  icon={<TrendingUp className="h-4 w-4 text-green-500" />}
                  label="أخبار وتريندات"
                  description="آخر المستجدات والمستحدثات"
                />
                <OptionButton
                  selected={prefs.contentNature === "educational"}
                  onClick={() => setPrefs((p) => ({ ...p, contentNature: "educational" }))}
                  icon={<GraduationCap className="h-4 w-4 text-blue-500" />}
                  label="تعليمي ومستمر"
                  description="محتوى تعليمي وطويل الأمد"
                />
              </div>
            </div>
          )}

          {/* Step: count */}
          {step === "count" && (
            <div className="space-y-3" data-testid="step-count">
              <p className="font-semibold">كم مصدر تريد إضافته؟</p>
              <div className="grid grid-cols-3 gap-3">
                {([2, 4, 6] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPrefs((p) => ({ ...p, count: n }))}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xl border-2 py-4 transition-all duration-150",
                      prefs.count === n
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
                    )}
                    data-testid={`option-count-${n}`}
                  >
                    <span className="text-2xl font-bold">{n}</span>
                    <span className="text-xs text-muted-foreground mt-1">مصادر</span>
                  </button>
                ))}
              </div>
              <div className="rounded-lg bg-muted/50 border border-border p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">ملخص طلبك:</p>
                <div className="space-y-0.5">
                  <p>• المجال: <span className="text-foreground">{prefs.field}</span></p>
                  <p>• اللغة: <span className="text-foreground">{prefs.language === "arabic" ? "عربي" : prefs.language === "english" ? "إنجليزي" : "الكل"}</span></p>
                  <p>• النوع: <span className="text-foreground">{prefs.sourceTypes === "youtube" ? "يوتيوب" : prefs.sourceTypes === "website" ? "مواقع" : prefs.sourceTypes === "twitter" ? "X" : "الكل"}</span></p>
                  <p>• العمق: <span className="text-foreground">{prefs.depth === "quick" ? "سريع وبسيط" : "عميق وتفصيلي"}</span></p>
                  <p>• الطبيعة: <span className="text-foreground">{prefs.contentNature === "news" ? "أخبار وتريندات" : "تعليمي ومستمر"}</span></p>
                </div>
              </div>
            </div>
          )}

          {/* Loading state */}
          {step === "loading" && (
            <div className="flex flex-col items-center justify-center py-8 gap-4 text-center" data-testid="step-loading">
              <div className="relative">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Telescope className="h-8 w-8 text-primary animate-pulse" />
                </div>
                <Loader2 className="absolute -top-1 -right-1 h-6 w-6 animate-spin text-primary" />
              </div>
              <div className="space-y-1.5">
                <p className="font-semibold">فكري يبحث لك الآن...</p>
                <p className="text-sm text-muted-foreground">يجري تحليل المصادر وتقييم جودتها</p>
                <p className="text-xs text-muted-foreground">قد تستغرق العملية 15-30 ثانية</p>
              </div>
            </div>
          )}

          {/* Done state */}
          {step === "done" && (
            <div className="space-y-4" data-testid="step-done">
              <div className="flex flex-col items-center gap-2 text-center pt-2">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
                <p className="font-semibold">اكتشف فكري {addedSources.length} مصادر!</p>
                <p className="text-sm text-muted-foreground">تمت إضافتها تلقائياً إلى مجلدك</p>
              </div>
              <div className="space-y-2">
                {addedSources.map((src) => (
                  <div
                    key={src.id}
                    className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2"
                    data-testid={`discovered-source-${src.id}`}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
                      {src.type === "youtube" ? (
                        <Youtube className="h-3.5 w-3.5 text-red-500" />
                      ) : src.type === "twitter" ? (
                        <Twitter className="h-3.5 w-3.5" />
                      ) : (
                        <Globe className="h-3.5 w-3.5 text-blue-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{src.name}</p>
                      <p className="text-xs text-muted-foreground truncate" dir="ltr">{src.url}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">{src.type}</Badge>
                  </div>
                ))}
              </div>
              {addedSources.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-2">
                  لم يتم العثور على مصادر مناسبة. حاول تغيير المعايير.
                </p>
              )}
            </div>
          )}

          {/* Error state */}
          {step === "error" && (
            <div className="flex flex-col items-center gap-3 text-center py-6" data-testid="step-error">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <div className="space-y-1">
                <p className="font-semibold">حدث خطأ</p>
                <p className="text-sm text-muted-foreground">{errorMsg}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStep("count");
                  setErrorMsg("");
                }}
              >
                حاول مجدداً
              </Button>
            </div>
          )}

          {/* Navigation buttons */}
          {currentStepIdx >= 0 && (
            <div className="flex items-center justify-between pt-1 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                disabled={currentStepIdx === 0}
                className="gap-1"
                data-testid="button-wizard-back"
              >
                <ArrowRight className="h-4 w-4" />
                السابق
              </Button>
              <Button
                size="sm"
                onClick={handleNext}
                disabled={!canProceed}
                className="gap-1"
                data-testid="button-wizard-next"
              >
                {currentStepIdx === STEP_ORDER.length - 1 ? (
                  <>
                    <Telescope className="h-4 w-4" />
                    ابدأ البحث
                  </>
                ) : (
                  <>
                    التالي
                    <ArrowLeft className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Close button for done/error */}
          {(step === "done" || step === "error") && (
            <Button className="w-full" onClick={handleClose} data-testid="button-wizard-close">
              {step === "done" ? "رائع، شكراً فكري!" : "إغلاق"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

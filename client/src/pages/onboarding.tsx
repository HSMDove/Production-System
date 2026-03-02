import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bot, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AuthUser } from "@/hooks/use-auth";

type Gender = "male" | "female";

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender | "">("");

  const profileMutation = useMutation({
    mutationFn: () =>
      apiRequest<AuthUser>("PATCH", "/api/auth/profile", { name, age: parseInt(age) || null, gender }),
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/me"], user);
      navigate("/");
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل حفظ البيانات، حاول مرة أخرى", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !gender) return;
    profileMutation.mutate();
  };

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-2">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">مرحباً بك! 👋</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            نحتاج بعض المعلومات البسيطة لنتمكن من تخصيص تجربتك
            ومخاطبتك بالصيغة الصحيحة (أنتَ / أنتِ) داخل الموقع
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="name-input">
              الاسم
            </label>
            <Input
              id="name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اكتب اسمك هنا"
              autoFocus
              data-testid="input-name"
            />
          </div>

          {/* Age */}
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="age-input">
              العمر <span className="text-muted-foreground font-normal">(اختياري)</span>
            </label>
            <Input
              id="age-input"
              type="number"
              min={10}
              max={100}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="مثال: 25"
              data-testid="input-age"
              className="text-right"
            />
          </div>

          {/* Gender */}
          <div className="space-y-2">
            <label className="text-sm font-medium">الجنس</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "male" as Gender, label: "ذكر", emoji: "👨" },
                { value: "female" as Gender, label: "أنثى", emoji: "👩" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setGender(opt.value)}
                  data-testid={`button-gender-${opt.value}`}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                    gender === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <span>{opt.emoji}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!name.trim() || !gender || profileMutation.isPending}
            data-testid="button-complete-onboarding"
          >
            {profileMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                جاري الحفظ...
              </>
            ) : (
              "ابدأ الاستخدام 🚀"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

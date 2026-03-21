import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const sendOTPMutation = useMutation({
    mutationFn: (email: string) =>
      apiRequest<{ success: boolean; message: string }>("POST", "/api/auth/send-otp", { email }),
    onSuccess: () => {
      sessionStorage.setItem("otp_email", email.trim());
      navigate("/verify");
    },
    onError: (error: any) => {
      let msg = "فشل إرسال الرمز";
      try {
        const raw = error?.message || "";
        const jsonPart = raw.includes("{") ? raw.slice(raw.indexOf("{")) : "";
        if (jsonPart) {
          const parsed = JSON.parse(jsonPart);
          msg = parsed.error || msg;
        }
      } catch {}
      toast({
        title: "خطأ",
        description: msg,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    sendOTPMutation.mutate(email.trim());
  };

  return (
    <AuthShell
      eyebrow="بوابة الدخول"
      title="ادخل إلى نَسَق بهدوء بصري وثقة"
      description="تجربة دخول واضحة، سريعة، ومتسقة مع هوية المنتج الجديدة. لا ضوضاء بصرية ولا عناصر متنافرة."
      panelTitle="تسجيل الدخول"
      panelDescription="أدخل بريدك الإلكتروني وسنرسل لك رمز تحقق صالح لمدة خمس دقائق."
      icon={<Mail className="h-6 w-6" />}
      highlights={[
        "واجهة مصقولة ومريحة على الجوال واللابتوب",
        "مسافات ومحاذاة موحدة مثل بقية النظام",
        "تباين أوضح عبر مظاهر وهج ونبض وأثير",
      ]}
      footer={
        <p className="text-center text-xs font-bold text-muted-foreground">
          سيتم إرسال رمز مكوّن من 6 أرقام صالح لمدة 5 دقائق
        </p>
      }
    >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-black" htmlFor="email-input">
              البريد الإلكتروني
            </Label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="pr-10 pl-4 text-left"
                dir="ltr"
                autoComplete="email"
                autoFocus
                data-testid="input-email"
                disabled={sendOTPMutation.isPending}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full gap-2"
            disabled={!email.trim() || sendOTPMutation.isPending}
            data-testid="button-send-otp"
          >
            {sendOTPMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري الإرسال...
              </>
            ) : (
              <>
                <ArrowLeft className="h-4 w-4" />
                إرسال رمز التحقق
              </>
            )}
          </Button>
        </form>
    </AuthShell>
  );
}

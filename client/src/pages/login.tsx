import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bot, Mail, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
    <div
      dir="rtl"
      className="min-h-screen flex items-center justify-center bg-background px-4"
    >
      <div className="w-full max-w-sm space-y-6">
        {/* Logo & Title */}
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-black tracking-tighter text-foreground">نَسَق</h1>
          <p className="text-muted-foreground text-sm font-semibold">
            أدخل بريدك الإلكتروني لتلقّي رمز الدخول
          </p>
        </div>

        {/* Form — Neo-Brutalist Card */}
        <div className="card bg-card p-6 space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email-input">
              البريد الإلكتروني
            </label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="pr-10 text-left"
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
        </div>

        <p className="text-center text-xs text-muted-foreground">
          سيتم إرسال رمز مكوّن من 6 أرقام صالح لمدة 5 دقائق
        </p>
      </div>
    </div>
  );
}

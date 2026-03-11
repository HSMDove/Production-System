import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AuthUser } from "@/hooks/use-auth";

export default function VerifyOTPPage() {
  const [, navigate] = useLocation();
  const email = sessionStorage.getItem("otp_email") || "";
  const { toast } = useToast();

  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [resendCooldown, setResendCooldown] = useState(60);

  useEffect(() => {
    if (!email) navigate("/login");
  }, [email]);

  useEffect(() => {
    const t = setInterval(() => {
      setResendCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const verifyMutation = useMutation({
    mutationFn: (code: string) =>
      apiRequest<{ success: boolean; user: AuthUser; isNew: boolean }>(
        "POST",
        "/api/auth/verify-otp",
        { email, code }
      ),
    onSuccess: (data) => {
      sessionStorage.removeItem("otp_email");
      queryClient.setQueryData(["/api/auth/me"], data.user);
      if (data.isNew) {
        navigate("/onboarding");
      } else {
        navigate("/");
      }
    },
    onError: (error: any) => {
      toast({
        title: "رمز غير صحيح",
        description: error?.message || "تحقق من الرمز وحاول مرة أخرى",
        variant: "destructive",
      });
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    },
  });

  const resendMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/send-otp", { email }),
    onSuccess: () => {
      toast({ title: "تم إعادة الإرسال", description: "تحقق من بريدك الإلكتروني" });
      setResendCooldown(60);
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل إعادة الإرسال", variant: "destructive" });
    },
  });

  const handleDigitChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = cleaned;
    setDigits(newDigits);

    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const code = newDigits.join("");
    if (code.length === 6 && newDigits.every((d) => d !== "")) {
      verifyMutation.mutate(code);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (paste.length === 6) {
      const newDigits = paste.split("");
      setDigits(newDigits);
      verifyMutation.mutate(paste);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-black tracking-tighter text-foreground">نَسَق</h1>
          <p className="text-muted-foreground text-sm font-semibold">تحقق من بريدك</p>
        </div>

        <div className="card bg-card p-6 space-y-6">
        <div className="text-center space-y-1">
          <p className="text-muted-foreground text-sm">
            أرسلنا رمزاً مكوناً من 6 أرقام إلى
          </p>
          <p className="text-sm font-medium text-primary" dir="ltr">{email}</p>
        </div>

        <div className="flex gap-2 justify-center" dir="ltr" onPaste={handlePaste}>
          {digits.map((digit, i) => (
            <Input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-12 h-14 text-center text-2xl font-bold p-0 flex items-center justify-center"
              disabled={verifyMutation.isPending}
              data-testid={`input-otp-digit-${i}`}
              autoFocus={i === 0}
            />
          ))}
        </div>

        {verifyMutation.isPending && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            جاري التحقق...
          </div>
        )}
        </div>

        <div className="space-y-3">
          <Button
            variant="ghost"
            className="w-full gap-2"
            onClick={() => navigate("/login")}
            disabled={verifyMutation.isPending}
            data-testid="button-back-to-login"
          >
            <ArrowRight className="h-4 w-4" />
            تغيير البريد الإلكتروني
          </Button>

          <Button
            variant="ghost"
            className="w-full gap-2 text-muted-foreground"
            onClick={() => resendMutation.mutate()}
            disabled={resendCooldown > 0 || resendMutation.isPending}
            data-testid="button-resend-otp"
          >
            {resendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {resendCooldown > 0 ? `إعادة الإرسال (${resendCooldown}ث)` : "إعادة إرسال الرمز"}
          </Button>
        </div>
      </div>
    </div>
  );
}

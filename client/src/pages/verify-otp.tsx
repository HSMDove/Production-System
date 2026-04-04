import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AuthUser } from "@/hooks/use-auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { defaultLoginPageContent, type LoginPageContent } from "@shared/login-page-content";

export default function VerifyOTPPage() {
  const [, navigate] = useLocation();
  const email = sessionStorage.getItem("otp_email") || "";
  const { toast } = useToast();
  const { data: pageContent } = useQuery<LoginPageContent>({
    queryKey: ["/api/page-content/login"],
    queryFn: async () => {
      const response = await fetch("/api/page-content/login");
      if (!response.ok) throw new Error("Failed to fetch login page content");
      return response.json();
    },
    initialData: defaultLoginPageContent,
    staleTime: 60_000,
  });

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
      localStorage.setItem("nasaq-authed", "1");
      if (data.isNew) {
        navigate("/onboarding");
      } else {
        navigate("/dashboard");
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
    <AuthShell
      eyebrow={pageContent.verify.eyebrow}
      title={pageContent.verify.title}
      description={pageContent.verify.description}
      panelTitle={pageContent.verify.panelTitle}
      panelDescription={pageContent.verify.panelDescription}
      icon={<ArrowRight className="h-6 w-6" />}
      highlights={pageContent.verify.highlights}
    >
        <div className="text-center space-y-1">
          <p className="text-muted-foreground text-sm">
            أرسلنا رمزاً مكوناً من 6 أرقام إلى
          </p>
          <p className="text-sm font-black text-foreground" dir="ltr">{email}</p>
        </div>

        <div className="flex justify-center gap-2 sm:gap-2.5" dir="ltr" onPaste={handlePaste}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={verifyMutation.isPending}
              data-testid={`input-otp-digit-${i}`}
              autoFocus={i === 0}
              className="h-12 w-10 rounded-[16px] border-[3px] border-border bg-background text-center text-xl font-black leading-none tracking-none text-foreground outline-none transition-[border-color,box-shadow] duration-150 focus:border-primary focus:ring-4 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 sm:h-14 sm:w-12 sm:text-2xl"
              style={{ caretColor: "transparent", textAlign: "center", textAlignLast: "center" }}
            />
          ))}
        </div>

        {verifyMutation.isPending && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            جاري التحقق...
          </div>
        )}

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
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
    </AuthShell>
  );
}

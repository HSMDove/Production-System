import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";
import { defaultLoginPageContent, type LoginPageContent } from "@shared/login-page-content";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [, navigate] = useLocation();
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
      eyebrow={pageContent.login.eyebrow}
      title={pageContent.login.title}
      description={pageContent.login.description}
      panelTitle={pageContent.login.panelTitle}
      panelDescription={pageContent.login.panelDescription}
      icon={<Mail className="h-6 w-6" />}
      highlights={pageContent.login.highlights}
      footer={pageContent.login.footerNote ? (
        <p className="text-center text-xs font-bold text-muted-foreground">
          {pageContent.login.footerNote}
        </p>
      ) : undefined}
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
                className="w-full pr-11 pl-4 text-left text-base"
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
            className="w-full gap-2 font-black text-black"
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

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Shield, Lock, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const verifyMutation = useMutation({
    mutationFn: (password: string) =>
      apiRequest<{ success: boolean }>("POST", "/api/admin/verify-password", { password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      navigate("/admin");
    },
    onError: (error: any) => {
      let msg = "فشل التحقق";
      try {
        const raw = error?.message || "";
        const jsonPart = raw.includes("{") ? raw.slice(raw.indexOf("{")) : "";
        if (jsonPart) msg = JSON.parse(jsonPart).error || msg;
      } catch {}
      toast({ title: "خطأ", description: msg, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    verifyMutation.mutate(password);
  };

  return (
    <AuthShell
      eyebrow="وضع الإدارة"
      title="بوابة الإدارة محكومة وواضحة"
      description="هذه الواجهة تستخدم نفس لغة المنتج ولكن بدرجة أعلى من الانضباط البصري لتقليل الخطأ ورفع الوضوح عند المهام الحساسة."
      panelTitle="تسجيل دخول الإدارة"
      panelDescription={`مرحباً ${user?.name || user?.email || "بك"}، أدخل كلمة مرور المدير للانتقال إلى لوحة التحكم.`}
      icon={<Shield className="h-6 w-6" />}
      highlights={[
        "تباين مرتفع للعناصر الحرجة",
        "ترتيب عمودي واضح للمهام الحساسة",
        "تجربة متجاوبة ومتسقة مع بقية التطبيق",
      ]}
      footer={
        <Button
          variant="ghost"
          className="mx-auto w-full max-w-sm text-muted-foreground"
          onClick={() => navigate("/")}
          data-testid="button-back-to-app"
        >
          العودة للتطبيق
        </Button>
      }
    >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-black" htmlFor="admin-password">
                كلمة مرور المدير
              </Label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                  dir="ltr"
                  autoFocus
                  data-testid="input-admin-password"
                disabled={verifyMutation.isPending}
              />
            </div>
          </div>

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={!password.trim() || verifyMutation.isPending}
              data-testid="button-admin-login"
            >
              {verifyMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري التحقق...
                </>
              ) : (
                <>
                  <ArrowLeft className="h-4 w-4" />
                  دخول لوحة التحكم
                </>
            )}
          </Button>
          </form>
    </AuthShell>
  );
}

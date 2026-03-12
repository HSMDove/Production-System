import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Shield, Lock, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

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
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">لوحة التحكم</h1>
          <p className="text-muted-foreground text-sm">
            مرحباً {user?.name || user?.email} — أدخل كلمة مرور المدير
          </p>
        </div>

        <div className="card bg-card p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="admin-password">
                كلمة مرور المدير
              </label>
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
        </div>

        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={() => navigate("/")}
          data-testid="button-back-to-app"
        >
          العودة للتطبيق
        </Button>
      </div>
    </div>
  );
}

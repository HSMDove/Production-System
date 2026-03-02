import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const PUBLIC_ROUTES = ["/login", "/verify", "/onboarding"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location, navigate] = useLocation();

  const isPublicRoute = PUBLIC_ROUTES.some((r) => location.startsWith(r));

  useEffect(() => {
    if (isLoading) return;

    if (!user && !isPublicRoute) {
      navigate("/login");
      return;
    }

    if (user && !user.onboardingCompleted && location !== "/onboarding") {
      navigate("/onboarding");
      return;
    }

    if (user && user.onboardingCompleted && isPublicRoute) {
      navigate("/");
    }
  }, [user, isLoading, location]);

  if (isLoading && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}

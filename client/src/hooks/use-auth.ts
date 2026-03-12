import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useLocation } from "wouter";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  age: number | null;
  gender: "male" | "female" | "other" | null;
  slackUserId: string | null;
  onboardingCompleted: boolean;
  isAdmin: boolean;
  adminRole: "super_admin" | "admin" | null;
  adminMode: boolean;
  createdAt: string;
}

export function useAuth() {
  const [, navigate] = useLocation();

  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout"),
    onSuccess: () => {
      queryClient.clear();
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/login";
    },
  });

  const exitAdminMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/exit"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      navigate("/");
    },
  });

  const isAuthenticated = !!user;

  return {
    user,
    isLoading,
    isAuthenticated,
    isAdmin: user?.isAdmin === true,
    isSuperAdmin: user?.adminRole === "super_admin",
    adminMode: user?.adminMode === true,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    exitAdmin: exitAdminMutation.mutate,
  };
}

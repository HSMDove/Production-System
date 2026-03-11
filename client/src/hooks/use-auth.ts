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
      // Clear all cached data to prevent leaking between user sessions
      queryClient.clear();
      localStorage.clear();
      sessionStorage.clear();
      // Hard reload to reset all in-memory React state
      window.location.href = "/login";
    },
  });

  const isAuthenticated = !!user;

  return {
    user,
    isLoading,
    isAuthenticated,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}

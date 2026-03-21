import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { X, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

export function AnnouncementModal() {
  const { isAuthenticated, user } = useAuth();
  const [location] = useLocation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const { data: announcements } = useQuery<any[]>({
    queryKey: ["/api/announcements/unseen"],
    enabled: isAuthenticated && !location.startsWith("/login") && !location.startsWith("/admin"),
    refetchInterval: 60000,
  });

  const viewMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/announcements/${id}/view`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/announcements/unseen"] });
    },
  });

  useEffect(() => {
    setDismissed(false);
    setCurrentIndex(0);
  }, [user?.id]);

  if (!announcements || announcements.length === 0 || dismissed) return null;
  if (location.startsWith("/login") || location.startsWith("/verify") || location.startsWith("/admin") || location.startsWith("/onboarding")) return null;

  const current = announcements[currentIndex];
  if (!current) return null;

  const handleDismiss = () => {
    viewMutation.mutate(current.id);
    if (currentIndex < announcements.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setDismissed(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" data-testid="announcement-overlay">
      <div className="w-full max-w-md mx-4 bg-card rounded-2xl shadow-2xl overflow-hidden" dir="rtl" data-testid="announcement-modal">
        {current.imageUrl && (
          <div className="w-full h-40 overflow-hidden">
            <img src={current.imageUrl} alt={current.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Megaphone className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-lg font-bold">{current.title}</h2>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{current.body}</p>

          {announcements.length > 1 && (
            <p className="text-xs text-muted-foreground text-center">
              {currentIndex + 1} / {announcements.length}
            </p>
          )}

          <Button className="w-full" onClick={handleDismiss} data-testid="dismiss-announcement">
            {currentIndex < announcements.length - 1 ? "التالي" : "فهمت"}
          </Button>
        </div>
      </div>
    </div>
  );
}

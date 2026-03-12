import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ChevronLeft, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

type WelcomeCardData = {
  id: string;
  sortOrder: number;
  title: string;
  body: string;
  emoji: string | null;
  showUserName: boolean;
  isFinal: boolean;
  isActive: boolean;
};

type WelcomeResponse = {
  cards: WelcomeCardData[];
  show: boolean;
};

export function WelcomeCards() {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  const { data } = useQuery<WelcomeResponse>({
    queryKey: ["/api/welcome-cards"],
    enabled: !!user,
  });

  const markSeenMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/welcome-cards/seen"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/welcome-cards"] });
    },
    onError: () => {},
  });

  useEffect(() => {
    if (data?.show && data.cards.length > 0) {
      setCurrentIndex(0);
      const timer = setTimeout(() => setVisible(true), 400);
      return () => clearTimeout(timer);
    }
  }, [data]);

  if (!visible || !data?.show || data.cards.length === 0) return null;

  const cards = data.cards;
  const card = cards[currentIndex];
  const isLast = currentIndex === cards.length - 1;
  const userName = user?.name || "صديقنا";

  const replaceName = (text: string, shouldReplace: boolean) =>
    shouldReplace ? text.replace(/\{name\}/g, userName) : text;

  const goNext = () => {
    if (isLast) {
      markSeenMutation.mutate();
      setAnimating(true);
      setTimeout(() => setVisible(false), 300);
      return;
    }
    setAnimating(true);
    setTimeout(() => {
      setCurrentIndex((i) => i + 1);
      setAnimating(false);
    }, 200);
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setAnimating(true);
      setTimeout(() => {
        setCurrentIndex((i) => i - 1);
        setAnimating(false);
      }, 200);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div
        dir="rtl"
        className="relative mx-4 w-full max-w-md overflow-hidden"
        style={{
          animation: animating ? "none" : "welcome-in 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
          opacity: animating ? 0.3 : 1,
          transform: animating ? "scale(0.95)" : "scale(1)",
          transition: "opacity 0.2s, transform 0.2s",
        }}
      >
        <div className="rounded-2xl border-2 border-primary/30 bg-card shadow-2xl overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{
              backgroundImage: "repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 50%)",
              backgroundSize: "14px 14px",
            }}
          />

          <div className="relative px-8 py-10 text-center space-y-5">
            {card.emoji && (
              <div className="text-5xl mb-2">{card.emoji}</div>
            )}

            <h2 className="text-xl font-bold leading-relaxed">
              {replaceName(card.title, card.showUserName)}
            </h2>

            <p className="text-sm text-muted-foreground leading-[1.9] whitespace-pre-wrap">
              {replaceName(card.body, card.showUserName)}
            </p>

            <div className="flex items-center justify-center gap-1.5 pt-2">
              {cards.map((_, i) => (
                <span
                  key={i}
                  className={`block h-2 rounded-full transition-all duration-300 ${
                    i === currentIndex
                      ? "w-6 bg-primary"
                      : "w-2 bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-3 pt-2">
              {currentIndex > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goPrev}
                  className="gap-1"
                  data-testid="button-welcome-prev"
                >
                  <ChevronLeft className="h-4 w-4 rotate-180" />
                  السابق
                </Button>
              )}
              <div className="flex-1" />
              <Button
                onClick={goNext}
                className="gap-2"
                data-testid={isLast ? "button-welcome-start" : "button-welcome-next"}
              >
                {isLast ? (
                  <>
                    <Rocket className="h-4 w-4" />
                    ابدأ الآن مع نسق!
                  </>
                ) : (
                  <>
                    التالي
                    <ChevronLeft className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes welcome-in {
          from { opacity: 0; transform: scale(0.85) translateY(20px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

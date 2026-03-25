import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
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

type Direction = "next" | "prev";
type Phase = "stable" | "fade-out" | "repositioned" | "fade-in";

const DURATION = 250;

export function WelcomeCards() {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [phase, setPhase] = useState<Phase>("stable");
  const [direction, setDirection] = useState<Direction>("next");
  const busy = useRef(false);
  const timeoutRefs = useRef<number[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState<number | undefined>(undefined);

  const scheduleTimeout = useCallback((fn: () => void, delay: number) => {
    const id = window.setTimeout(() => {
      timeoutRefs.current = timeoutRefs.current.filter((value) => value !== id);
      fn();
    }, delay);
    timeoutRefs.current.push(id);
    return id;
  }, []);

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
      const timer = scheduleTimeout(() => setVisible(true), 400);
      return () => window.clearTimeout(timer);
    }
  }, [data, scheduleTimeout]);

  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((id) => window.clearTimeout(id));
      timeoutRefs.current = [];
    };
  }, []);

  useLayoutEffect(() => {
    if (phase === "stable" && contentRef.current) {
      const h = contentRef.current.scrollHeight;
      setContainerHeight((prev) => (prev === undefined || h > prev) ? h : prev);
    }
  }, [phase, currentIndex]);

  const slideTo = useCallback((newIndex: number, dir: Direction) => {
    if (busy.current) return;
    busy.current = true;
    setDirection(dir);
    setPhase("fade-out");

    scheduleTimeout(() => {
      setCurrentIndex(newIndex);
      setPhase("repositioned");

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setPhase("fade-in");
          scheduleTimeout(() => {
            setPhase("stable");
            busy.current = false;
          }, DURATION);
        });
      });
    }, DURATION);
  }, [scheduleTimeout]);

  const goNext = useCallback(() => {
    if (busy.current || !data) return;
    const cards = data.cards;
    const isLast = currentIndex === cards.length - 1;
    if (isLast) {
      markSeenMutation.mutate();
      setClosing(true);
      scheduleTimeout(() => setVisible(false), 350);
      return;
    }
    slideTo(currentIndex + 1, "next");
  }, [currentIndex, data, slideTo, markSeenMutation, scheduleTimeout]);

  const goPrev = useCallback(() => {
    if (busy.current || currentIndex <= 0) return;
    slideTo(currentIndex - 1, "prev");
  }, [currentIndex, slideTo]);

  if (!visible || !data?.show || data.cards.length === 0) return null;

  const cards = data.cards;
  const card = cards[currentIndex];
  const isLast = currentIndex === cards.length - 1;
  const userName = user?.name || "صديقنا";

  const replaceName = (text: string, shouldReplace: boolean) =>
    shouldReplace ? text.replace(/\{name\}/g, userName) : text;

  const exitX = direction === "next" ? "-50px" : "50px";
  const enterX = direction === "next" ? "50px" : "-50px";

  let contentStyle: React.CSSProperties;
  switch (phase) {
    case "fade-out":
      contentStyle = {
        opacity: 0,
        transform: `translateX(${exitX})`,
        transition: `opacity ${DURATION}ms cubic-bezier(0.4,0,0.2,1), transform ${DURATION}ms cubic-bezier(0.4,0,0.2,1)`,
      };
      break;
    case "repositioned":
      contentStyle = {
        opacity: 0,
        transform: `translateX(${enterX})`,
        transition: "none",
      };
      break;
    case "fade-in":
      contentStyle = {
        opacity: 1,
        transform: "translateX(0)",
        transition: `opacity ${DURATION}ms cubic-bezier(0.4,0,0.2,1), transform ${DURATION}ms cubic-bezier(0.4,0,0.2,1)`,
      };
      break;
    default:
      contentStyle = {
        opacity: 1,
        transform: "translateX(0)",
        transition: `opacity ${DURATION}ms cubic-bezier(0.4,0,0.2,1), transform ${DURATION}ms cubic-bezier(0.4,0,0.2,1)`,
      };
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        opacity: closing ? 0 : 1,
        transition: closing ? "opacity 0.35s ease-out" : "none",
      }}
    >
      <div
        dir="rtl"
        className="relative mx-4 w-full max-w-md"
        style={{
          animation: "welcome-in 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
          transform: closing ? "scale(0.92)" : undefined,
          transition: closing ? "transform 0.35s ease-out" : undefined,
        }}
      >
        <div className="rounded-2xl border-2 border-primary/30 bg-card shadow-2xl overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{
              backgroundImage: "repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 50%)",
              backgroundSize: "14px 14px",
            }}
          />

          <div className="relative px-8 py-10 text-center">
            <div className="overflow-hidden" style={{ minHeight: containerHeight ?? 160, transition: "min-height 0.3s ease" }}>
              <div ref={contentRef} style={contentStyle}>
                {card.emoji && (
                  <div className="text-5xl mb-4">{card.emoji}</div>
                )}

                <h2 className="text-xl font-bold leading-relaxed">
                  {replaceName(card.title, card.showUserName)}
                </h2>

                <p className="text-sm text-muted-foreground leading-[1.9] whitespace-pre-wrap mt-4">
                  {replaceName(card.body, card.showUserName)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-1.5 pt-5">
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

            <div className="flex items-center gap-3 pt-4">
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

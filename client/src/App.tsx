import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion"; // AnimatePresence used by FikriEdgeHandle only
import { ChevronLeft } from "lucide-react";
import { useFikriOverlay } from "@/contexts/fikri-overlay-context";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ErrorBoundary } from "@/components/error-boundary";
import { initAppleEmoji } from "@/lib/apple-emoji";
import Dashboard from "@/pages/dashboard";
import FolderDetail from "@/pages/folder-detail";
import Ideas from "@/pages/ideas";
import ContentCalendar from "@/pages/calendar";
import Analytics from "@/pages/analytics";
import Trends from "@/pages/trends";
import Settings from "@/pages/settings";
import SplitView from "@/pages/split-view";
import ModelAssistantPage from "@/pages/model-assistant";
import SavedPage from "@/pages/saved";
import LoginPage from "@/pages/login";
import VerifyOTPPage from "@/pages/verify-otp";
import OnboardingPage from "@/pages/onboarding";
import AdminLoginPage from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";
import PrivacyPage from "@/pages/privacy";
import NotFound from "@/pages/not-found";
import { FikriOverlayProvider } from "@/contexts/fikri-overlay-context";
import { FikriOverlay } from "@/components/fikri/fikri-overlay";
import { WelcomeCards } from "@/components/welcome-cards";
import { TopBannerDisplay } from "@/components/announcements/top-banner";
import { AnnouncementModal } from "@/components/announcements/announcement-modal";

function AnimatedRouter() {
  const [location] = useLocation();
  // No AnimatePresence — exit animations cause Wouter's Switch to re-render
  // the NEW route inside the exiting div, creating a flash + dual-page render delay.
  // Enter-only animation: old page unmounts instantly (clean), new page fades in smoothly.
  return (
    <motion.div
      key={location}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
    >
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/verify" component={VerifyOTPPage} />
        <Route path="/onboarding" component={OnboardingPage} />
        <Route path="/admin/login" component={AdminLoginPage} />
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/folder/:id" component={FolderDetail} />
        <Route path="/ideas" component={Ideas} />
        <Route path="/calendar" component={ContentCalendar} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/trends" component={Trends} />
        <Route path="/settings" component={Settings} />
        <Route path="/saved" component={SavedPage} />
        <Route path="/split-view" component={SplitView} />
        <Route path="/model" component={ModelAssistantPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route component={NotFound} />
      </Switch>
    </motion.div>
  );
}

function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { open } = useFikriOverlay();
  return (
    <div
      style={{
        transition: "padding-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        paddingRight: open ? "clamp(0px, 24rem, 40vw)" : "0px",
      }}
    >
      {children}
    </div>
  );
}

function FikriEdgeHandle() {
  const { open, setOpen } = useFikriOverlay();
  const [location] = useLocation();
  if (location === "/settings") return null;
  return (
    <AnimatePresence>
      {!open && (
        <motion.button
          initial={{ opacity: 0, x: 20, y: "-50%" }}
          animate={{ opacity: 1, x: 0, y: "-50%" }}
          exit={{ opacity: 0, x: 20, y: "-50%" }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          style={{ top: "50%" }}
          className="fikri-edge-handle"
          onClick={() => setOpen(true)}
          aria-label="فتح فكري"
        >
          <ChevronLeft className="h-3.5 w-3.5 text-foreground/60" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

function AppContent() {
  const { data: branding } = useQuery<{ fontFamily: string | null; fontSource: string | null }>({
    queryKey: ["/api/system-settings/public-branding"],
    queryFn: () => fetch("/api/system-settings/public-branding").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    initAppleEmoji();
  }, []);
  // NOTE: The AdSense <script> tag is injected server-side into the HTML
  // document (see server/adsense-injector.ts + server/static.ts) so that
  // Google's verification crawler can detect it in "View Page Source".
  // No client-side script injection is needed here.

  useEffect(() => {
    const prevStyle = document.getElementById("dynamic-site-font");
    if (prevStyle) prevStyle.remove();
    if (!branding?.fontFamily) return;

    const sanitizedFamily = branding.fontFamily.replace(/"/g, "");
    const style = document.createElement("style");
    style.id = "dynamic-site-font";
    if (branding.fontSource) {
      style.textContent = `
        @font-face {
          font-family: "${sanitizedFamily}";
          src: url("${branding.fontSource}");
          font-display: swap;
        }
        :root {
          --font-sans: "${sanitizedFamily}", Tajawal, sans-serif;
          --font-serif: "${sanitizedFamily}", Cairo, serif;
        }
      `;
    } else {
      style.textContent = `
        :root {
          --font-sans: "${sanitizedFamily}", Tajawal, sans-serif;
          --font-serif: "${sanitizedFamily}", Cairo, serif;
        }
      `;
    }
    document.head.appendChild(style);
  }, [branding?.fontFamily, branding?.fontSource]);

  return (
    <ThemeProvider defaultTheme="default" defaultColorMode="dark" storageKey="nasaq-accent">
      <TooltipProvider>
        <FikriOverlayProvider>
          <AuthGuard>
            <Toaster />
            <WorkspaceShell>
              <ErrorBoundary fullScreen={false}>
                <TopBannerDisplay />
              </ErrorBoundary>
              <ErrorBoundary>
                <AnimatedRouter />
              </ErrorBoundary>
              <ErrorBoundary fullScreen={false}>
                <WelcomeCards />
              </ErrorBoundary>
              <ErrorBoundary fullScreen={false}>
                <AnnouncementModal />
              </ErrorBoundary>
            </WorkspaceShell>
            {/* Edge handle and overlay live outside WorkspaceShell */}
            <ErrorBoundary fullScreen={false}>
              <FikriEdgeHandle />
            </ErrorBoundary>
            <ErrorBoundary fullScreen={false}>
              <FikriOverlay />
            </ErrorBoundary>
          </AuthGuard>
        </FikriOverlayProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;

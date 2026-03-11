import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import Dashboard from "@/pages/dashboard";
import FolderDetail from "@/pages/folder-detail";
import Ideas from "@/pages/ideas";
import ContentCalendar from "@/pages/calendar";
import Analytics from "@/pages/analytics";
import Trends from "@/pages/trends";
import Settings from "@/pages/settings";
import SplitView from "@/pages/split-view";
import ModelAssistantPage from "@/pages/model-assistant";
import NotFound from "@/pages/not-found";
import { FikriOverlayProvider } from "@/contexts/fikri-overlay-context";
import { FikriOverlay } from "@/components/fikri/fikri-overlay";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/folder/:id" component={FolderDetail} />
      <Route path="/ideas" component={Ideas} />
      <Route path="/calendar" component={ContentCalendar} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/trends" component={Trends} />
      <Route path="/settings" component={Settings} />
      <Route path="/split-view" component={SplitView} />
      <Route path="/model" component={ModelAssistantPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="default-dark" storageKey="tech-voice-theme">
        <TooltipProvider>
          <FikriOverlayProvider>
            <Toaster />
            <Router />
            <FikriOverlay />
          </FikriOverlayProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

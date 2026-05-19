import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import Login from "@/pages/login";
import InboxPage from "@/pages/inbox";
import ComposePage from "@/pages/compose";
import AccountPage from "@/pages/account";
import { ACCENT_COLORS, type AccentColor } from "@/hooks/use-accent";

const queryClient = new QueryClient();

function AccentInit() {
  useEffect(() => {
    const saved = (localStorage.getItem("mp-accent") as AccentColor) ?? "indigo";
    const color = ACCENT_COLORS.find((c) => c.id === saved) ?? ACCENT_COLORS[0];
    const root = document.documentElement;
    root.style.setProperty("--primary", color.hsl);
    root.style.setProperty("--accent", color.hsl);
    root.style.setProperty("--ring", color.hsl);
    root.style.setProperty("--sidebar-primary", color.hsl);
    root.style.setProperty("--sidebar-ring", color.hsl);
  }, []);
  return null;
}

function useServerPing() {
  useEffect(() => {
    const ping = () => fetch("/api/healthz").catch(() => {});
    ping();
    const id = setInterval(ping, 30_000);
    return () => clearInterval(id);
  }, []);
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/inbox" component={InboxPage} />
      <Route path="/compose" component={ComposePage} />
      <Route path="/account" component={AccountPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useServerPing();
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AccentInit />
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;

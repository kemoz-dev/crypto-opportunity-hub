import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { PwaStatusBanner, PwaStatusProvider } from "./pwa/PwaStatus";
import { PwaMobileNavigation } from "./pwa/PwaMobileNavigation";

function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><PwaStatusProvider><TooltipProvider><PwaStatusBanner /><Toaster theme="dark" richColors position="top-right" /><Router /><PwaMobileNavigation /></TooltipProvider></PwaStatusProvider></ThemeProvider></ErrorBoundary>;
}

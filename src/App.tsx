import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppRouter } from "@/app/router";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function App() {
  return (
    <TooltipProvider>
      <ErrorBoundary>
        <AppRouter />
      </ErrorBoundary>
      <Toaster position="top-right" richColors />
    </TooltipProvider>
  );
}

export default App;

import { BrowserRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/app/layout/AppShell";
import { AppRouter } from "@/app/router";

function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        <AppShell>
          <AppRouter />
        </AppShell>
        <Toaster position="top-right" richColors />
      </TooltipProvider>
    </BrowserRouter>
  );
}

export default App;

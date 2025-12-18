import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AxiomSyncProvider } from "@/contexts/AxiomSyncContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { MemoryProvider } from "@/contexts/MemoryContext";
import { MobileToastProvider } from "@/components/mobile/Toast";
import { Loader2 } from "lucide-react";
import { StarryBackground } from "@/components/ui/starry-background";

// Lazy load pages for code splitting
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const UpdatePassword = lazy(() => import("./pages/UpdatePassword"));
const Intelligence = lazy(() => import("./pages/Intelligence"));
const Execution = lazy(() => import("./pages/Execution"));
const Habits = lazy(() => import("./pages/Habits"));
const Finances = lazy(() => import("./pages/Finances"));
const Memory = lazy(() => import("./pages/Memory"));
const Settings = lazy(() => import("./pages/Settings"));
const MemoryValidation = lazy(() => import("./pages/MemoryValidation"));
const PromptLibrary = lazy(() => import("./pages/PromptLibrary"));
const PromptAnalysis = lazy(() => import("./pages/PromptAnalysis"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// Hook for global Cmd/Ctrl+K shortcut
function useGlobalChatShortcut() {
  const navigate = useNavigate();
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        navigate('/chat');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative">
        <StarryBackground />
        <Loader2 className="h-8 w-8 animate-spin text-primary relative z-10" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative">
        <StarryBackground />
        <Loader2 className="h-8 w-8 animate-spin text-primary relative z-10" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/chat" replace />;
  }

  return <>{children}</>;
}

// Suspense fallback component
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative">
      <StarryBackground />
      <Loader2 className="h-8 w-8 animate-spin text-primary relative z-10" />
    </div>
  );
}

function AppRoutes() {
  useGlobalChatShortcut();
  
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Navigate to="/intelligence" replace />} />
        <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
        <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="/chat" element={<Navigate to="/intelligence" replace />} />
        <Route path="/intelligence" element={<ProtectedRoute><Intelligence /></ProtectedRoute>} />
        <Route path="/execution" element={<ProtectedRoute><Execution /></ProtectedRoute>} />
        <Route path="/habits" element={<ProtectedRoute><Habits /></ProtectedRoute>} />
        <Route path="/finances" element={<ProtectedRoute><Finances /></ProtectedRoute>} />
        <Route path="/memory" element={<ProtectedRoute><Memory /></ProtectedRoute>} />
        <Route path="/memory-validation" element={<ProtectedRoute><MemoryValidation /></ProtectedRoute>} />
        <Route path="/prompts" element={<ProtectedRoute><PromptLibrary /></ProtectedRoute>} />
        <Route path="/prompts/:id" element={<ProtectedRoute><PromptAnalysis /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <SidebarProvider>
              <MemoryProvider>
                <AxiomSyncProvider>
                  <ChatProvider>
                    <MobileToastProvider>
                      <AppRoutes />
                    </MobileToastProvider>
                  </ChatProvider>
                </AxiomSyncProvider>
              </MemoryProvider>
            </SidebarProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

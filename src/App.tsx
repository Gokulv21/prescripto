import { useState, ReactNode, useEffect, lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes, Navigate, useLocation, useNavigate, useParams, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2, WifiOff, RefreshCw, ShieldAlert, Building2, LogOut } from "lucide-react";
import { AuthProvider, useAuth } from "@/lib/auth";
import AppLayout from "@/components/AppLayout";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { logSecurityEvent } from "@/lib/security";

// Lazy-Loaded Route Components for Ultra-Fast Initial Load
const Login = lazy(() => import("@/pages/Login"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const NurseEntry = lazy(() => import("@/pages/NurseEntry"));
const DoctorConsultation = lazy(() => import("@/pages/DoctorConsultation"));
const PrintQueue = lazy(() => import("@/pages/PrintQueue"));
const PatientList = lazy(() => import("@/pages/PatientList"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const UserManagement = lazy(() => import("@/pages/UserManagement"));
const DoctorProfile = lazy(() => import("@/pages/DoctorProfile"));
const ClinicSelection = lazy(() => import("@/pages/ClinicSelection"));
const SaaSManagement = lazy(() => import("@/pages/SaaSManagement"));
const PublicPrescription = lazy(() => import("@/pages/PublicPrescription"));
const TVDisplay = lazy(() => import("@/pages/TVDisplay"));
const NotFound = lazy(() => import("./pages/NotFound"));
const About = lazy(() => import("@/pages/About"));
const Help = lazy(() => import("@/pages/Help"));

function PageLoader() {
  return (
    <div className="flex flex-col justify-center items-center h-[60vh] space-y-4 font-sans">
      <Loader2 className="animate-spin w-8 h-8 text-blue-600" />
      <p className="text-xs text-slate-500 font-bold tracking-widest uppercase">Loading Module...</p>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Provides clinic logic context to nested components
function ClinicWrapper() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const { data: clinic, isLoading, error, refetch } = useQuery({
    queryKey: ['clinic', slug],
    staleTime: 0, // Always fetch fresh clinic status to ensure immediate blocking
    queryFn: async () => {
      if (!slug) return null;
      console.log("[ClinicWrapper] Fetching clinic for slug:", slug);
      const { data, error } = await supabase.from('clinics').select('*').eq('slug', slug).single();
      if (error) {
        console.error("[ClinicWrapper] Fetch error:", error);
        throw error;
      }
      console.log("[ClinicWrapper] Clinic found:", data);
      return data;
    }
  });

  // Add real-time listener for clinic status changes
  useEffect(() => {
    if (!slug) return;
    
    const channel = supabase
      .channel(`clinic_status_${slug}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'clinics',
        filter: `slug=eq.${slug}`
      }, (payload) => {
        console.log("[ClinicWrapper] Clinic status updated via Realtime:", payload.new);
        refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [slug, refetch]);

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen space-y-4 bg-slate-50 dark:bg-slate-950 font-jakarta-sans">
        <Loader2 className="animate-spin w-8 h-8 text-blue-600"/>
        <p className="text-xs text-slate-500 font-bold tracking-widest uppercase">Connecting to Clinical Environment...</p>
      </div>
    );
  }

  if (error || !clinic) {
    console.error("[ClinicWrapper] Access Denied or Clinic Not Found:", { slug, error, user: user?.id, roles });
    return (
      <div className="flex flex-col justify-center items-center h-screen space-y-4 p-6 text-center bg-slate-50 dark:bg-slate-950 font-jakarta-sans">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
          <Building2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black">Clinic Not Found</h1>
        <p className="text-muted-foreground text-sm max-w-sm">
          Could not find clinic environment matching <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{slug}</span>.
        </p>
        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={() => refetch()} className="rounded-xl font-bold">
            <RefreshCw className="w-4 h-4 mr-2" /> Retry
          </Button>
          <Button onClick={() => navigate('/')} className="rounded-xl font-bold bg-blue-600 text-white">
            Back to Clinics
          </Button>
        </div>
      </div>
    );
  }

  if (clinic.is_blocked && !roles.includes('superadmin')) {
    return (
      <div className="flex flex-col justify-center items-center h-screen space-y-8 p-8 text-center bg-slate-50 dark:bg-slate-950 font-jakarta-sans">
        <div className="relative">
           <div className="absolute inset-0 bg-red-500 blur-2xl opacity-20 animate-pulse" />
           <div className="relative w-24 h-24 bg-white dark:bg-slate-900 border border-red-500/30 text-red-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl">
              <ShieldAlert className="w-12 h-12" />
           </div>
        </div>
        <div className="space-y-3 max-w-md">
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">Clinic <span className="text-red-600">Suspended</span></h1>
          <p className="text-slate-500 font-medium">
            Access to this clinical environment has been temporarily suspended by the system administrator.
          </p>
          {clinic.block_reason && (
            <div className="mt-6 p-6 rounded-[2rem] bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 shadow-inner">
               <p className="text-[10px] font-black uppercase text-red-600 tracking-widest mb-2 flex items-center justify-center gap-2">
                  <Building2 className="w-3 h-3" /> Administrative Notice
               </p>
               <p className="text-sm font-bold text-red-900 dark:text-red-200 italic leading-relaxed">
                  "{clinic.block_reason}"
               </p>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-4 w-full max-w-xs">
           <Button 
              onClick={() => navigate('/')} 
              className="w-full h-14 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all shadow-xl"
           >
              Back to Clinical Network
           </Button>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-4">
              Prescripto Security Operations
           </p>
        </div>
      </div>
    );
  }

  (window as any).__ACTIVE_CLINIC_ID = clinic.id;

  return (
    <AppLayout>
       <Outlet context={{ clinic }} />
    </AppLayout>
  );
}

function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles?: string[] }) {
  const { user, roles, loading, error, refresh, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 font-jakarta-sans space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Verifying Credentials...</p>
      </div>
    );
  }

  if (error && roles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center font-jakarta-sans">
        <div className="space-y-6 max-w-sm w-full bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 flex items-center justify-center mx-auto">
            <WifiOff className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Connection Issue</h1>
            <p className="text-xs text-slate-500 mt-1">{error || 'Could not verify your security permissions.'}</p>
          </div>
          <div className="flex flex-col gap-3">
            <Button onClick={refresh} className="w-full h-12 rounded-xl gap-2 font-bold bg-blue-600 text-white">
              <RefreshCw className="w-4 h-4" /> Retry Connection
            </Button>
            <Button variant="outline" onClick={() => signOut()} className="w-full h-12 rounded-xl gap-2 font-bold">
              <LogOut className="w-4 h-4" /> Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (roles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center font-jakarta-sans">
        <div className="space-y-6 max-w-sm w-full bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Permissions Pending</h1>
            <p className="text-xs text-slate-500 mt-1">No active clinic role assigned to this account.</p>
          </div>
          <div className="flex flex-col gap-3">
            <Button onClick={refresh} className="w-full h-12 rounded-xl gap-2 font-bold bg-blue-600 text-white">
              <RefreshCw className="w-4 h-4" /> Refresh Roles
            </Button>
            <Button variant="outline" onClick={() => signOut()} className="w-full h-12 rounded-xl gap-2 font-bold">
              <LogOut className="w-4 h-4" /> Sign Out / Switch User
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.some(r => roles.includes(r as any))) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// -----------------------------------------------------
// APP ROOT ROUTING
// -----------------------------------------------------
function RootRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="animate-spin text-blue-600 w-8 h-8" />
      </div>
    );
  }

  if (user) {
     return <ClinicSelection />;
  }

  return <Navigate to="/login" replace />;
}

// Security Sentinel: Local diagnostics only (strictly zero database inserts to prevent connection pool exhaustion)
function SecuritySentinel() {
  const { user } = useAuth();
  
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // Local console logging only
      console.warn("[App Error Captured]:", event.message);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      // Prevent unhandled promise crash loops
      if (event.reason) {
        console.warn("[Unhandled Rejection Captured]:", event.reason);
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [user?.id]);

  return null;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="prescripto-theme">
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter 
            basename="/prescripto" 
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <AuthProvider>
              <SecuritySentinel />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* 1. Public Routes */}
                  <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                  <Route path="/rx/:visitId" element={<PublicPrescription />} />
                  <Route path="/:slug/display" element={<TVDisplay />} />

                  {/* 2. Root Redirector & Global Pages */}
                  <Route path="/" element={<RootRouter />} />
                  <Route path="/help" element={<ProtectedRoute><AppLayout><Help /></AppLayout></ProtectedRoute>} />

                  {/* 3. Multi-Clinic Scoped Routes */}
                  <Route path="/:slug" element={<ProtectedRoute><ClinicWrapper /></ProtectedRoute>}>
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="nurse" element={<ProtectedRoute allowedRoles={['staff', 'doctor', 'superadmin', 'owner']}><NurseEntry /></ProtectedRoute>} />
                    <Route path="consultation" element={<ProtectedRoute allowedRoles={['doctor', 'superadmin', 'owner']}><DoctorConsultation /></ProtectedRoute>} />
                    <Route path="print" element={<ProtectedRoute allowedRoles={['staff', 'doctor', 'superadmin', 'owner']}><PrintQueue /></ProtectedRoute>} />
                    <Route path="patients" element={<ProtectedRoute allowedRoles={['staff', 'doctor', 'superadmin', 'owner']}><PatientList /></ProtectedRoute>} />
                    <Route path="analytics" element={<ProtectedRoute allowedRoles={['doctor', 'superadmin', 'owner']}><Analytics /></ProtectedRoute>} />
                    <Route path="profile" element={<ProtectedRoute allowedRoles={['doctor', 'superadmin', 'owner']}><DoctorProfile /></ProtectedRoute>} />
                    <Route path="users" element={<ProtectedRoute allowedRoles={['superadmin', 'owner']}><UserManagement /></ProtectedRoute>} />
                    <Route path="saas" element={<ProtectedRoute allowedRoles={['superadmin']}><SaaSManagement /></ProtectedRoute>} />
                    <Route path="about" element={<About />} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
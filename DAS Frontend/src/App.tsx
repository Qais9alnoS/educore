import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider, useAuth, ProtectedRoute } from '@/contexts/AuthContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { ZoomProvider } from '@/contexts/ZoomContext';
import { DesktopLayout } from '@/components/layout/DesktopLayout';
import { SplashScreen } from '@/components/SplashScreen';
import { FirstRunSetup } from '@/components/FirstRunSetup';
import CustomTitleBar from '@/components/layout/CustomTitleBar';
import { AcademicYearManagementPage, DashboardPage, StudentPersonalInfoPage, StudentAcademicInfoPage, SchoolInfoManagementPage, ActivitiesManagementPage, AddEditGradePage, TeacherManagementPage, ScheduleManagementPage, UserManagementPage, SettingsPage } from '@/pages';
import LoginPage from '@/pages/LoginPage';
import NotFound from '@/pages/NotFound';
import DirectorNotesPage from '@/pages/DirectorNotesPage';
import DirectorNotesSearchPage from '@/pages/DirectorNotesSearchPage';
import DailyPage from '@/pages/DailyPage';
import NoteFolderBrowser from '@/components/director-notes/NoteFolderBrowser';
import MarkdownNoteEditor from '@/components/director-notes/MarkdownNoteEditor';
import RewardsManager from '@/components/director-notes/RewardsManager';
import AssistanceManager from '@/components/director-notes/AssistanceManager';
import { FinanceManagerPage } from '@/components/finance';
import { StudentAnalyticsPage } from '@/components/analytics';

const queryClient = new QueryClient();

// Helper function to get role label in Arabic
const getRoleLabel = (role: string): string => {
  const roleLabels: Record<string, string> = {
    director: 'مدير',
    finance: 'مالية',
    morning_school: 'مدرسة صباحية',
    evening_school: 'مدرسة مسائية',
    morning_supervisor: 'مشرف فترة صباحية',
    evening_supervisor: 'مشرف فترة مسائية',
  };
  return roleLabels[role] || role;
};

// Access Denied Component
const AccessDenied = () => {
  const navigate = useNavigate();
  const { state } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] p-6">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            غير مصرح بالدخول
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            عذراً، ليس لديك الصلاحية للوصول إلى هذه الصفحة.
            {state.user && (
              <span className="block mt-2 text-sm">
                الدور الحالي: <strong>{getRoleLabel(state.user.role)}</strong>
              </span>
            )}
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
          >
            العودة إلى لوحة التحكم
          </button>
        </div>
      </div>
    </div>
  );
};

// Protected Route Wrapper
const ProtectedApp = () => {
  const { state } = useAuth();
  const navigate = useNavigate();
  const [needsFirstRunSetup, setNeedsFirstRunSetup] = useState(false);
  const [checkingFirstRun, setCheckingFirstRun] = useState(true);

  // Check if first run setup is needed
  useEffect(() => {
    const checkFirstRunStatus = async () => {
      try {
        // Always check the backend to ensure database state matches localStorage
        const { academicYearsApi } = await import('@/services/api');
        const response = await academicYearsApi.checkFirstRun();

        if (response.success && response.data) {
          setNeedsFirstRunSetup(response.data.is_first_run);

          if (response.data.is_first_run) {
            // Clear any stale localStorage data if database has no years
            localStorage.removeItem('first_run_completed');
            localStorage.removeItem('selected_academic_year_id');
            localStorage.removeItem('selected_academic_year_name');
            localStorage.removeItem('auto_open_academic_year');
          } else {
            // If not first run, mark it as completed
            localStorage.setItem('first_run_completed', 'true');
          }
        }
      } catch (error) {

        // On error, check localStorage as fallback
        const firstRunCompleted = localStorage.getItem('first_run_completed');
        if (firstRunCompleted === 'true') {
          setNeedsFirstRunSetup(false);
        }
      } finally {
        setCheckingFirstRun(false);
      }
    };

    if (state.isAuthenticated) {
      checkFirstRunStatus();
    }
  }, [state.isAuthenticated]);

  // Periodically check if academic years still exist
  useEffect(() => {
    if (!state.isAuthenticated || needsFirstRunSetup) return;

    const checkAcademicYearsExist = async () => {
      try {
        const { academicYearsApi } = await import('@/services/api');
        const response = await academicYearsApi.checkFirstRun();

        if (response.success && response.data && response.data.is_first_run) {
          // All academic years were deleted, force redirect to first run
          setNeedsFirstRunSetup(true);
          localStorage.removeItem('first_run_completed');
          localStorage.removeItem('selected_academic_year_id');
          localStorage.removeItem('selected_academic_year_name');
          localStorage.removeItem('auto_open_academic_year');
        }
      } catch (error) {

      }
    };

    // Check every 5 seconds
    const interval = setInterval(checkAcademicYearsExist, 5000);

    return () => clearInterval(interval);
  }, [state.isAuthenticated, needsFirstRunSetup]);

  // Show loading while auth is initializing (prevents login flash)
  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!state.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Show loading state while checking
  if (checkingFirstRun) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show first run setup if needed
  if (needsFirstRunSetup) {
    return (
      <FirstRunSetup
        onComplete={() => {
          setNeedsFirstRunSetup(false);
          localStorage.setItem('first_run_completed', 'true');
          // After first run, navigate to year management
          navigate('/academic-years');
        }}
      />
    );
  }

  // Routes for authenticated users
  return (
    <Routes>
      <Route path="/*" element={<DesktopLayout />}>
        {/* Default route - check year selection and redirect accordingly */}
        <Route index element={<YearSelectionCheck />} />
        {/* Dashboard route - show the main dashboard */}
        <Route path="dashboard" element={<DashboardPage />} />
        {/* Academic Year Management */}
        <Route path="academic-years" element={<AcademicYearManagementPage />} />
        {/* School Info Management */}
        <Route path="school-info" element={<SchoolInfoManagementPage />} />
        <Route path="school-info/add-grade" element={<AddEditGradePage />} />
        <Route path="school-info/edit-grade/:gradeId" element={<AddEditGradePage />} />
        {/* Teacher Management */}
        <Route path="teachers" element={<TeacherManagementPage />} />
        {/* Schedule Management */}
        <Route
          path="schedules"
          element={
            <ProtectedRoute allowedRoles={['director', 'morning_school', 'evening_school']} fallback={<AccessDenied />}>
              <ScheduleManagementPage />
            </ProtectedRoute>
          }
        />
        {/* Daily Page - Morning and Evening School Staff */}
        <Route
          path="daily"
          element={
            <ProtectedRoute allowedRoles={['director', 'morning_school', 'evening_school']} fallback={<AccessDenied />}>
              <DailyPage />
            </ProtectedRoute>
          }
        />
        {/* Student Management */}
        <Route
          path="students/personal-info"
          element={
            <ProtectedRoute allowedRoles={['director', 'morning_school', 'evening_school']} fallback={<AccessDenied />}>
              <StudentPersonalInfoPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="students/academic-info"
          element={
            <ProtectedRoute allowedRoles={['director', 'morning_school', 'evening_school']} fallback={<AccessDenied />}>
              <StudentAcademicInfoPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="students/analytics"
          element={
            <ProtectedRoute allowedRoles={['director', 'morning_school', 'evening_school']} fallback={<AccessDenied />}>
              <StudentAnalyticsPage />
            </ProtectedRoute>
          }
        />
        {/* Activities Management - Director Only */}
        <Route
          path="activities"
          element={
            <ProtectedRoute allowedRoles={['director']} fallback={<AccessDenied />}>
              <ActivitiesManagementPage />
            </ProtectedRoute>
          }
        />
        {/* Finance Management - Finance Officer Only */}
        <Route
          path="finance"
          element={
            <ProtectedRoute allowedRoles={['finance', 'director']} fallback={<AccessDenied />}>
              <FinanceManagerPage />
            </ProtectedRoute>
          }
        />
        {/* User Management - Director Only */}
        <Route
          path="user-management"
          element={
            <ProtectedRoute allowedRoles={['director']} fallback={<AccessDenied />}>
              <UserManagementPage />
            </ProtectedRoute>
          }
        />
        {/* Director Notes - Director Only Protected Routes */}
        <Route
          path="director/notes"
          element={
            <ProtectedRoute allowedRoles={['director']} fallback={<AccessDenied />}>
              <DirectorNotesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="director/notes/search"
          element={
            <ProtectedRoute allowedRoles={['director']} fallback={<AccessDenied />}>
              <DirectorNotesSearchPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="director/notes/browse/:category"
          element={
            <ProtectedRoute allowedRoles={['director']} fallback={<AccessDenied />}>
              <NoteFolderBrowser />
            </ProtectedRoute>
          }
        />
        <Route
          path="director/notes/edit/:fileId"
          element={
            <ProtectedRoute allowedRoles={['director']} fallback={<AccessDenied />}>
              <MarkdownNoteEditor />
            </ProtectedRoute>
          }
        />
        <Route
          path="director/notes/rewards"
          element={
            <ProtectedRoute allowedRoles={['director']} fallback={<AccessDenied />}>
              <RewardsManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="director/notes/assistance"
          element={
            <ProtectedRoute allowedRoles={['director']} fallback={<AccessDenied />}>
              <AssistanceManager />
            </ProtectedRoute>
          }
        />
        {/* Settings - Available to all non-director roles, director can also access */}
        <Route
          path="settings"
          element={
            <ProtectedRoute 
              allowedRoles={['director', 'finance', 'morning_school', 'evening_school', 'morning_supervisor', 'evening_supervisor']} 
              fallback={<AccessDenied />}
            >
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        {/* Catch-all for undefined routes */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
};

// Component to check year selection and redirect
const YearSelectionCheck = () => {
  const [loading, setLoading] = useState(true);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    const checkAndSetDefaultYear = async () => {
      try {
        // Always fetch years from backend to validate state
        const { academicYearsApi } = await import('@/services/api');
        const response = await academicYearsApi.getAll();

        let years = [];
        if (response.success && response.data) {
          years = response.data;
        } else if (Array.isArray(response)) {
          years = response;
        }

        // If no years exist, clear localStorage and redirect to year management
        if (years.length === 0) {
          localStorage.removeItem('selected_academic_year_id');
          localStorage.removeItem('selected_academic_year_name');
          localStorage.removeItem('auto_open_academic_year');
          localStorage.removeItem('first_run_completed');
          setShouldRedirect(false);
          setLoading(false);
          return;
        }

        const selectedYearId = localStorage.getItem('selected_academic_year_id');

        // Verify that the selected year actually exists in the database
        if (selectedYearId) {
          const yearExists = years.some((year: any) => year.id?.toString() === selectedYearId);
          if (yearExists) {
            // Year exists and is selected
            setShouldRedirect(true);
            setLoading(false);
            return;
          } else {
            // Selected year doesn't exist anymore, clear it
            localStorage.removeItem('selected_academic_year_id');
            localStorage.removeItem('selected_academic_year_name');
            localStorage.removeItem('auto_open_academic_year');
          }
        }

        // Find the active year and auto-select it
        const activeYear = years.find((year: any) => year.is_active);

        if (activeYear) {
          // Set the active year as selected
          localStorage.setItem('selected_academic_year_id', activeYear.id?.toString() || '');
          localStorage.setItem('selected_academic_year_name', activeYear.year_name || '');
          localStorage.setItem('auto_open_academic_year', 'true');
          // Dispatch custom event to notify other components
          window.dispatchEvent(new Event('academicYearChanged'));
          setShouldRedirect(true);
        }
      } catch (error) {

      } finally {
        setLoading(false);
      }
    };

    checkAndSetDefaultYear();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (shouldRedirect) {
    // If year is selected, go to dashboard
    return <Navigate to="/dashboard" replace />;
  } else {
    // If no year selected, go to year management
    return <Navigate to="/academic-years" replace />;
  }
};

const AppContent = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [contentVisible, setContentVisible] = useState(false);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  useEffect(() => {
    if (showSplash) {
      setContentVisible(false);
      return;
    }

    const timer = requestAnimationFrame(() => setContentVisible(true));
    return () => cancelAnimationFrame(timer);
  }, [showSplash]);

  // Disable common browser shortcuts (F3 search, F5 reload, Ctrl/Cmd+R reload)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isReload = event.key === 'F5' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r');
      const isSearch = event.key === 'F3';
      if (isReload || isSearch) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true } as any);
  }, []);

  // Disable right-click context menu globally for native app feel
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ZoomProvider>
        {/* Show splash screen with minimal title bar (only nav buttons) */}
        {showSplash ? (
          <>
            <CustomTitleBar mode="splash" />
            <div className="pt-12">
              <SplashScreen onComplete={handleSplashComplete} />
            </div>
          </>
        ) : (
          <div className={`transition-opacity duration-700 ease-out ${contentVisible ? 'opacity-100' : 'opacity-0'}`}>
            <QueryClientProvider client={queryClient}>
              <TooltipProvider>
                <AuthProvider>
                  <ProjectProvider>
                    <TitleBarWithRouting />
                  </ProjectProvider>
                </AuthProvider>
              </TooltipProvider>
            </QueryClientProvider>
          </div>
        )}
      </ZoomProvider>
    </Router>
  );
};

// Component to handle title bar mode based on current route
const TitleBarWithRouting = () => {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login' || location.pathname === '/';
  
  return (
    <>
      <CustomTitleBar mode={isLoginPage ? 'login' : 'full'} />
      <div className="app-container bg-background text-foreground font-ios pt-12">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<ProtectedApp />} />
        </Routes>
        <Toaster />
      </div>
    </>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true} storageKey="theme-preference">
        <AppContent />
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
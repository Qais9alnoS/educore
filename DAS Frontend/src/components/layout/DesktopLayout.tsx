import React, { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { useProject } from "@/contexts/ProjectContext";

const DesktopLayout = () => {
  const location = useLocation();
  const { state } = useProject();
  const { currentProject, isLoading } = state;

  const isProjectRoute = location.pathname.includes("/projects/");
  const showSidebar = true; // Always show sidebar for authenticated users
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(256); // Default width in pixels

  // Update sidebar width when collapsed state changes
  useEffect(() => {
    setSidebarWidth(isSidebarCollapsed ? 64 : 256);
  }, [isSidebarCollapsed]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="fixed top-12 left-0 right-0 bottom-0 flex flex-col bg-background" dir="rtl">
      {/* Main content area - header is now in CustomTitleBar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - positioned on the right for RTL layout */}
        {showSidebar && (
          <div className="h-full flex relative pr-4 pb-4">
            <Sidebar
              isCollapsed={isSidebarCollapsed}
              setIsCollapsed={setIsSidebarCollapsed}
              sidebarWidth={sidebarWidth}
            />
          </div>
        )}

        {/* Main Content - moved to the left side for RTL */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto pb-6">
            <div className="max-w-7xl mx-auto p-6">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
/*hiiiiiii*/
export { DesktopLayout };

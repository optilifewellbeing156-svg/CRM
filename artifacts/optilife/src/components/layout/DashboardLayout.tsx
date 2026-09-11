import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "hsl(160,30%,97%)" }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-60 flex flex-col min-h-screen">
        <Navbar onMenuToggle={() => setSidebarOpen((o) => !o)} />
        {/* The env() insets only resolve to non-zero on notched devices running
            the installed app full-screen; in a browser tab they are all 0. */}
        <main className="flex-1 p-4 lg:p-6 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] lg:pl-6 lg:pr-6">
          {children}
        </main>
      </div>
    </div>
  );
}

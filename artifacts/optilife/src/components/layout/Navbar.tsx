import { useLocation } from "wouter";
import { Menu } from "lucide-react";
import { clearMeCache } from "@/hooks/useMe";

interface NavbarProps {
  onMenuToggle: () => void;
}

export function Navbar({ onMenuToggle }: NavbarProps) {
  const [, setLocation] = useLocation();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    clearMeCache();
    setLocation("/login");
  }

  return (
    // The safe-area top padding keeps the bar clear of the iPhone status bar
    // when the app runs full-screen; it collapses to 0 everywhere else.
    <header className="bg-white border-b border-gray-200 pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <div className="h-14 flex items-center justify-between px-4 lg:px-6">
        <button
          onClick={onMenuToggle}
          className="lg:hidden -ml-2 p-2.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div className="lg:hidden flex items-center gap-2 min-w-0">
          <img src="/logo.png" alt="" className="h-7 w-7 shrink-0" />
          <span className="font-semibold text-sm truncate" style={{ color: "hsl(170,42%,30%)" }}>OptiLifeWellbeing</span>
        </div>
        <button
          onClick={handleLogout}
          className="ml-auto shrink-0 min-h-11 px-2 -mr-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

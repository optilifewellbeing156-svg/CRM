import { useState } from "react";
import { Check, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { InstallInstructionsSheet } from "./InstallInstructionsSheet";

type Variant = "sidebar" | "card";

interface InstallAppButtonProps {
  /** "sidebar" matches the nav items it sits below; "card" is the Settings block. */
  variant: Variant;
}

/**
 * "Install it on your phone."
 *
 * Three routes, one button:
 *   Chromium  — fires the real native install dialog
 *   iOS       — opens a sheet with the manual Add to Home Screen steps
 *   otherwise — opens a sheet pointing at the browser's own menu
 *
 * Renders nothing once the app is already installed.
 */
export function InstallAppButton({ variant }: InstallAppButtonProps) {
  const { isInstalled, platform, promptInstall } = useInstallPrompt();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || dismissed) return null;

  async function handleClick() {
    if (platform === "prompt") {
      const outcome = await promptInstall();
      // Chromium keeps the prompt available after a dismissal, so only a real
      // install or a vanished prompt should take the button away.
      if (outcome === "accepted") setDismissed(true);
      if (outcome !== "unavailable") return;
    }
    setSheetOpen(true);
  }

  const sheet = (
    <InstallInstructionsSheet
      open={sheetOpen}
      onOpenChange={setSheetOpen}
      mode={platform === "ios" ? "ios" : "manual"}
    />
  );

  if (variant === "sidebar") {
    return (
      <>
        <button
          onClick={handleClick}
          className="flex w-full min-h-11 items-center gap-3 rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-left text-sm text-white transition-colors hover:bg-white/20"
        >
          <Smartphone size={17} className="shrink-0" />
          <span className="leading-tight">Install it on your phone</span>
        </button>
        {sheet}
      </>
    );
  }

  // Matches the surrounding Settings cards: xl radius, bordered header, padded body.
  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-sm font-semibold text-gray-900">Install it on your phone</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Add OptiLife to your home screen so it opens full-screen, without the browser bars.
          </p>
        </div>
        <div className="p-4">
          <div className="flex items-start gap-4">
            <img src="/icons/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-xl" />
            <ul className="min-w-0 flex-1 space-y-1.5">
              {[
                "Opens straight to your dashboard",
                "Launches instantly from your home screen",
                "Works on iPhone, iPad and Android",
              ].map((benefit) => (
                <li key={benefit} className="flex items-start gap-2 text-sm text-gray-600">
                  <Check size={15} className="mt-0.5 shrink-0" style={{ color: "hsl(170,42%,40%)" }} />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
          <Button onClick={handleClick} className="mt-4 min-h-11 w-full sm:w-auto">
            <Smartphone size={16} />
            Install it on your phone
          </Button>
        </div>
      </div>
      {sheet}
    </>
  );
}

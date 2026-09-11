import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/Button";
import { isIosSafari } from "@/hooks/useInstallPrompt";

/** The iOS Share glyph — a box with an arrow rising out of it. */
function ShareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={className}>
      <path d="M12 15V3.5" strokeLinecap="round" />
      <path d="M8.5 7 12 3.5 15.5 7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 11H5.5A1.5 1.5 0 0 0 4 12.5v6A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 18.5 11H17" strokeLinecap="round" />
    </svg>
  );
}

/** The "Add to Home Screen" row glyph — a rounded square with a plus in it. */
function AddToHomeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={className}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <path d="M12 8.5v7M8.5 12h7" strokeLinecap="round" />
    </svg>
  );
}

/** A browser's overflow menu — three stacked dots. */
function MenuDotsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <circle cx="12" cy="5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="19" r="1.7" />
    </svg>
  );
}

function Step({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
        style={{ backgroundColor: "hsl(170,42%,40%)" }}
      >
        {index}
      </span>
      <span className="text-sm leading-relaxed text-gray-700">{children}</span>
    </li>
  );
}

/** Keeps an inline glyph optically centred on the text baseline. */
function InlineGlyph({ children }: { children: React.ReactNode }) {
  return <span className="mx-0.5 inline-flex translate-y-1 items-center">{children}</span>;
}

interface InstallInstructionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * "ios" — Apple has no install API at all, so Add to Home Screen is manual.
   * "manual" — a browser that can install but gave us no prompt to hook into
   * (Firefox, Samsung Internet, or Chrome before its criteria are met).
   */
  mode: "ios" | "manual";
}

export function InstallInstructionsSheet({ open, onOpenChange, mode }: InstallInstructionsSheetProps) {
  const inSafari = isIosSafari();
  const showIosSteps = mode === "ios" && inSafari;
  const showSafariNudge = mode === "ios" && !inSafari;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-md px-5">
          <DrawerHeader className="px-0 text-left">
            <div className="mb-3 flex items-center gap-3">
              <img src="/icons/icon-192.png" alt="" className="h-12 w-12 rounded-xl" />
              <div>
                <DrawerTitle className="text-base">
                  {mode === "ios" ? "Add OptiLife to your Home Screen" : "Install OptiLife"}
                </DrawerTitle>
                <DrawerDescription className="mt-0.5">It opens full-screen, like a normal app.</DrawerDescription>
              </div>
            </div>
          </DrawerHeader>

          {showIosSteps && (
            <ol className="space-y-4 pb-2">
              <Step index={1}>
                Tap the{" "}
                <InlineGlyph>
                  <ShareIcon className="h-[1.15rem] w-[1.15rem] text-[hsl(211,100%,50%)]" />
                </InlineGlyph>{" "}
                <strong className="font-semibold">Share</strong> button in Safari's toolbar — at the bottom of the
                screen on iPhone, top-right on iPad.
              </Step>
              <Step index={2}>
                Scroll down the list and tap <strong className="font-semibold">Add to Home Screen</strong>
                <InlineGlyph>
                  <AddToHomeIcon className="h-[1.15rem] w-[1.15rem] text-gray-500" />
                </InlineGlyph>
              </Step>
              <Step index={3}>
                Tap <strong className="font-semibold">Add</strong> in the top-right corner. OptiLife will appear on
                your Home Screen.
              </Step>
            </ol>
          )}

          {showSafariNudge && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm leading-relaxed text-amber-900">
                On iPhone and iPad, only <strong className="font-semibold">Safari</strong> can add an app to the Home
                Screen. Open this page in Safari, then tap Share → Add to Home Screen.
              </p>
            </div>
          )}

          {mode === "manual" && (
            <ol className="space-y-4 pb-2">
              <Step index={1}>
                Open your browser's menu —{" "}
                <InlineGlyph>
                  <MenuDotsIcon className="h-[1.05rem] w-[1.05rem] text-gray-500" />
                </InlineGlyph>{" "}
                usually in the top-right corner.
              </Step>
              <Step index={2}>
                Choose <strong className="font-semibold">Install app</strong> or{" "}
                <strong className="font-semibold">Add to Home screen</strong>.
              </Step>
              <Step index={3}>Confirm, and OptiLife will be added to your device.</Step>
            </ol>
          )}

          <p className="mt-5 rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-500">
            The installed app keeps its own sign-in, so you'll be asked to log in once more the first time you open
            it.
          </p>

          <Button variant="secondary" className="mt-4 min-h-11 w-full" onClick={() => onOpenChange(false)}>
            Got it
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

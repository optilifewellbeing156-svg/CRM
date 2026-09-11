import { useCallback, useEffect, useState } from "react";

/**
 * The non-standard event Chromium fires when the app meets the install
 * criteria. Not in lib.dom, so it is declared here.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

export type InstallPlatform =
  /** Chromium fired beforeinstallprompt — we can show a real install dialog. */
  | "prompt"
  /** iOS/iPadOS Safari — no install API exists, so we show manual steps. */
  | "ios"
  /** Installable in principle, but this browser gives us no hook (e.g. Firefox). */
  | "manual";

export interface InstallPromptState {
  /** True once the app is running from the home screen / app window. */
  isInstalled: boolean;
  /** Which install route applies to this browser. */
  platform: InstallPlatform;
  /** True when promptInstall() will show the native dialog right now. */
  canPromptNatively: boolean;
  /**
   * Shows the native install dialog. Resolves to the user's choice, or
   * "unavailable" if no deferred prompt was in hand.
   */
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS uses a non-standard navigator flag; everyone else reports a display-mode.
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return (
    iosStandalone ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches
  );
}

export function detectIos(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIphoneOrIpod = /iPhone|iPod/.test(ua);
  // iPadOS 13+ reports itself as a Mac; the touch points give it away.
  const isIpad = /iPad/.test(ua) || (/Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1);
  return isIphoneOrIpod || isIpad;
}

/** True for iOS browsers that are Safari rather than an in-app webview. */
export function isIosSafari(): boolean {
  if (!detectIos()) return false;
  // Every iOS browser runs on WebKit, but only Safari exposes Add to Home Screen.
  // Chrome (CriOS), Firefox (FxiOS) and Edge (EdgiOS) on iOS cannot install.
  return !/CriOS|FxiOS|EdgiOS|OPiOS|mercury/.test(window.navigator.userAgent);
}

export function useInstallPrompt(): InstallPromptState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(detectStandalone);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      // Suppress Chrome's own mini-infobar so our button owns the moment.
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setDeferredPrompt(null);
      setIsInstalled(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Catches the user installing from the browser's own menu while a tab is open.
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = (event: MediaQueryListEvent) => {
      if (event.matches) setIsInstalled(true);
    };
    standaloneQuery.addEventListener("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      standaloneQuery.removeEventListener("change", handleDisplayModeChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return "unavailable" as const;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // The event is single-use; Chrome re-fires it if the user declines.
    setDeferredPrompt(null);
    return outcome;
  }, [deferredPrompt]);

  const platform: InstallPlatform = deferredPrompt ? "prompt" : detectIos() ? "ios" : "manual";

  return {
    isInstalled,
    platform,
    canPromptNatively: deferredPrompt !== null,
    promptInstall,
  };
}

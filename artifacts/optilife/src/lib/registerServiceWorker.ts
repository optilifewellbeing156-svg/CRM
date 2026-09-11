/**
 * Registers the PWA service worker.
 *
 * Only runs in production builds: during `vite dev` the module graph is served
 * unbundled and a caching worker would fight HMR. Use `pnpm build && pnpm serve`
 * to exercise it locally — service workers require HTTPS or localhost, so a
 * plain http:// LAN address will silently refuse to register.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      // A failed registration costs us the install prompt, not the app itself.
      console.error("[pwa] service worker registration failed:", error);
    });
  });

  // A *replacement* worker taking over means fresh hashed bundles the running
  // page does not have, so reload once. On the very first visit there is no
  // controller yet and clients.claim() fires this same event — reloading then
  // would be a pointless flash, so that case is skipped.
  const hadController = navigator.serviceWorker.controller !== null;
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });
}

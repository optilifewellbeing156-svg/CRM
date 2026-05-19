import { useState, useEffect } from "react";
import type { Me } from "@/types";

type AuthState = Me | "loading";

let cache: AuthState = "loading";
let fetching = false;
const listeners = new Set<(state: AuthState) => void>();

function notify(state: AuthState) {
  cache = state;
  fetching = false;
  listeners.forEach((l) => l(state));
}

export function clearMeCache() {
  cache = "loading";
  fetching = false;
  listeners.forEach((l) => l("loading"));
}

export function useMe(): Me | "loading" {
  const [state, setState] = useState<AuthState>(cache);

  useEffect(() => {
    listeners.add(setState);
    if (cache === "loading" && !fetching) {
      fetching = true;
      fetch("/api/auth/me", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => notify(data as Me))
        .catch(() => notify(null));
    } else {
      setState(cache);
    }
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return state;
}

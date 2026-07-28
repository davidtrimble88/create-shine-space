// Per-user default location preference for schedule filters.
// Stored in localStorage keyed by user id so different accounts on the same
// device keep their own preference.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const keyFor = (userId: string) => `defaultScheduleLocation:${userId}`;

export function getDefaultLocationSync(userId: string | null): string {
  if (!userId || typeof window === "undefined") return "all";
  try {
    return window.localStorage.getItem(keyFor(userId)) || "all";
  } catch {
    return "all";
  }
}

export function useDefaultLocation() {
  const [userId, setUserId] = useState<string | null>(null);
  const [defaultLocation, setDefaultLocationState] = useState<string>("all");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const uid = data.user?.id ?? null;
      setUserId(uid);
      setDefaultLocationState(getDefaultLocationSync(uid));
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  const setDefaultLocation = useCallback((loc: string) => {
    if (!userId) return;
    try {
      if (loc && loc !== "all") window.localStorage.setItem(keyFor(userId), loc);
      else window.localStorage.removeItem(keyFor(userId));
    } catch { /* ignore */ }
    setDefaultLocationState(loc || "all");
  }, [userId]);

  return { defaultLocation, setDefaultLocation, loaded };
}

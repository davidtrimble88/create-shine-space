import { useEffect, useState } from "react";

export function useIsNativeApp() {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("@capacitor/core")
      .then(({ Capacitor }) => {
        if (!cancelled) setIsNative(Capacitor.isNativePlatform());
      })
      .catch(() => {
        // Capacitor not available — regular browser
      });
    return () => { cancelled = true; };
  }, []);

  return isNative;
}

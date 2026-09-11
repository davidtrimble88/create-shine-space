import { useEffect } from "react";
import { logPortalError } from "@/lib/errorLog";

/**
 * Captures uncaught errors and failed promises anywhere in the app and
 * records them permanently, so intermittent portal failures can be traced.
 */
const GlobalErrorLogger = () => {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      logPortalError({
        context: "uncaught_error",
        error: e.error ?? e.message,
        details: { source: e.filename, line: e.lineno, col: e.colno },
      });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      logPortalError({ context: "unhandled_rejection", error: e.reason });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
};

export default GlobalErrorLogger;

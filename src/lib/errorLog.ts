import { supabase } from "@/integrations/supabase/client";

type LogArgs = {
  context: string;
  error: unknown;
  email?: string | null;
  name?: string | null;
  details?: unknown;
};

const recent = new Map<string, number>();

function describe(error: unknown): { message: string; details: string | null } {
  if (!error) return { message: "Unknown error", details: null };
  if (typeof error === "string") return { message: error, details: null };
  const anyErr = error as any;
  const message =
    anyErr?.message ||
    anyErr?.error_description ||
    anyErr?.error ||
    "Unknown error";
  let details: string | null = null;
  try {
    details = JSON.stringify(
      {
        name: anyErr?.name,
        code: anyErr?.code,
        status: anyErr?.status,
        hint: anyErr?.hint,
        details: anyErr?.details,
        stack: typeof anyErr?.stack === "string" ? anyErr.stack.slice(0, 2000) : undefined,
      },
      null,
      1,
    );
  } catch {
    details = null;
  }
  return { message: String(message).slice(0, 1000), details };
}

/**
 * Records a portal failure permanently so it can be reviewed later.
 * Never throws — logging must not break the page it is reporting on.
 */
export async function logPortalError({ context, error, email, name, details }: LogArgs) {
  try {
    const parsed = describe(error);
    const key = `${context}|${parsed.message}`;
    const now = Date.now();
    const last = recent.get(key) ?? 0;
    if (now - last < 15000) return; // de-dupe bursts
    recent.set(key, now);

    let userId: string | null = null;
    let userEmail = email ?? null;
    try {
      const { data } = await supabase.auth.getSession();
      userId = data.session?.user?.id ?? null;
      userEmail = userEmail ?? data.session?.user?.email ?? null;
    } catch {
      /* ignore */
    }

    const extra = details ? (() => { try { return JSON.stringify(details); } catch { return null; } })() : null;

    await supabase.from("portal_error_log").insert({
      user_id: userId,
      user_email: userEmail,
      user_name: name ?? null,
      context,
      route: typeof window !== "undefined" ? window.location.pathname + window.location.search : null,
      error_message: parsed.message,
      error_details: [parsed.details, extra].filter(Boolean).join("\n") || null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    });
  } catch {
    /* swallow */
  }
}

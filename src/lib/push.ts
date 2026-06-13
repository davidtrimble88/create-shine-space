// Web Push helpers. Service worker is registered only in production / installed app contexts
// (never inside Lovable preview/iframes), per the PWA guidance.
import { supabase } from "@/integrations/supabase/client";

export const VAPID_PUBLIC_KEY =
  "BCe7N9K_HFUKC5MBNVKObMeP2bPtYTEKsYfhqzXX2VLSRlqFYjkra-Ns9z_zDPhmQWMLo6KD5zaTFCDkHe6yObA";

const SW_URL = "/sw.js";

function isPreviewOrDev(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  try { if (window.top !== window.self) return true; } catch { return true; }
  const h = window.location.hostname;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
  if (h === "lovableproject.com" || h.endsWith(".lovableproject.com")) return true;
  if (h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com")) return true;
  if (h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev")) return true;
  return false;
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  if (isPreviewOrDev()) {
    // Clean up any stale registration that might have been created previously
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.filter(r => r.active?.scriptURL?.endsWith(SW_URL)).map(r => r.unregister()));
    } catch {}
    return null;
  }
  try {
    const existing = await navigator.serviceWorker.getRegistration(SW_URL);
    if (existing) return existing;
    return await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  } catch (e) {
    console.warn("[push] SW register failed:", e);
    return null;
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export type PushStatus = "unsupported" | "preview" | "blocked" | "granted" | "default" | "subscribed";

export async function getPushStatus(): Promise<PushStatus> {
  if (!pushSupported()) return "unsupported";
  if (isPreviewOrDev()) return "preview";
  if (Notification.permission === "denied") return "blocked";
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) return "subscribed";
  return Notification.permission === "granted" ? "granted" : "default";
}

export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  if (isPreviewOrDev()) return { ok: false, reason: "preview" };

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: perm };

  const reg = await ensureServiceWorker();
  if (!reg) return { ok: false, reason: "no_sw" };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "not_signed_in" };

  const json = sub.toJSON();
  const endpoint = json.endpoint ?? sub.endpoint;
  const p256dh = json.keys?.p256dh ?? arrayBufferToBase64(sub.getKey("p256dh"));
  const auth = json.keys?.auth ?? arrayBufferToBase64(sub.getKey("auth"));

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: "endpoint" }
  );
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    try { await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint); } catch {}
    try { await sub.unsubscribe(); } catch {}
  }
}

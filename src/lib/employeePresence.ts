import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

const TOPIC = "employee-presence";
let channel: RealtimeChannel | null = null;
let online = new Set<string>();
const listeners = new Set<(s: Set<string>) => void>();

function ensureChannel(presenceKey?: string) {
  if (channel) return channel;
  channel = supabase.channel(TOPIC, {
    config: { presence: { key: presenceKey ?? "" } },
  });
  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel!.presenceState();
      online = new Set(Object.keys(state));
      listeners.forEach((l) => l(online));
    })
    .subscribe();
  return channel;
}

export function subscribePresence(cb: (s: Set<string>) => void) {
  ensureChannel();
  listeners.add(cb);
  cb(online);
  return () => { listeners.delete(cb); };
}

export function trackPresence(userId: string) {
  const ch = ensureChannel(userId);
  let tracked = false;
  const track = () => {
    if (document.visibilityState === "visible") {
      ch.track({ user_id: userId, online_at: new Date().toISOString() });
      tracked = true;
    } else if (tracked) {
      ch.untrack();
      tracked = false;
    }
  };
  // Give the channel a moment to join before first track
  setTimeout(track, 300);
  const onVis = () => track();
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("focus", track);
  window.addEventListener("blur", track);
  return () => {
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("focus", track);
    window.removeEventListener("blur", track);
    if (tracked) ch.untrack();
  };
}

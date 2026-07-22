import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

const TOPIC = "employee-presence";
let channel: RealtimeChannel | null = null;
let joined = false;
let currentKey = "";
let online = new Set<string>();
const listeners = new Set<(s: Set<string>) => void>();
const pending: Array<() => void> = [];

function ensureChannel(presenceKey?: string) {
  // Recreate the channel if we need a real presence key but the existing one
  // was created with an empty key (observer mounted before tracker).
  if (channel && presenceKey && currentKey !== presenceKey) {
    try { supabase.removeChannel(channel); } catch {}
    channel = null;
    joined = false;
  }
  if (channel) return channel;

  currentKey = presenceKey ?? "";
  const ch = supabase.channel(TOPIC, {
    config: { presence: { key: currentKey } },
  });
  ch.on("presence", { event: "sync" }, () => {
    const state = ch.presenceState() as Record<string, Array<{ user_id?: string }>>;
    const next = new Set<string>();
    for (const [key, metas] of Object.entries(state)) {
      if (key) next.add(key);
      for (const m of metas || []) {
        if (m?.user_id) next.add(m.user_id);
      }
    }
    online = next;
    listeners.forEach((l) => l(online));
  });
  ch.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      joined = true;
      const q = pending.splice(0);
      q.forEach((fn) => fn());
    }
  });
  channel = ch;
  return channel;
}

function whenJoined(fn: () => void) {
  if (joined) fn();
  else pending.push(fn);
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
  const doTrack = () => {
    if (document.visibilityState !== "hidden") {
      whenJoined(() => {
        ch.track({ user_id: userId, online_at: new Date().toISOString() });
        tracked = true;
      });
    } else if (tracked) {
      ch.untrack();
      tracked = false;
    }
  };
  doTrack();
  const onVis = () => doTrack();
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("focus", doTrack);
  window.addEventListener("pageshow", doTrack);
  return () => {
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("focus", doTrack);
    window.removeEventListener("pageshow", doTrack);
    if (tracked) ch.untrack();
  };
}

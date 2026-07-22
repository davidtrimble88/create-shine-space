import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

const TOPIC = "employee-presence";

type PresenceListener = (s: Set<string>) => void;

type PresenceStore = {
  channel: RealtimeChannel | null;
  currentKey: string;
  joined: boolean;
  online: Set<string>;
  listeners: Set<PresenceListener>;
  pending: Array<() => void>;
  initializing: Promise<RealtimeChannel> | null;
};

const store: PresenceStore = ((globalThis as typeof globalThis & {
  __employeePresenceStore?: PresenceStore;
}).__employeePresenceStore ??= {
  channel: null,
  currentKey: "",
  joined: false,
  online: new Set<string>(),
  listeners: new Set<PresenceListener>(),
  pending: [],
  initializing: null,
});

const waitForChannelRemoval = async (channelToRemove: RealtimeChannel) => {
  try {
    await supabase.removeChannel(channelToRemove);
  } catch {
    // A stale channel should not take down the Employees page.
  }
};

async function ensureChannel(presenceKey?: string) {
  if (store.channel && (!presenceKey || store.currentKey === presenceKey)) {
    return store.channel;
  }

  if (store.initializing) {
    await store.initializing;
    if (store.channel && (!presenceKey || store.currentKey === presenceKey)) {
      return store.channel;
    }
  }

  store.initializing = (async () => {
    const staleChannels = supabase
      .getChannels()
      .filter((ch) => ch.topic === `realtime:${TOPIC}` && ch !== store.channel);

    await Promise.all(staleChannels.map(waitForChannelRemoval));

    if (store.channel && presenceKey && store.currentKey !== presenceKey) {
      await waitForChannelRemoval(store.channel);
      store.channel = null;
      store.joined = false;
      store.online = new Set<string>();
    }

    if (store.channel) return store.channel;

    store.currentKey = presenceKey ?? "";
    const ch = supabase.channel(TOPIC, {
      config: { presence: { key: store.currentKey } },
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
      store.online = next;
      store.listeners.forEach((listener) => listener(store.online));
    });

    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        store.joined = true;
        const queued = store.pending.splice(0);
        queued.forEach((fn) => fn());
      }
    });

    store.channel = ch;
    return ch;
  })();

  try {
    return await store.initializing;
  } finally {
    store.initializing = null;
  }
}

function whenJoined(fn: () => void) {
  if (store.joined) fn();
  else store.pending.push(fn);
}

export function subscribePresence(cb: (s: Set<string>) => void) {
  let active = true;
  store.listeners.add(cb);
  cb(store.online);
  void ensureChannel().catch(() => {
    if (active) cb(new Set<string>());
  });
  return () => {
    active = false;
    store.listeners.delete(cb);
  };
}

export function trackPresence(userId: string) {
  let tracked = false;
  const doTrack = () => {
    if (document.visibilityState !== "hidden") {
      void ensureChannel(userId).then((ch) => whenJoined(() => {
        ch.track({ user_id: userId, online_at: new Date().toISOString() });
        tracked = true;
      })).catch(() => undefined);
    } else if (tracked) {
      store.channel?.untrack();
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
    if (tracked) store.channel?.untrack();
  };
}

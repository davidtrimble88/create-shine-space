import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/registrationAttempts";

const HOLD_ID_KEY = "ltrvc_seat_hold_id";
const HOLD_SCHEDULE_KEY = "ltrvc_seat_hold_schedule";
const HOLD_EXPIRES_KEY = "ltrvc_seat_hold_expires";

/** Minutes a visitor gets to complete registration once a seat is reserved. */
export const SEAT_HOLD_MINUTES = 30;

export interface SeatHold {
  id: string;
  scheduleId: string;
  expiresAt: string;
}

export const readStoredHold = (): SeatHold | null => {
  try {
    const id = sessionStorage.getItem(HOLD_ID_KEY);
    const scheduleId = sessionStorage.getItem(HOLD_SCHEDULE_KEY);
    const expiresAt = sessionStorage.getItem(HOLD_EXPIRES_KEY);
    if (!id || !scheduleId || !expiresAt) return null;
    return { id, scheduleId, expiresAt };
  } catch {
    return null;
  }
};

const storeHold = (hold: SeatHold | null) => {
  try {
    if (!hold) {
      sessionStorage.removeItem(HOLD_ID_KEY);
      sessionStorage.removeItem(HOLD_SCHEDULE_KEY);
      sessionStorage.removeItem(HOLD_EXPIRES_KEY);
      return;
    }
    sessionStorage.setItem(HOLD_ID_KEY, hold.id);
    sessionStorage.setItem(HOLD_SCHEDULE_KEY, hold.scheduleId);
    sessionStorage.setItem(HOLD_EXPIRES_KEY, hold.expiresAt);
  } catch {
    /* ignore */
  }
};

export const clearStoredHold = () => storeHold(null);

export type HoldResult =
  | { ok: true; hold: SeatHold; message?: string }
  | { ok: false; reason: "full" | "unavailable" | "error"; message: string };


/** Reserve a seat on a class for SEAT_HOLD_MINUTES. */
export const createSeatHold = async (scheduleId: string): Promise<HoldResult> => {
  const visitorId = getVisitorId();
  if (!visitorId) {
    return { ok: false, reason: "error", message: "Your browser is blocking storage we need to hold your seat." };
  }
  try {
    const { data, error } = await supabase.rpc("create_seat_hold", {
      _schedule_id: scheduleId,
      _visitor_id: visitorId,
      _minutes: SEAT_HOLD_MINUTES,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : (data as any);
    if (!row?.id) throw new Error("No seat hold returned");
    const hold: SeatHold = { id: row.id, scheduleId, expiresAt: row.expires_at };
    storeHold(hold);
    return { ok: true, hold };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("CLASS_FULL")) {
      return { ok: false, reason: "full", message: "That class just filled up. Please choose another date." };
    }
    if (msg.includes("CLASS_UNAVAILABLE")) {
      return { ok: false, reason: "unavailable", message: "That class is no longer available. Please choose another date." };
    }
    console.warn("Seat hold failed", e);
    return { ok: false, reason: "error", message: "We couldn't hold a seat. Please try again." };
  }
};

/** Give the seat back. Always call after a booking is created too — the booking takes its own seat. */
export const releaseSeatHold = async (holdId?: string | null, converted = false) => {
  const id = holdId ?? readStoredHold()?.id;
  const visitorId = getVisitorId();
  clearStoredHold();
  if (!id || !visitorId) return;
  try {
    await supabase.rpc("release_seat_hold", { _id: id, _visitor_id: visitorId, _converted: converted });
  } catch (e) {
    console.warn("Failed to release seat hold", e);
  }
};

/** Server-truth check that a hold is still alive. */
export const checkSeatHold = async (holdId: string): Promise<boolean> => {
  const visitorId = getVisitorId();
  if (!visitorId) return false;
  try {
    const { data, error } = await supabase.rpc("get_seat_hold", { _id: holdId, _visitor_id: visitorId });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : (data as any);
    return Boolean(row?.active);
  } catch (e) {
    console.warn("Failed to check seat hold", e);
    return true; // don't kick someone out on a transient network error
  }
};

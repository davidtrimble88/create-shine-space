import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { classesMissingSeatLimit, classesOverbookedNow } from "@/lib/seatLimits";
import { SEAT_LIMITS_CHANGED } from "./MissingSeatLimitAlert";

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

interface Sched {
  id: string;
  date: string;
  schedule: string | null;
  total_seats: number | null;
  cancelled_at: string | null;
  location_label: string | null;
  group_name: string | null;
}

const fmt = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Owner/admin counters: running classes that are over their seat limit, or have none saved. */
const SeatProblemsSummary = ({ isOwner }: { isOwner: boolean }) => {
  const [over, setOver] = useState<{ schedule: Sched; seated: number; limit: number }[]>([]);
  const [missing, setMissing] = useState<Sched[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const today = todayISO();
    const since = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
    const { data: scheds, error } = await supabase
      .from("schedules")
      .select("id, date, schedule, total_seats, cancelled_at, location_label, group_name")
      .is("cancelled_at", null)
      .gte("date", since)
      .order("date");
    if (error) { console.error("seat problem summary failed", error); return; }
    const list = (scheds ?? []) as Sched[];
    const ids = list.map((s) => s.id);
    let bookings: { schedule_id: string | null; archived: boolean | null; dropped: boolean | null; is_retest: boolean | null; pending_payment: boolean | null }[] = [];
    if (ids.length) {
      const { data: bks } = await supabase
        .from("bookings")
        .select("schedule_id, archived, dropped, is_retest, pending_payment")
        .in("schedule_id", ids)
        .range(0, 9999);
      bookings = bks ?? [];
    }
    setOver(classesOverbookedNow(list, bookings, today));
    setMissing(classesMissingSeatLimit(list, today));
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener(SEAT_LIMITS_CHANGED, h);
    const channel = supabase
      .channel("overview-seat-problems")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, h)
      .on("postgres_changes", { event: "*", schema: "public", table: "schedules" }, h)
      .subscribe();
    return () => {
      window.removeEventListener(SEAT_LIMITS_CHANGED, h);
      supabase.removeChannel(channel);
    };
  }, [load]);

  const label = (s: Sched) =>
    `${fmt(s.date)} ${s.location_label ?? ""}${s.group_name ? ` ${s.group_name}` : ""}`.trim();

  const cards = [
    {
      key: "over",
      count: over.length,
      title: over.length === 1 ? "Class currently overbooked" : "Classes currently overbooked",
      icon: Users,
      to: isOwner ? "/employee-dashboard?tab=schedule-reporting" : "/employee-dashboard?tab=rosters",
      details: over.map((o) => `${label(o.schedule)} — ${o.seated}/${o.limit}`),
      ok: "No classes are over their seat limit",
    },
    {
      key: "missing",
      count: missing.length,
      title: missing.length === 1 ? "Class with no seat limit" : "Classes with no seat limit",
      icon: AlertTriangle,
      to: "/employee-dashboard?tab=schedule",
      details: missing.map(label),
      ok: "Every running class has a seat limit",
    },
  ];

  return (
    <div className="grid md:grid-cols-2 gap-6 mb-8">
      {cards.map((c) => {
        const bad = c.count > 0;
        return (
          <Link
            key={c.key}
            to={c.to}
            className={`block rounded-xl p-6 border transition-all hover:shadow-md ${
              bad
                ? "bg-destructive/10 border-destructive hover:shadow-destructive/20"
                : "bg-card border-border hover:border-accent hover:shadow-accent/10"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <c.icon className={`w-8 h-8 ${bad ? "text-destructive" : "text-muted-foreground"}`} />
              {bad && (
                <span className="text-xs font-semibold bg-destructive text-destructive-foreground px-2 py-1 rounded-full">
                  Needs attention
                </span>
              )}
            </div>
            <p className={`text-3xl font-bold ${bad ? "text-destructive" : "text-foreground"}`}>{loaded ? c.count : "—"}</p>
            <p className="text-sm text-muted-foreground mt-1">{c.title}</p>
            {loaded && (
              <p className="text-xs mt-2 text-muted-foreground">
                {bad
                  ? c.details.slice(0, 4).join(" · ") + (c.details.length > 4 ? ` · +${c.details.length - 4} more` : "")
                  : c.ok}
              </p>
            )}
          </Link>
        );
      })}
    </div>
  );
};

export default SeatProblemsSummary;

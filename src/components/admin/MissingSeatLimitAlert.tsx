import { useCallback, useEffect, useState } from "react";
import { AlertOctagon, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { classesMissingSeatLimit, parseSeatLimit } from "@/lib/seatLimits";
import { occupiesSeat } from "@/lib/overbooking";

export const SEAT_LIMITS_CHANGED = "seat-limits-changed";

interface Row {
  id: string;
  date: string;
  course: string;
  location_label: string;
  group_name: string | null;
  schedule: string;
  total_seats: number | null;
  cancelled_at: string | null;
}

const courseLabels: Record<string, string> = {
  basic: "Motorcyclist Training Course",
  intermediate: "Intermediate Course",
  advanced: "Advanced Riding Clinic",
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Save a class seat limit and recount its open seats. */
export const saveSeatLimit = async (scheduleId: string, limit: number) => {
  const { error } = await supabase.from("schedules").update({ total_seats: limit }).eq("id", scheduleId);
  if (error) return error;
  await supabase.rpc("reconcile_schedule_spots");
  window.dispatchEvent(new Event(SEAT_LIMITS_CHANGED));
  return null;
};

/**
 * Red flag for owners/admins: any class that still meets but has no seat limit
 * can be overbooked, because the database only blocks extra students when a
 * limit is saved.
 */
const MissingSeatLimitAlert = ({ defaultExpanded = false }: { defaultExpanded?: boolean }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [seated, setSeated] = useState<Record<string, number>>({});
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [bulk, setBulk] = useState("12");
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { setExpanded(defaultExpanded); }, [defaultExpanded]);

  const load = useCallback(async () => {
    const today = todayISO();
    const since = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("schedules")
      .select("id, date, course, location_label, group_name, schedule, total_seats, cancelled_at")
      .is("cancelled_at", null)
      .or("total_seats.is.null,total_seats.lte.0")
      .gte("date", since)
      .order("date");
    if (error) { console.error("missing seat limit check failed", error); return; }
    const flagged = classesMissingSeatLimit((data ?? []) as Row[], today);
    setRows(flagged);
    if (flagged.length) {
      const { data: bks } = await supabase
        .from("bookings")
        .select("schedule_id, archived, dropped, is_retest, pending_payment")
        .in("schedule_id", flagged.map((r) => r.id));
      const counts: Record<string, number> = {};
      (bks ?? []).forEach((b) => { if (occupiesSeat(b)) counts[b.schedule_id!] = (counts[b.schedule_id!] ?? 0) + 1; });
      setSeated(counts);
    }
  }, []);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener(SEAT_LIMITS_CHANGED, h);
    return () => window.removeEventListener(SEAT_LIMITS_CHANGED, h);
  }, [load]);

  const saveOne = async (r: Row) => {
    const limit = parseSeatLimit(inputs[r.id] ?? "");
    if (!limit) {
      toast({ title: "Enter a seat limit", description: "Type how many students this class can hold (1 or more).", variant: "destructive" });
      return;
    }
    setSaving(r.id);
    const err = await saveSeatLimit(r.id, limit);
    setSaving(null);
    if (err) { toast({ title: "Could not save", description: err.message, variant: "destructive" }); return; }
    toast({ title: "Seat limit saved", description: `This class is now limited to ${limit} students.` });
  };

  const saveAll = async () => {
    const limit = parseSeatLimit(bulk);
    if (!limit) {
      toast({ title: "Enter a seat limit", description: "Type how many students each class can hold (1 or more).", variant: "destructive" });
      return;
    }
    if (!confirm(`Set a ${limit}-student limit on all ${rows.length} classes listed?`)) return;
    setSaving("all");
    const ids = rows.map((r) => r.id);
    const { error } = await supabase.from("schedules").update({ total_seats: limit }).in("id", ids);
    if (!error) { await supabase.rpc("reconcile_schedule_spots"); window.dispatchEvent(new Event(SEAT_LIMITS_CHANGED)); }
    setSaving(null);
    if (error) { toast({ title: "Could not save", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Seat limits saved", description: `${ids.length} classes are now limited to ${limit} students.` });
  };

  if (rows.length === 0) return null;

  return (
    <div role="alert" className="mb-6 rounded-xl border-2 border-destructive bg-destructive/15 p-5 shadow-lg shadow-destructive/20">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <AlertOctagon className="w-8 h-8 text-destructive shrink-0" />
          <div>
            <p className="text-lg font-bold text-destructive">
              {rows.length} class{rows.length === 1 ? " has" : "es have"} NO SEAT LIMIT
            </p>
            <p className="text-sm text-foreground mt-1">
              Nothing stops these classes from being overbooked. Set how many students each one can hold.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Recheck</Button>
          <Button variant="destructive" size="sm" onClick={() => setExpanded((e) => !e)}>
            {expanded ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
            {expanded ? "Hide classes" : "Fix now"}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap rounded-lg border border-border bg-card p-3">
            <span className="text-sm text-foreground">Set every class below to</span>
            <Input type="number" min={1} value={bulk} onChange={(e) => setBulk(e.target.value)} className="w-20 h-8" aria-label="Seat limit for all listed classes" />
            <span className="text-sm text-foreground">students</span>
            <Button size="sm" disabled={saving !== null} onClick={saveAll}>{saving === "all" ? "Saving…" : "Apply to all"}</Button>
          </div>
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border border-border bg-card p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {new Date(r.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  {" · "}{courseLabels[r.course] || r.course}
                </p>
                <p className="text-sm text-muted-foreground">
                  {r.location_label}{r.group_name ? ` · ${r.group_name}` : ""} · {seated[r.id] ?? 0} seats taken
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={1} placeholder="12"
                  value={inputs[r.id] ?? ""}
                  onChange={(e) => setInputs((p) => ({ ...p, [r.id]: e.target.value }))}
                  className="w-20 h-8" aria-label={`Seat limit for ${r.date} ${r.location_label}`}
                />
                <Button size="sm" disabled={saving !== null} onClick={() => saveOne(r)}>
                  {saving === r.id ? "Saving…" : "Set limit"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MissingSeatLimitAlert;

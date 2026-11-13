import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ArrowRight, Download, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { formatClassDates } from "@/lib/classDates";
import {
  buildOverbookingReport,
  type MovedStudent,
  type OBBooking,
  type OBMove,
  type OBSchedule,
  type OverbookingRow,
} from "@/lib/overbooking";

const courseLabels: Record<string, string> = {
  basic: "Motorcyclist Training Course",
  intermediate: "Intermediate Riding Clinic",
  "1dpc": "1-Day Premier Course",
  advanced: "Advanced Riding Clinic",
};

type RangeKey = "all" | "past" | "upcoming" | "90";

const todayISO = () => format(new Date(), "yyyy-MM-dd");

async function fetchAll<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await build(from, from + page - 1);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < page) break;
  }
  return out;
}

const classTitle = (s: OBSchedule) =>
  `${formatClassDates(s.date, s.schedule ?? "")} · ${s.location_label}${s.group_name ? ` (${s.group_name.trim()})` : ""}`;

const destinationText = (m: MovedStudent) => {
  if (m.destinationKind === "class") {
    return m.destination
      ? `${classTitle(m.destination)} — ${courseLabels[m.destination.course] ?? m.destination.course}`
      : "Another class (no longer listed)";
  }
  if (m.destinationKind === "waiting") return "Waiting to be rescheduled";
  if (m.destinationKind === "removed") return "Removed from records";
  return "Dropped — not rescheduled";
};

const OverbookingReport = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<OverbookingRow[]>([]);
  const [range, setRange] = useState<RangeKey>("all");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [schedules, bookings, moves] = await Promise.all([
        fetchAll<OBSchedule>((a, b) =>
          supabase
            .from("schedules")
            .select("id, date, course, location_label, group_name, total_seats, schedule, cancelled_at")
            .order("date", { ascending: true })
            .range(a, b),
        ),
        fetchAll<OBBooking>((a, b) =>
          supabase
            .from("bookings")
            .select(
              "id, schedule_id, original_schedule_id, first_name, last_name, archived, dropped, is_retest, pending_payment, needs_reschedule, reschedule_reason, dropped_reason, rescheduled_at, overbook_override, overbook_reason",
            )
            .order("created_at", { ascending: true })
            .range(a, b),
        ),
        fetchAll<OBMove>((a, b) =>
          supabase
            .from("booking_class_moves")
            .select("booking_id, from_schedule_id, to_schedule_id, moved_at, reason")
            .order("moved_at", { ascending: true })
            .range(a, b),
        ),
      ]);
      setRows(buildOverbookingReport(schedules, bookings, moves));
    } catch (e: any) {
      setError(e?.message ?? "Could not load the report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    const today = todayISO();
    const ninetyAgo = format(new Date(Date.now() - 90 * 86400000), "yyyy-MM-dd");
    return rows.filter((r) => {
      if (range === "past") return r.schedule.date < today;
      if (range === "upcoming") return r.schedule.date >= today;
      if (range === "90") return r.schedule.date >= ninetyAgo;
      return true;
    });
  }, [rows, range]);

  const totals = useMemo(
    () => ({
      classes: visible.length,
      overNow: visible.filter((r) => r.overNow).length,
      moved: visible.reduce((n, r) => n + r.movedOut.length, 0),
    }),
    [visible],
  );

  const downloadCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      ["Class date", "Location", "Group", "Course", "Seat limit", "Seats taken now", "Most at once (estimate)", "Status", "Student moved out", "Retest", "Reason", "Moved on", "Now in"].map(esc).join(","),
    ];
    for (const r of visible) {
      const base = [
        r.schedule.date,
        r.schedule.location_label,
        r.schedule.group_name ?? "",
        courseLabels[r.schedule.course] ?? r.schedule.course,
        `${r.seatLimit}${r.seatLimitAssumed ? " (assumed)" : ""}`,
        r.seatedNow,
        r.peakEstimate,
        r.overNow ? "Over now" : r.likelyOverBefore ? "Likely over before moves" : "Override used",
      ];
      if (r.movedOut.length === 0) lines.push([...base, "", "", "", "", ""].map(esc).join(","));
      for (const m of r.movedOut) {
        lines.push(
          [
            ...base,
            m.name,
            m.isRetest ? "Yes" : "No",
            m.reason ?? "",
            m.movedAt ? format(new Date(m.movedAt), "yyyy-MM-dd") : "",
            destinationText(m),
          ]
            .map(esc)
            .join(","),
        );
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `overbooked-classes-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="border border-border rounded-xl p-4 bg-card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-accent mt-0.5" />
          <div>
            <h3 className="font-bold text-foreground">Overbooked Classes</h3>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Classes with more paid students than seats, now or before students were moved out. Retests and unpaid
              registrations don't take a seat. Classes with no seat limit saved are checked against 12.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <SelectTrigger className="w-40" aria-label="Date range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              <SelectItem value="90">Last 90 days on</SelectItem>
              <SelectItem value="past">Past classes</SelectItem>
              <SelectItem value="upcoming">Upcoming classes</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={load} aria-label="Refresh report" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" onClick={downloadCsv} disabled={loading || visible.length === 0} className="gap-2">
            <Download className="w-4 h-4" /> CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading report…
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border p-3">
              <div className="text-2xl font-bold text-foreground">{totals.classes}</div>
              <div className="text-xs text-muted-foreground">Classes flagged</div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-2xl font-bold text-foreground">{totals.overNow}</div>
              <div className="text-xs text-muted-foreground">Over the limit right now</div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-2xl font-bold text-foreground">{totals.moved}</div>
              <div className="text-xs text-muted-foreground">Students moved out</div>
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No overbooked classes in this range.</p>
          ) : (
            <div className="space-y-3">
              {visible.map((r) => (
                <div key={r.schedule.id} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-foreground">{classTitle(r.schedule)}</div>
                      <div className="text-xs text-muted-foreground">
                        {courseLabels[r.schedule.course] ?? r.schedule.course}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {r.overNow && <Badge variant="destructive">Over now</Badge>}
                      {!r.overNow && r.likelyOverBefore && <Badge variant="secondary">Likely over before moves</Badge>}
                      {r.overrides.length > 0 && <Badge variant="outline">Override used</Badge>}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      Seat limit: <span className="text-foreground font-medium">{r.seatLimit}</span>
                      {r.seatLimitAssumed && " (not saved — assumed)"}
                    </span>
                    <span>
                      Seats taken now: <span className="text-foreground font-medium">{r.seatedNow}</span>
                    </span>
                    <span>
                      Most at once (estimate): <span className="text-foreground font-medium">{r.peakEstimate}</span>
                    </span>
                    {r.retestsNow > 0 && <span>Retests: {r.retestsNow}</span>}
                    {r.unpaidNow > 0 && <span>Unpaid waiting: {r.unpaidNow}</span>}
                  </div>
                  {r.overrides.length > 0 && (
                    <div className="text-sm">
                      {r.overrides.map((o, i) => (
                        <div key={i} className="text-muted-foreground">
                          Added over the limit: <span className="text-foreground">{o.name}</span>
                          {o.reason ? ` — ${o.reason}` : ""}
                        </div>
                      ))}
                    </div>
                  )}
                  {r.movedOut.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground border-b border-border">
                            <th className="py-1.5 pr-3 font-medium">Student moved out</th>
                            <th className="py-1.5 pr-3 font-medium">Reason</th>
                            <th className="py-1.5 pr-3 font-medium">Moved on</th>
                            <th className="py-1.5 font-medium">Now in</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.movedOut.map((m) => (
                            <tr key={m.bookingId} className="border-b border-border/50 last:border-0 align-top">
                              <td className="py-1.5 pr-3 text-foreground">
                                {m.name}
                                {m.isRetest && <span className="text-xs text-muted-foreground"> (retest)</span>}
                              </td>
                              <td className="py-1.5 pr-3 text-muted-foreground">{m.reason ?? "—"}</td>
                              <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap">
                                {m.movedAt ? format(new Date(m.movedAt), "MMM d, yyyy") : "—"}
                              </td>
                              <td className="py-1.5 text-foreground">
                                <span className="inline-flex items-start gap-1">
                                  <ArrowRight className="w-3.5 h-3.5 mt-0.5 text-accent shrink-0" />
                                  {destinationText(m)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No students have been moved out of this class.</p>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            "Most at once" adds students who were later moved out back to today's count, so it can run high if
            someone left before others joined. Every class move is now logged, so future reports will be more exact.
          </p>
        </>
      )}
    </div>
  );
};

export default OverbookingReport;

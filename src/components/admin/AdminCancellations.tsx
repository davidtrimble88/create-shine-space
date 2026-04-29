import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, AlertTriangle, Ban, CalendarClock, RotateCcw, CheckCircle2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Schedule = Tables<"schedules">;
type Booking = Tables<"bookings">;
type Cancellation = Tables<"schedule_cancellations">;

interface Props {
  onBack: () => void;
}

const PART_OPTIONS = [
  { value: "c1", label: "C1 — Classroom 1" },
  { value: "r1", label: "R1 — Range 1" },
  { value: "c2", label: "C2 — Classroom 2" },
  { value: "r2", label: "R2 — Range 2" },
];

const partLabel = (p: string) => {
  if (p === "full") return "Full class (all parts)";
  if (p.includes(",")) {
    return p.split(",").map(v => PART_OPTIONS.find(o => o.value === v)?.label ?? v.toUpperCase()).join(", ");
  }
  return PART_OPTIONS.find(o => o.value === p)?.label ?? p.toUpperCase();
};

const courseLabels: Record<string, string> = {
  basic: "Motorcycle Training Course",
  intermediate: "Intermediate Course",
  advanced: "Advanced Riding Clinic",
};

const AdminCancellations = ({ onBack }: Props) => {
  const { toast } = useToast();
  const { user, userRole } = useAuth();
  const canAccess = userRole === "owner" || userRole === "admin";

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [cancellations, setCancellations] = useState<Cancellation[]>([]);
  const [pendingBookings, setPendingBookings] = useState<Booking[]>([]);
  const [allSchedules, setAllSchedules] = useState<Schedule[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [selectedParts, setSelectedParts] = useState<string[]>([]);
  const [reason, setReason] = useState("");

  const [reassignDialog, setReassignDialog] = useState<Booking | null>(null);
  const [reassignTarget, setReassignTarget] = useState("");
  const [reassignLocFilter, setReassignLocFilter] = useState<string>("all");
  const [pendingLocFilter, setPendingLocFilter] = useState<string>("all");
  const [cancelLocFilter, setCancelLocFilter] = useState<string>("all");

  const fetchAll = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const [schedRes, cancelRes, bookRes, allSchedRes] = await Promise.all([
      supabase.from("schedules").select("*").gte("date", today).order("date"),
      supabase.from("schedule_cancellations").select("*").order("cancelled_at", { ascending: false }),
      supabase.from("bookings").select("*").eq("needs_reschedule", true).order("created_at", { ascending: false }),
      supabase.from("schedules").select("*").gte("date", today).order("date"),
    ]);
    if (schedRes.data) setSchedules(schedRes.data);
    if (cancelRes.data) setCancellations(cancelRes.data);
    if (bookRes.data) setPendingBookings(bookRes.data);
    if (allSchedRes.data) setAllSchedules(allSchedRes.data);
  }, []);

  useEffect(() => {
    if (!canAccess) return;
    fetchAll();
    const channel = supabase
      .channel("admin-cancellations")
      .on("postgres_changes", { event: "*", schema: "public", table: "schedule_cancellations" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [canAccess, fetchAll]);

  if (!canAccess) {
    return (
      <div className="text-center py-12">
        <Ban className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
      </div>
    );
  }

  const isFullCancel = selectedParts.length === PART_OPTIONS.length;
  const cancelPartValue = isFullCancel ? "full" : [...selectedParts].sort().join(",");

  const submitCancellation = async () => {
    if (!selectedScheduleId || selectedParts.length === 0) {
      toast({ title: "Missing info", description: "Pick a class and at least one part to cancel.", variant: "destructive" });
      return;
    }
    const sched = schedules.find(s => s.id === selectedScheduleId);
    if (!sched) return;

    // Insert cancellation record
    const { error: cErr } = await supabase.from("schedule_cancellations").insert({
      schedule_id: selectedScheduleId,
      cancelled_part: cancelPartValue,
      reason: reason || null,
      cancelled_by: user?.id ?? null,
    });
    if (cErr) {
      toast({ title: "Error", description: cErr.message, variant: "destructive" });
      return;
    }

    // Flag bookings on this schedule
    const { data: bks } = await supabase
      .from("bookings")
      .select("id")
      .eq("schedule_id", selectedScheduleId);

    if (bks && bks.length > 0) {
      const ids = bks.map(b => b.id);
      const { error: uErr } = await supabase
        .from("bookings")
        .update({
          needs_reschedule: true,
          reschedule_part: cancelPartValue,
          reschedule_reason: reason || null,
          original_schedule_id: selectedScheduleId,
          original_schedule_date: sched.date,
          original_location_label: sched.location_label,
          original_course: sched.course,
        })
        .in("id", ids);
      if (uErr) {
        toast({ title: "Partial", description: `Cancellation logged but failed to flag students: ${uErr.message}`, variant: "destructive" });
        return;
      }
    }

    // For full cancellations, mark the schedule itself as cancelled so it
    // disappears from public/admin schedule lists and blocks new registrations.
    if (isFullCancel) {
      await supabase.from("schedules").update({
        cancelled_at: new Date().toISOString(),
        cancelled_by: user?.id ?? null,
        cancellation_reason: reason || null,
        spots_available: 0,
      }).eq("id", selectedScheduleId);
    }

    toast({ title: "Cancelled", description: `${partLabel(cancelPartValue)} on ${sched.date} cancelled. ${bks?.length ?? 0} student(s) flagged for rescheduling.` });
    setDialogOpen(false);
    setSelectedScheduleId("");
    setSelectedParts([]);
    setReason("");
    fetchAll();
  };

  const reassignStudent = async () => {
    if (!reassignDialog || !reassignTarget) return;
    const target = allSchedules.find(s => s.id === reassignTarget);
    if (!target) return;
    const { error } = await supabase
      .from("bookings")
      .update({
        schedule_id: reassignTarget,
        schedule_date: target.date,
        location: target.location,
        location_label: target.location_label,
        course: target.course,
        needs_reschedule: false,
        rescheduled_at: new Date().toISOString(),
        rescheduled_by: user?.id ?? null,
      })
      .eq("id", reassignDialog.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Rescheduled", description: `${reassignDialog.first_name} ${reassignDialog.last_name} moved to ${target.date}.` });
    setReassignDialog(null);
    setReassignTarget("");
    fetchAll();
  };

  const clearFlag = async (bookingId: string) => {
    const { error } = await supabase
      .from("bookings")
      .update({ needs_reschedule: false, rescheduled_at: new Date().toISOString(), rescheduled_by: user?.id ?? null })
      .eq("id", bookingId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Cleared", description: "Removed from rescheduling list." });
    fetchAll();
  };

  const undoCancellation = async (c: Cancellation) => {
    if (!confirm(`Undo cancellation of ${partLabel(c.cancelled_part)}? Students still flagged will need to be cleared individually.`)) return;
    const { error } = await supabase.from("schedule_cancellations").delete().eq("id", c.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Undone", description: "Cancellation removed." });
    fetchAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Bookings
          </Button>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-accent" /> Cancellations & Rescheduling
          </h2>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">
              <Ban className="w-4 h-4 mr-2" /> Cancel a Class / Part
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Class or Session</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Filter by location</Label>
                <Select value={cancelLocFilter} onValueChange={setCancelLocFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All locations</SelectItem>
                    {Array.from(new Set(schedules.map(s => s.location))).map(loc => {
                      const lbl = schedules.find(s => s.location === loc)?.location_label ?? loc;
                      return <SelectItem key={loc} value={loc}>{lbl}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Class</Label>
                <Select value={selectedScheduleId} onValueChange={setSelectedScheduleId}>
                  <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                  <SelectContent>
                    {schedules
                      .filter(s => cancelLocFilter === "all" || s.location === cancelLocFilter)
                      .map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.date} — {courseLabels[s.course] ?? s.course} — {s.location_label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>What to cancel (check all that apply)</Label>
                <div className="mt-2 space-y-2 rounded-md border border-border p-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={isFullCancel}
                      onCheckedChange={(v) =>
                        setSelectedParts(v ? PART_OPTIONS.map(o => o.value) : [])
                      }
                    />
                    <span className="font-medium">Full class (all parts)</span>
                  </label>
                  <div className="border-t border-border pt-2 space-y-2">
                    {PART_OPTIONS.map(o => (
                      <label key={o.value} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={selectedParts.includes(o.value)}
                          onCheckedChange={(v) =>
                            setSelectedParts(prev =>
                              v ? [...prev, o.value] : prev.filter(p => p !== o.value)
                            )
                          }
                        />
                        <span>{o.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <Label>Reason (optional)</Label>
                <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Weather, instructor unavailable, etc." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Close</Button>
              <Button variant="destructive" onClick={submitCancellation}>Confirm Cancellation</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active cancellations */}
      <section>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <CalendarClock className="w-5 h-5" /> Active Cancellations
        </h3>
        {cancellations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cancellations on record.</p>
        ) : (
          <div className="space-y-2">
            {cancellations.map(c => {
              const sched = schedules.find(s => s.id === c.schedule_id);
              return (
                <div key={c.id} className="bg-card border border-border rounded-lg p-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">
                      {partLabel(c.cancelled_part)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {sched ? `${sched.date} — ${courseLabels[sched.course] ?? sched.course} — ${sched.location_label}` : "Schedule no longer exists"}
                    </div>
                    {c.reason && <div className="text-sm mt-1 italic">"{c.reason}"</div>}
                    <div className="text-xs text-muted-foreground mt-1">
                      Cancelled {new Date(c.cancelled_at).toLocaleString()}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => undoCancellation(c)}>
                    <RotateCcw className="w-3 h-3 mr-1" /> Undo
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Students needing reschedule */}
      <section>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h3 className="text-lg font-semibold">
            Students Needing Rescheduling ({pendingBookings.filter(b => pendingLocFilter === "all" || b.location === pendingLocFilter).length})
          </h3>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Filter by location:</Label>
            <Select value={pendingLocFilter} onValueChange={setPendingLocFilter}>
              <SelectTrigger className="h-8 w-[220px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {Array.from(new Set(pendingBookings.map(b => b.location))).map(loc => {
                  const lbl = pendingBookings.find(b => b.location === loc)?.original_location_label ?? pendingBookings.find(b => b.location === loc)?.location_label ?? loc;
                  return <SelectItem key={loc} value={loc}>{lbl}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
        {pendingBookings.filter(b => pendingLocFilter === "all" || b.location === pendingLocFilter).length === 0 ? (
          <p className="text-sm text-muted-foreground">No students currently waiting to be rescheduled.</p>
        ) : (
          <div className="space-y-3">
            {pendingBookings.filter(b => pendingLocFilter === "all" || b.location === pendingLocFilter).map(b => (
              <div key={b.id} className="bg-card border border-accent/40 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="font-semibold text-base">{b.first_name} {b.last_name}</div>
                    <div className="text-sm text-muted-foreground">{b.email} • {b.phone}</div>
                    <div className="mt-2 text-sm space-y-0.5">
                      <div>
                        <span className="text-muted-foreground">Original class:</span>{" "}
                        <span className="font-medium">
                          {courseLabels[b.original_course ?? b.course] ?? (b.original_course ?? b.course)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Original date:</span>{" "}
                        <span className="font-medium">{b.original_schedule_date ?? b.schedule_date ?? "—"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Original location:</span>{" "}
                        <span className="font-medium">{b.original_location_label ?? b.location_label}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Needs to be rescheduled for:</span>{" "}
                        <span className="font-semibold text-accent">{partLabel(b.reschedule_part ?? "full")}</span>
                      </div>
                      {b.reschedule_reason && (
                        <div className="italic text-muted-foreground">Reason: {b.reschedule_reason}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 min-w-[180px]">
                    <Button size="sm" onClick={() => { setReassignDialog(b); setReassignTarget(""); setReassignLocFilter("all"); }}>
                      <CalendarClock className="w-3 h-3 mr-1" /> Assign New Class
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => clearFlag(b.id)}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Mark Resolved
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Reassign dialog */}
      <Dialog open={!!reassignDialog} onOpenChange={(o) => { if (!o) { setReassignDialog(null); setReassignTarget(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign to a New Class</DialogTitle>
          </DialogHeader>
          {reassignDialog && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Moving <span className="font-medium text-foreground">{reassignDialog.first_name} {reassignDialog.last_name}</span> to a new class. Their booking will be updated.
              </p>
              <div>
                <Label>Filter by location</Label>
                <Select value={reassignLocFilter} onValueChange={setReassignLocFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All locations</SelectItem>
                    {Array.from(new Set(allSchedules.map(s => s.location))).map(loc => {
                      const lbl = allSchedules.find(s => s.location === loc)?.location_label ?? loc;
                      return <SelectItem key={loc} value={loc}>{lbl}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>New class</Label>
                <Select value={reassignTarget} onValueChange={setReassignTarget}>
                  <SelectTrigger><SelectValue placeholder="Select replacement class" /></SelectTrigger>
                  <SelectContent>
                    {allSchedules
                      .filter(s => s.id !== reassignDialog.original_schedule_id)
                      .filter(s => reassignLocFilter === "all" || s.location === reassignLocFilter)
                      .map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.date} — {courseLabels[s.course] ?? s.course} — {s.location_label} ({s.spots_available} spots)
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReassignDialog(null); setReassignTarget(""); }}>Cancel</Button>
            <Button onClick={reassignStudent} disabled={!reassignTarget}>Confirm Reassignment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCancellations;

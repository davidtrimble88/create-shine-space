import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Banknote, CheckCircle2, Ban, Loader2, AlertTriangle, FileCheck2, FileX2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { formatPSTDate } from "@/lib/formatDate";
import { sendRegistrationConfirmation } from "@/lib/registrationEmail";

type Booking = Tables<"bookings">;
type Schedule = Tables<"schedules">;

interface Props {
  onBack: () => void;
}

const courseLabels: Record<string, string> = {
  basic: "Motorcyclist Training Course",
  intermediate: "Intermediate Course",
  advanced: "Advanced Riding Clinic",
};

const FORM_TYPES: { key: string; label: string }[] = [
  { key: "cmsp_waiver", label: "Waiver" },
  { key: "cmsp_registration_form", label: "Reg. Form" },
  { key: "cmsp_model_release", label: "Model Release" },
];

const parseFeeCents = (price: string | null | undefined): number => {
  if (!price) return 0;
  const n = Number(String(price).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

const PendingCashPayments = ({ onBack }: Props) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [rows, setRows] = useState<Booking[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [formsByEmail, setFormsByEmail] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);

  // Mark-paid dialog
  const [payTarget, setPayTarget] = useState<Booking | null>(null);
  const [payMethod, setPayMethod] = useState("cash");
  const [payNote, setPayNote] = useState("");
  const [newScheduleId, setNewScheduleId] = useState("");
  const [saving, setSaving] = useState(false);

  // Release dialog
  const [releaseTarget, setReleaseTarget] = useState<Booking | null>(null);
  const [releaseReason, setReleaseReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const [bookRes, schedRes] = await Promise.all([
      supabase
        .from("bookings")
        .select("*")
        .eq("pending_payment", true)
        .eq("archived", false)
        .order("created_at", { ascending: false }),
      supabase.from("schedules").select("*").gte("date", today).is("cancelled_at", null).order("date"),
    ]);
    const pending = bookRes.data ?? [];
    setRows(pending);
    setSchedules(schedRes.data ?? []);

    const emails = Array.from(new Set(pending.map(b => (b.email || "").toLowerCase()).filter(Boolean)));
    if (emails.length) {
      const { data: waivers } = await supabase
        .from("signed_waivers")
        .select("signer_email, document_type")
        .in("signer_email", emails);
      const map: Record<string, Set<string>> = {};
      for (const w of waivers ?? []) {
        const key = (w.signer_email || "").toLowerCase();
        if (!map[key]) map[key] = new Set();
        map[key].add(w.document_type.replace("_decline", ""));
      }
      setFormsByEmail(map);
    } else {
      setFormsByEmail({});
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const scheduleById = useMemo(
    () => Object.fromEntries(schedules.map(s => [s.id, s])) as Record<string, Schedule>,
    [schedules],
  );

  const targetSchedule = payTarget?.schedule_id ? scheduleById[payTarget.schedule_id] : undefined;
  const seatUnavailable = !!payTarget && (!targetSchedule || (targetSchedule.spots_available ?? 0) <= 0);

  const alternatives = useMemo(() => {
    if (!payTarget) return [];
    return schedules.filter(
      s => s.course === payTarget.course && (s.spots_available ?? 0) > 0 && s.id !== payTarget.schedule_id,
    );
  }, [payTarget, schedules]);

  const openPay = (b: Booking) => {
    setPayTarget(b);
    setPayMethod("cash");
    setPayNote("");
    setNewScheduleId("");
  };

  const confirmPaid = async () => {
    if (!payTarget) return;
    const moving = !!newScheduleId && newScheduleId !== payTarget.schedule_id;
    if (seatUnavailable && !moving) {
      toast({
        title: "That class is full",
        description: "Pick one of the available classes below to move this student into.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const dest = moving ? scheduleById[newScheduleId] : targetSchedule;

    const update: Partial<Booking> & Record<string, unknown> = {
      pending_payment: false,
      payment_status: "paid",
      booking_status: "confirmed",
      payment_provider: payMethod,
      marked_paid_at: new Date().toISOString(),
      marked_paid_by: user?.id ?? null,
      pending_payment_note: payNote.trim() || null,
    };

    if (moving && dest) {
      update.schedule_id = dest.id;
      update.schedule_date = dest.date;
      update.location = dest.location;
      update.location_label = dest.location_label;
      update.original_schedule_id = payTarget.schedule_id;
      update.original_schedule_date = payTarget.schedule_date;
      update.original_location_label = payTarget.location_label;
      update.original_course = payTarget.course;
      update.rescheduled_at = new Date().toISOString();
      update.rescheduled_by = user?.id ?? null;
    }

    const { error } = await supabase.from("bookings").update(update as never).eq("id", payTarget.id);
    if (error) {
      setSaving(false);
      toast({ title: "Could not mark as paid", description: error.message, variant: "destructive" });
      return;
    }

    // Send the standard registration confirmation now that they're truly booked.
    try {
      const guardianEmail = (payTarget.guardian_email || "").trim();
      await sendRegistrationConfirmation({
        email: payTarget.email,
        firstName: payTarget.first_name,
        lastName: payTarget.last_name,
        courseKey: payTarget.rider_track === "1dpc" ? "1dpc" : payTarget.course,
        courseLabel: courseLabels[payTarget.course] || payTarget.course,
        locationLabel: dest?.location_label || payTarget.location_label,
        location: dest?.location || payTarget.location,
        groupName: dest?.group_name ?? null,
        scheduleDate: dest?.date || payTarget.schedule_date,
        scheduleDetail: dest?.schedule ?? null,
        fee: payTarget.fee || dest?.price || "",
        additionalRecipients:
          guardianEmail && guardianEmail.toLowerCase() !== payTarget.email.toLowerCase() ? [guardianEmail] : [],
      });
    } catch (e) {
      console.warn("Confirmation email failed", e);
    }

    setSaving(false);
    setPayTarget(null);
    toast({
      title: "Payment recorded",
      description: moving
        ? "Student moved to the new class and added to that roster."
        : "Student is now confirmed on the roster.",
    });
    load();
  };

  const confirmRelease = async () => {
    if (!releaseTarget) return;
    if (!releaseReason.trim()) {
      toast({ title: "Add a reason", description: "A short comment is required.", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("bookings")
      .update({
        archived: true,
        archive_reason: `Cash hold released: ${releaseReason.trim()}`,
        archived_at: new Date().toISOString(),
        archived_by: user?.id ?? null,
      })
      .eq("id", releaseTarget.id);
    if (error) {
      toast({ title: "Could not release", description: error.message, variant: "destructive" });
      return;
    }
    setReleaseTarget(null);
    setReleaseReason("");
    toast({ title: "Hold released", description: "The registration was archived with your comment." });
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Banknote className="w-6 h-6 text-accent" /> Pending Payment (Cash)
          </h1>
        </div>
      </div>

      <div className="flex gap-3 items-start text-sm bg-muted/30 border border-border rounded-lg p-4 mb-4">
        <AlertTriangle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
        <p className="text-muted-foreground">
          These students chose to pay by cash. Their seat is <strong>not reserved</strong> and they do not appear on a
          roster until you mark them paid here. If their class filled up, you can move them into an open class at the
          same time — their confirmation email goes out with the new dates.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Student", "Course", "Class", "Amount", "Forms", "Registered", ""].map((h, i) => (
                  <th key={i} className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No cash holds waiting for payment</td></tr>
              ) : rows.map(b => {
                const sched = b.schedule_id ? scheduleById[b.schedule_id] : undefined;
                const signed = formsByEmail[(b.email || "").toLowerCase()] ?? new Set<string>();
                const full = !sched || (sched.spots_available ?? 0) <= 0;
                return (
                  <tr key={b.id} className="border-b border-border/50 hover:bg-secondary/30 align-top">
                    <td className="p-3">
                      <div className="font-medium text-foreground">{b.first_name} {b.last_name}</div>
                      <div className="text-xs text-muted-foreground">{b.email}</div>
                      <div className="text-xs text-muted-foreground">{b.phone}</div>
                    </td>
                    <td className="p-3 text-muted-foreground">{courseLabels[b.course] || b.course}</td>
                    <td className="p-3 text-muted-foreground">
                      <div>{b.location_label}</div>
                      <div className="text-xs">{b.schedule_date || "—"}</div>
                      {full && (
                        <span className="mt-1 inline-block text-xs font-medium px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                          Class full
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-foreground whitespace-nowrap">
                      {money(Math.max(parseFeeCents(b.fee) - (b.discount_amount_cents ?? 0), 0))}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {FORM_TYPES.map(f => {
                          const ok = signed.has(f.key);
                          return (
                            <span
                              key={f.key}
                              className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
                                ok ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {ok ? <FileCheck2 className="w-3 h-3" /> : <FileX2 className="w-3 h-3" />}
                              {f.label}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{b.created_at ? formatPSTDate(b.created_at) : "—"}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => openPay(b)}>
                          <CheckCircle2 className="w-4 h-4 mr-1" /> Mark Paid
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setReleaseTarget(b); setReleaseReason(""); }}>
                          <Ban className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mark paid */}
      <Dialog open={!!payTarget} onOpenChange={o => !o && setPayTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Record payment — {payTarget?.first_name} {payTarget?.last_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm">
              <div className="text-muted-foreground">{courseLabels[payTarget?.course ?? ""] || payTarget?.course}</div>
              <div className="text-foreground font-medium">
                {payTarget?.location_label} — {payTarget?.schedule_date || "no date"}
              </div>
              <div className="text-muted-foreground">
                Amount owed: {money(Math.max(parseFeeCents(payTarget?.fee) - (payTarget?.discount_amount_cents ?? 0), 0))}
              </div>
            </div>

            {seatUnavailable && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
                <p className="text-sm text-foreground/90">
                  Their original class no longer has an open seat. Choose an available class to move them into.
                </p>
                <div>
                  <Label>Available classes</Label>
                  <Select value={newScheduleId} onValueChange={setNewScheduleId}>
                    <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                    <SelectContent>
                      {alternatives.length === 0 ? (
                        <SelectItem value="none" disabled>No open classes for this course</SelectItem>
                      ) : alternatives.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.date} — {s.location_label}{s.group_name ? ` (${s.group_name})` : ""} · {s.spots_available} open
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {!seatUnavailable && alternatives.length > 0 && (
              <div>
                <Label>Move to a different class (optional)</Label>
                <Select value={newScheduleId} onValueChange={setNewScheduleId}>
                  <SelectTrigger><SelectValue placeholder="Keep their current class" /></SelectTrigger>
                  <SelectContent>
                    {alternatives.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.date} — {s.location_label}{s.group_name ? ` (${s.group_name})` : ""} · {s.spots_available} open
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Payment method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="money_order">Money order</SelectItem>
                  <SelectItem value="square">Card taken by office</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Note (optional)</Label>
              <Textarea value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="Receipt #, who took the payment, etc." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayTarget(null)} disabled={saving}>Cancel</Button>
            <Button onClick={confirmPaid} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Mark Paid &amp; Confirm Seat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Release hold */}
      <Dialog open={!!releaseTarget} onOpenChange={o => !o && setReleaseTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Release cash hold</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {releaseTarget?.first_name} {releaseTarget?.last_name} will be archived with your comment and removed from
              this list.
            </p>
            <div>
              <Label>Reason (required)</Label>
              <Input value={releaseReason} onChange={e => setReleaseReason(e.target.value)} placeholder="Never called, changed their mind, etc." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReleaseTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmRelease}>Release</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PendingCashPayments;

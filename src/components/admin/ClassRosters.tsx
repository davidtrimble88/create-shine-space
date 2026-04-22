import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Printer, Users, CalendarDays, MapPin, UserCheck, Pencil, Check, X, Plus, Trash2, History, ArrowLeft, Search, Smile, Frown, ClipboardList, RotateCcw, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { roleLabelMap } from "@/components/admin/InstructorAssignment";
import type { Tables } from "@/integrations/supabase/types";

type Schedule = Tables<"schedules">;
type Booking = Tables<"bookings"> & { result?: "pass" | "fail" | null; retest_type?: "skill" | "knowledge" | "none" | null };

type ViewMode = "active" | "evaluation_pending" | "past" | "pending_retests";

const RETEST_WINDOW_DAYS = 60;

const courseLabels: Record<string, string> = {
  basic: "Motorcycle Training Course",
  intermediate: "Intermediate Course",
  advanced: "Advanced Riding Clinic",
};

const locationLabels: Record<string, string> = {
  "high-desert-hesperia": "High Desert — Hesperia",
  "high-desert-wrightwood": "High Desert — Wrightwood",
  "ventura-county": "Ventura County — Somis",
};

interface FullAssignment {
  schedule_id: string;
  employee_id: string;
  assignment_role: string;
}

const daysBetween = (from: Date, to: Date) => {
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

const ClassRosters = () => {
  const { user, userRole } = useAuth();
  const canManageEvaluations = userRole === "owner" || userRole === "admin";
  const [view, setView] = useState<ViewMode>("active");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [locationFilter, setLocationFilter] = useState("");
  const [instructorFilter, setInstructorFilter] = useState("");
  const [myAssignedScheduleIds, setMyAssignedScheduleIds] = useState<Set<string>>(new Set());
  const [employees, setEmployees] = useState<{ id: string; full_name: string; user_id: string | null }[]>([]);
  const [allAssignments, setAllAssignments] = useState<FullAssignment[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [showRetestDialog, setShowRetestDialog] = useState(false);
  const [retestForm, setRetestForm] = useState({ first_name: "", last_name: "", phone: "", license_number: "", date_of_birth: "" });
  const [addingRetest, setAddingRetest] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Booking[]>([]);
  const [searching, setSearching] = useState(false);
  const [enrollmentCounts, setEnrollmentCounts] = useState<Record<string, number>>({});
  const [evalPendingCounts, setEvalPendingCounts] = useState<Record<string, number>>({});
  const [pastSchedules, setPastSchedules] = useState<Schedule[]>([]);
  const [pendingRetests, setPendingRetests] = useState<Booking[]>([]);
  const [evalPendingSchedules, setEvalPendingSchedules] = useState<Schedule[]>([]);
  // Fail-result dialog state
  const [failDialogBookingId, setFailDialogBookingId] = useState<string | null>(null);
  // Schedule-retest dialog state
  const [scheduleRetestFor, setScheduleRetestFor] = useState<Booking | null>(null);
  const [retestTargetScheduleId, setRetestTargetScheduleId] = useState<string>("");
  const [schedulingRetest, setSchedulingRetest] = useState(false);
  // Per-schedule retest counts: { [schedule_id]: { skill: n, knowledge: n } }
  const [retestCountsByClass, setRetestCountsByClass] = useState<Record<string, { skill: number; knowledge: number }>>({});
  const printRef = useRef<HTMLDivElement>(null);

  // Load schedules + employees + assignments based on view
  useEffect(() => {
    const fetchData = async () => {
      const today = new Date().toISOString().split("T")[0];

      // Honor cross-component request to open a specific roster
      const pending = sessionStorage.getItem("openRosterSchedule");
      let pendingId: string | null = null;
      let pendingDate: string | null = null;
      if (pending) {
        try {
          const parsed = JSON.parse(pending);
          pendingId = parsed.id ?? null;
          pendingDate = parsed.date ?? null;
          if (pendingDate) {
            const wantPast = pendingDate < today;
            if (wantPast && view !== "past" && view !== "evaluation_pending") { setView("past"); return; }
            if (!wantPast && view !== "active") { setView("active"); return; }
          }
        } catch { /* ignore */ }
      }

      if (!pendingId) setSelectedScheduleId("");

      const [empRes, assignRes] = await Promise.all([
        supabase.from("employees").select("id, full_name, user_id").eq("is_active", true),
        supabase.from("instructor_assignments").select("schedule_id, employee_id, assignment_role"),
      ]);
      if (empRes.data) setEmployees(empRes.data);
      if (assignRes.data) {
        setAllAssignments(assignRes.data);
        const myEmp = (empRes.data ?? []).find(e => e.user_id === user?.id);
        if (myEmp) {
          const myIds = new Set(assignRes.data.filter(a => a.employee_id === myEmp.id).map(a => a.schedule_id));
          setMyAssignedScheduleIds(myIds);
        }
      }

      // Active = upcoming/today
      const activeRes = await supabase
        .from("schedules")
        .select("*")
        .gte("date", today)
        .order("date");
      if (activeRes.data) setSchedules(activeRes.data);

      // Past schedules (date < today). Used for past + eval-pending views.
      const pastRes = await supabase
        .from("schedules")
        .select("*")
        .lt("date", today)
        .order("date", { ascending: false });
      const pastList = pastRes.data ?? [];
      setPastSchedules(pastList);

      // Build enrollment + eval-pending counts for ALL relevant schedules
      const allIds = [
        ...(activeRes.data ?? []).map(s => s.id),
        ...pastList.map(s => s.id),
      ];
      if (allIds.length > 0) {
        const { data: bookingRows } = await supabase
          .from("bookings")
          .select("schedule_id, result, is_retest")
          .in("schedule_id", allIds);
        const counts: Record<string, number> = {};
        const evalCounts: Record<string, number> = {};
        (bookingRows ?? []).forEach(b => {
          if (!b.schedule_id) return;
          counts[b.schedule_id] = (counts[b.schedule_id] || 0) + 1;
          if (!(b as any).result) {
            evalCounts[b.schedule_id] = (evalCounts[b.schedule_id] || 0) + 1;
          }
        });
        setEnrollmentCounts(counts);
        setEvalPendingCounts(evalCounts);

        // Eval-pending schedules = past schedules with at least one un-evaluated student
        setEvalPendingSchedules(pastList.filter(s => (evalCounts[s.id] || 0) > 0));
      } else {
        setEnrollmentCounts({});
        setEvalPendingCounts({});
        setEvalPendingSchedules([]);
      }

      // Pending retests = failed students with retest_type skill/knowledge
      const { data: retestRows } = await (supabase as any)
        .from("bookings")
        .select("*")
        .eq("result", "fail")
        .in("retest_type", ["skill", "knowledge"]);
      setPendingRetests((retestRows ?? []) as Booking[]);

      if (pendingId) {
        const inActive = (activeRes.data ?? []).some(s => s.id === pendingId);
        const inPast = pastList.some(s => s.id === pendingId);
        if (inActive || inPast) {
          setSelectedScheduleId(pendingId);
          sessionStorage.removeItem("openRosterSchedule");
        }
      }
    };
    fetchData();
  }, [user?.id, view]);

  useEffect(() => {
    if (!selectedScheduleId) {
      setBookings([]);
      return;
    }
    const fetchBookings = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("bookings")
        .select("*")
        .eq("schedule_id", selectedScheduleId)
        .order("last_name");
      if (data) setBookings(data as Booking[]);
      setLoading(false);
    };
    fetchBookings();
  }, [selectedScheduleId]);

  // When the Schedule Retest dialog opens, fetch retest counts for matching upcoming classes
  useEffect(() => {
    if (!scheduleRetestFor) return;
    const fetchCounts = async () => {
      const todayStr = new Date().toISOString().split("T")[0];
      const failedDate = new Date((scheduleRetestFor.schedule_date || "") + "T00:00:00");
      const deadlineDate = new Date(failedDate);
      deadlineDate.setDate(deadlineDate.getDate() + RETEST_WINDOW_DAYS);
      const deadlineStr = deadlineDate.toISOString().split("T")[0];
      const candidateIds = schedules
        .filter(s => s.course === scheduleRetestFor.course && s.date >= todayStr && s.date <= deadlineStr)
        .map(s => s.id);
      if (candidateIds.length === 0) {
        setRetestCountsByClass({});
        return;
      }
      const { data } = await (supabase as any)
        .from("bookings")
        .select("schedule_id, roster_comment")
        .in("schedule_id", candidateIds)
        .eq("is_retest", true);
      const counts: Record<string, { skill: number; knowledge: number }> = {};
      (data ?? []).forEach((row: { schedule_id: string | null; roster_comment: string | null }) => {
        if (!row.schedule_id) return;
        if (!counts[row.schedule_id]) counts[row.schedule_id] = { skill: 0, knowledge: 0 };
        const c = (row.roster_comment || "").toLowerCase();
        if (c.includes("knowledge")) counts[row.schedule_id].knowledge += 1;
        else counts[row.schedule_id].skill += 1; // default: treat unlabeled retests as skill
      });
      setRetestCountsByClass(counts);
    };
    fetchCounts();
  }, [scheduleRetestFor, schedules]);


  // Global student search across all bookings
  useEffect(() => {
    const term = studentSearch.trim();
    if (term.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      const like = `%${term}%`;
      const orFilter = [
        `first_name.ilike.${like}`,
        `last_name.ilike.${like}`,
        `email.ilike.${like}`,
        `phone.ilike.${like}`,
        `license_number.ilike.${like}`,
        `city.ilike.${like}`,
        `state.ilike.${like}`,
        `zip.ilike.${like}`,
        `address.ilike.${like}`,
      ].join(",");
      const { data } = await supabase
        .from("bookings")
        .select("*")
        .or(orFilter)
        .order("schedule_date", { ascending: false })
        .limit(50);
      setSearchResults((data ?? []) as Booking[]);
      setSearching(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [studentSearch]);

  const allKnownSchedules = [...schedules, ...pastSchedules];
  const selectedSchedule = allKnownSchedules.find(s => s.id === selectedScheduleId);

  const regularBookings = bookings.filter(b => !b.is_retest);
  const retestBookings = bookings.filter(b => b.is_retest);

  const selectedAssignments = allAssignments
    .filter(a => a.schedule_id === selectedScheduleId)
    .map(a => {
      const emp = employees.find(e => e.id === a.employee_id);
      return { name: emp?.full_name ?? "Unknown", role: roleLabelMap[a.assignment_role] ?? a.assignment_role };
    });

  // Pick which schedule list drives the current view
  const baseSchedules = view === "active"
    ? schedules
    : view === "past"
      ? pastSchedules
      : view === "evaluation_pending"
        ? evalPendingSchedules
        : [];

  const filteredSchedules = baseSchedules.filter(s => {
    if (locationFilter && locationFilter !== "all" && s.location !== locationFilter) return false;
    if (instructorFilter === "my-classes") {
      return myAssignedScheduleIds.has(s.id);
    }
    if (instructorFilter && instructorFilter !== "all") {
      const empAssignedIds = new Set(allAssignments.filter(a => a.employee_id === instructorFilter).map(a => a.schedule_id));
      return empAssignedIds.has(s.id);
    }
    return true;
  });

  const handleSaveComment = async (bookingId: string) => {
    const { error } = await supabase
      .from("bookings")
      .update({ roster_comment: commentDraft.trim() || null })
      .eq("id", bookingId);
    if (error) {
      toast.error("Failed to save comment");
      return;
    }
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, roster_comment: commentDraft.trim() || null } : b));
    setEditingCommentId(null);
    setCommentDraft("");
    toast.success("Comment saved");
  };

  const handleAddRetest = async () => {
    if (!selectedSchedule || !retestForm.first_name.trim() || !retestForm.last_name.trim() || !retestForm.phone.trim()) {
      toast.error("First name, last name, and phone are required");
      return;
    }
    setAddingRetest(true);
    const { data, error } = await supabase.from("bookings").insert({
      first_name: retestForm.first_name.trim(),
      last_name: retestForm.last_name.trim(),
      phone: retestForm.phone.trim(),
      license_number: retestForm.license_number.trim() || null,
      date_of_birth: retestForm.date_of_birth || null,
      email: "retest@placeholder.com",
      course: selectedSchedule.course,
      location: selectedSchedule.location,
      location_label: selectedSchedule.location_label,
      schedule_id: selectedSchedule.id,
      schedule_date: selectedSchedule.date,
      booking_status: "confirmed",
      payment_status: "paid",
      is_retest: true,
    }).select().single();

    if (error) {
      toast.error("Failed to add retest student");
    } else if (data) {
      setBookings(prev => [...prev, data as Booking]);
      setRetestForm({ first_name: "", last_name: "", phone: "", license_number: "", date_of_birth: "" });
      setShowRetestDialog(false);
      toast.success("Retest student added");
    }
    setAddingRetest(false);
  };

  const handleRemoveRetest = async (bookingId: string) => {
    const { error } = await supabase.from("bookings").delete().eq("id", bookingId).eq("is_retest", true);
    if (error) {
      toast.error("Failed to remove retest student");
      return;
    }
    setBookings(prev => prev.filter(b => b.id !== bookingId));
    toast.success("Retest student removed");
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Class Roster</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #111; font-size: 11px; }
            h1 { font-size: 18px; margin-bottom: 2px; text-align: center; }
            h2 { font-size: 14px; margin: 0; text-align: center; font-weight: normal; color: #555; }
            .header { margin-bottom: 12px; }
            .instructors { font-size: 11px; margin-bottom: 6px; }
            .instructors span { font-weight: 600; }
            .roster-table { width: 100%; border-collapse: collapse; font-size: 11px; }
            .roster-table th, .roster-table td { border: 1px solid #999; padding: 4px 6px; text-align: left; }
            .roster-table th { background: #e8e8e8; font-weight: 600; font-size: 10px; }
            .roster-table td.center { text-align: center; }
            .roster-table .check-col { width: 28px; text-align: center; }
            .roster-table .score-col { width: 50px; text-align: center; }
            .count { font-size: 11px; margin-bottom: 6px; font-weight: 600; }
            .section-title { font-size: 13px; font-weight: 700; margin: 16px 0 6px; }
            .office-tracking { margin-top: 16px; font-size: 11px; font-weight: 600; }
            .empty-rows td { height: 22px; }
            @media print { body { padding: 0; } @page { margin: 0.5in; size: landscape; } }
          </style>
        </head>
        <body>
          ${printRef.current.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  const emptyRosterRows = (count: number, startNum: number) => {
    const rows = [];
    for (let i = 0; i < count; i++) {
      rows.push(
        <tr key={`empty-${i}`} className="empty-rows">
          <td>{startNum + i}</td>
          <td></td><td></td><td></td><td></td>
          <td></td><td></td><td></td><td></td>
          <td></td><td></td><td></td>
        </tr>
      );
    }
    return rows;
  };

  const emptyRetestRows = (count: number, startNum: number) => {
    const rows = [];
    for (let i = 0; i < count; i++) {
      rows.push(
        <tr key={`retest-empty-${i}`} className="empty-rows">
          <td>{startNum + i}</td>
          <td></td><td></td><td></td><td></td><td></td>
          <td></td><td></td><td></td><td></td><td></td>
        </tr>
      );
    }
    return rows;
  };

  const handleSetResult = async (bookingId: string, next: "pass" | "fail" | null) => {
    // For 'fail' we open a dialog to capture retest eligibility
    if (next === "fail") {
      setFailDialogBookingId(bookingId);
      return;
    }
    const updates: any = { result: next };
    if (next === null) updates.retest_type = null;
    if (next === "pass") updates.retest_type = null;

    const { error } = await supabase
      .from("bookings")
      .update(updates)
      .eq("id", bookingId);
    if (error) {
      toast.error("Failed to update result");
      return;
    }
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, ...updates } : b));
    toast.success(next === null ? "Result cleared" : "Marked as Pass");
  };

  const handleSetFailWithRetest = async (retestType: "skill" | "knowledge" | "none") => {
    if (!failDialogBookingId) return;
    const updates: any = { result: "fail", retest_type: retestType };
    const { error } = await supabase
      .from("bookings")
      .update(updates)
      .eq("id", failDialogBookingId);
    if (error) {
      toast.error("Failed to update result");
      return;
    }
    setBookings(prev => prev.map(b => b.id === failDialogBookingId ? { ...b, ...updates } : b));
    setFailDialogBookingId(null);
    toast.success(
      retestType === "none"
        ? "Marked as Fail — Not eligible for retest"
        : `Marked as Fail — ${retestType === "skill" ? "Skill" : "Knowledge"} retest eligible`
    );
  };

  const renderResultCell = (b: Booking) => {
    const result = b.result as "pass" | "fail" | null | undefined;
    const retest = b.retest_type as string | null | undefined;
    return (
      <td className="p-3">
        <div className="flex items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => handleSetResult(b.id, result === "pass" ? null : "pass")}
            className={`p-1.5 rounded-full transition-colors ${
              result === "pass"
                ? "bg-green-500/20 text-green-500"
                : "text-muted-foreground hover:text-green-500 hover:bg-green-500/10"
            }`}
            title={result === "pass" ? "Click to clear" : "Mark as Pass"}
            aria-label="Mark as Pass"
          >
            <Smile className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleSetResult(b.id, result === "fail" ? null : "fail")}
            className={`p-1.5 rounded-full transition-colors ${
              result === "fail"
                ? "bg-destructive/20 text-destructive"
                : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            }`}
            title={result === "fail" ? "Click to clear" : "Mark as Fail"}
            aria-label="Mark as Fail"
          >
            <Frown className="w-4 h-4" />
          </button>
        </div>
        {result === "fail" && retest && (
          <div className="text-[10px] text-center mt-1 text-muted-foreground">
            {retest === "skill" ? "Skill retest" : retest === "knowledge" ? "Knowledge retest" : "Not eligible"}
          </div>
        )}
      </td>
    );
  };

  const renderCommentCell = (b: Booking) => (
    <td className="p-3">
      {editingCommentId === b.id ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={commentDraft}
            onChange={e => setCommentDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSaveComment(b.id); if (e.key === "Escape") setEditingCommentId(null); }}
            className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
          <button onClick={() => handleSaveComment(b.id)} className="text-primary hover:text-primary/80">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setEditingCommentId(null)} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div
          className="flex items-center gap-1 cursor-pointer group"
          onClick={() => { setEditingCommentId(b.id); setCommentDraft(b.roster_comment || ""); }}
        >
          <span className={b.roster_comment ? "text-foreground text-xs" : "text-muted-foreground text-xs italic"}>
            {b.roster_comment || "Add comment..."}
          </span>
          <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}
    </td>
  );

  const handleScheduleRetest = async () => {
    if (!scheduleRetestFor || !retestTargetScheduleId) {
      toast.error("Please choose a class");
      return;
    }
    const target = schedules.find(s => s.id === retestTargetScheduleId);
    if (!target) {
      toast.error("Selected class not found");
      return;
    }
    setSchedulingRetest(true);
    const src = scheduleRetestFor;
    const { data, error } = await supabase.from("bookings").insert({
      first_name: src.first_name,
      last_name: src.last_name,
      phone: src.phone,
      email: src.email && src.email !== "retest@placeholder.com" ? src.email : "retest@placeholder.com",
      license_number: src.license_number || null,
      date_of_birth: src.date_of_birth || null,
      course: target.course,
      location: target.location,
      location_label: target.location_label,
      schedule_id: target.id,
      schedule_date: target.date,
      booking_status: "confirmed",
      payment_status: "paid",
      is_retest: true,
      roster_comment: src.retest_type === "skill"
        ? "Skill retest"
        : "Knowledge retest",
    }).select().single();

    if (error || !data) {
      setSchedulingRetest(false);
      toast.error("Failed to schedule retest");
      return;
    }
    // Clear retest_type on the original failed booking so it leaves the Pending Retests list
    await (supabase as any)
      .from("bookings")
      .update({ retest_type: null })
      .eq("id", src.id);

    setSchedulingRetest(false);
    setPendingRetests(prev => prev.filter(b => b.id !== src.id));
    setScheduleRetestFor(null);
    setRetestTargetScheduleId("");
    toast.success(`Retest scheduled for ${target.date} at ${target.location_label}`);
  };

  // ========================
  // Pending Retests view
  // ========================
  const renderPendingRetests = () => {
    const today = new Date();
    // Auto-move expired (>60 days) — these stay only in Past Roster.
    const eligible = pendingRetests
      .filter(b => {
        if (!b.schedule_date) return false;
        const failed = new Date(b.schedule_date + "T00:00:00");
        const deadline = new Date(failed);
        deadline.setDate(deadline.getDate() + RETEST_WINDOW_DAYS);
        return deadline >= today;
      })
      .sort((a, b) => (a.schedule_date || "").localeCompare(b.schedule_date || ""));

    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <RotateCcw className="w-6 h-6" /> Pending Retests
          </h1>
          <Button variant="outline" onClick={() => setView("active")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Class Rosters
          </Button>
        </div>

        {eligible.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No students currently awaiting a retest within the 60-day window.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">Student</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Phone</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Original Class</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Retest Type</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Days Remaining</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {eligible.map(b => {
                  const failed = new Date((b.schedule_date || "") + "T00:00:00");
                  const deadline = new Date(failed);
                  deadline.setDate(deadline.getDate() + RETEST_WINDOW_DAYS);
                  const daysLeft = daysBetween(today, deadline);
                  const courseName = courseLabels[b.course] || b.course;
                  const urgent = daysLeft <= 14;
                  return (
                    <tr key={b.id} className="border-b border-border/50 hover:bg-secondary/30">
                      <td className="p-3">
                        <div className="font-semibold text-foreground uppercase">{b.first_name} {b.last_name}</div>
                        {b.license_number && <div className="text-xs text-muted-foreground">DL {b.license_number}</div>}
                      </td>
                      <td className="p-3 text-muted-foreground">{b.phone}</td>
                      <td className="p-3">
                        <div className="text-foreground">{courseName}</div>
                        <div className="text-xs text-muted-foreground">{b.schedule_date} • {b.location_label}</div>
                      </td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          b.retest_type === "skill" ? "bg-primary/20 text-primary" : "bg-amber-500/20 text-amber-500"
                        }`}>
                          {b.retest_type === "skill" ? "Skill" : "Knowledge"}
                        </span>
                      </td>
                      <td className={`p-3 text-center font-semibold ${urgent ? "text-destructive" : "text-foreground"}`}>
                        {daysLeft} {daysLeft === 1 ? "day" : "days"}
                        <div className="text-[10px] font-normal text-muted-foreground">deadline {deadline.toISOString().split("T")[0]}</div>
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setScheduleRetestFor(b); setRetestTargetScheduleId(""); }}
                        >
                          <CalendarDays className="w-3.5 h-3.5 mr-1.5" /> Schedule Retest
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Schedule Retest dialog */}
        <Dialog open={!!scheduleRetestFor} onOpenChange={open => { if (!open) { setScheduleRetestFor(null); setRetestTargetScheduleId(""); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule Retest</DialogTitle>
              <DialogDescription>
                {scheduleRetestFor && (
                  <>
                    Book <span className="font-semibold text-foreground">{scheduleRetestFor.first_name} {scheduleRetestFor.last_name}</span> into an upcoming{" "}
                    <span className="font-semibold text-foreground">
                      {courseLabels[scheduleRetestFor.course] || scheduleRetestFor.course}
                    </span>{" "}
                    class as a {scheduleRetestFor.retest_type === "skill" ? "Skill" : "Knowledge"} retest.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            {scheduleRetestFor && (() => {
              const src = scheduleRetestFor;
              const failedDate = new Date((src.schedule_date || "") + "T00:00:00");
              const deadlineDate = new Date(failedDate);
              deadlineDate.setDate(deadlineDate.getDate() + RETEST_WINDOW_DAYS);
              const todayStr = new Date().toISOString().split("T")[0];
              const deadlineStr = deadlineDate.toISOString().split("T")[0];
              const candidates = schedules
                .filter(s =>
                  s.course === src.course &&
                  s.date >= todayStr &&
                  s.date <= deadlineStr &&
                  s.spots_available > 0
                )
                .sort((a, b) => a.date.localeCompare(b.date));

              if (candidates.length === 0) {
                return (
                  <div className="bg-muted/50 border border-border rounded-md p-4 text-sm text-muted-foreground">
                    No upcoming {courseLabels[src.course] || src.course} classes with open spots are available before the {deadlineStr} deadline.
                  </div>
                );
              }
              return (
                <div className="space-y-3">
                  <label className="text-xs font-medium text-muted-foreground block">
                    Choose a class (must be on or before {deadlineStr})
                  </label>
                  <Select value={retestTargetScheduleId} onValueChange={setRetestTargetScheduleId}>
                    <SelectTrigger><SelectValue placeholder="Select an available class" /></SelectTrigger>
                    <SelectContent>
                      {candidates.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.date} • {s.location_label} • {s.spots_available} spot{s.spots_available !== 1 ? "s" : ""} open
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })()}
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setScheduleRetestFor(null); setRetestTargetScheduleId(""); }}>
                Cancel
              </Button>
              <Button
                onClick={handleScheduleRetest}
                disabled={!retestTargetScheduleId || schedulingRetest}
              >
                {schedulingRetest ? "Scheduling…" : "Schedule Retest"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  };


  // ========================
  // Render
  // ========================
  // Force-redirect non-privileged users away from restricted views
  useEffect(() => {
    if (!canManageEvaluations && view !== "active") {
      setView("active");
    }
  }, [canManageEvaluations, view]);

  if (view === "pending_retests" && canManageEvaluations) {
    return renderPendingRetests();
  }

  const viewTitle =
    view === "past" ? "Past Class Rosters" :
    view === "evaluation_pending" ? "Evaluation Pending" :
    "Class Rosters";

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">{viewTitle}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {view === "active" && canManageEvaluations && (
            <>
              <Button variant="outline" onClick={() => { setSelectedScheduleId(""); setView("evaluation_pending"); }}>
                <ClipboardList className="w-4 h-4 mr-2" /> Evaluation Pending
                {evalPendingSchedules.length > 0 && (
                  <span className="ml-2 bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded text-xs font-bold">
                    {evalPendingSchedules.length}
                  </span>
                )}
              </Button>
              <Button variant="outline" onClick={() => { setSelectedScheduleId(""); setView("pending_retests"); }}>
                <RotateCcw className="w-4 h-4 mr-2" /> Pending Retests
                {pendingRetests.length > 0 && (
                  <span className="ml-2 bg-primary/20 text-primary px-1.5 py-0.5 rounded text-xs font-bold">
                    {pendingRetests.length}
                  </span>
                )}
              </Button>
              <Button variant="outline" onClick={() => { setSelectedScheduleId(""); setView("past"); }}>
                <History className="w-4 h-4 mr-2" /> Past Rosters
              </Button>
            </>
          )}
          {view !== "active" && (
            <Button variant="outline" onClick={() => { setSelectedScheduleId(""); setView("active"); }}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Class Rosters
            </Button>
          )}
          {selectedSchedule && (
            <>
              {view === "active" && canManageEvaluations && (
                <Dialog open={showRetestDialog} onOpenChange={setShowRetestDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Plus className="w-4 h-4 mr-2" /> Add Retest Student
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Retest Student</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 mt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">First Name *</label>
                          <Input value={retestForm.first_name} onChange={e => setRetestForm(p => ({ ...p, first_name: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Last Name *</label>
                          <Input value={retestForm.last_name} onChange={e => setRetestForm(p => ({ ...p, last_name: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone *</label>
                        <Input value={retestForm.phone} onChange={e => setRetestForm(p => ({ ...p, phone: e.target.value }))} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">DL #</label>
                          <Input value={retestForm.license_number} onChange={e => setRetestForm(p => ({ ...p, license_number: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Date of Birth</label>
                          <Input type="date" value={retestForm.date_of_birth} onChange={e => setRetestForm(p => ({ ...p, date_of_birth: e.target.value }))} />
                        </div>
                      </div>
                      <Button onClick={handleAddRetest} disabled={addingRetest} className="w-full">
                        {addingRetest ? "Adding..." : "Add to Retest Roster"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              <Button onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" /> Print Roster
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Student Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={studentSearch}
            onChange={e => setStudentSearch(e.target.value)}
            placeholder="Search students by name, email, phone, DL #, city, ZIP…"
            className="pl-9 pr-9"
          />
          {studentSearch && (
            <button
              onClick={() => setStudentSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {studentSearch.trim().length >= 2 && (
          <div className="mt-2 bg-card border border-border rounded-lg overflow-hidden">
            {searching ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Searching…</p>
            ) : searchResults.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">No students found.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-border">
                {searchResults.map(b => {
                  const sched = allKnownSchedules.find(s => s.id === b.schedule_id);
                  const courseName = sched ? (courseLabels[sched.course] || sched.course) : (courseLabels[b.course] || b.course);
                  const dateStr = sched?.date || b.schedule_date || "Unscheduled";
                  const locLabel = sched?.location_label || b.location_label;
                  return (
                    <button
                      key={b.id}
                      onClick={() => {
                        if (b.schedule_id) {
                          const today = new Date().toISOString().split("T")[0];
                          const isPast = b.schedule_date && b.schedule_date < today;
                          if (isPast && view === "active") setView("past");
                          else if (!isPast && view !== "active") setView("active");
                          setTimeout(() => setSelectedScheduleId(b.schedule_id!), 50);
                          setStudentSearch("");
                        }
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-start justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-foreground">
                          {b.first_name} {b.last_name}
                          {b.is_retest && <span className="ml-2 text-xs text-primary">(Retest)</span>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {b.email !== "retest@placeholder.com" ? b.email : ""}{b.email !== "retest@placeholder.com" && b.phone ? " • " : ""}{b.phone}
                          {b.license_number ? ` • DL ${b.license_number}` : ""}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-medium text-foreground">{courseName}</div>
                        <div className="text-xs text-muted-foreground">{dateStr} • {locLabel}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Select value={locationFilter} onValueChange={v => { setLocationFilter(v); setSelectedScheduleId(""); }}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="All Locations" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {Object.entries(locationLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={instructorFilter} onValueChange={v => { setInstructorFilter(v); setSelectedScheduleId(""); }}>
          <SelectTrigger className="w-[240px]">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-muted-foreground" />
              <SelectValue placeholder="All Instructors" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Instructors</SelectItem>
            <SelectItem value="my-classes">My Assigned Classes</SelectItem>
            {employees.map(e => (
              <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedScheduleId && (
          <Button variant="outline" onClick={() => setSelectedScheduleId("")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to classes
          </Button>
        )}
      </div>

      {/* Class list — clickable */}
      {!selectedScheduleId && (
        <div className="mb-6">
          {filteredSchedules.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted-foreground">
              {view === "evaluation_pending"
                ? "No classes have students awaiting evaluation. Great work!"
                : `No ${view === "past" ? "past" : "upcoming"} classes match the current filters.`}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
              {filteredSchedules.map(s => {
                const assignedNames = allAssignments
                  .filter(a => a.schedule_id === s.id)
                  .map(a => employees.find(e => e.id === a.employee_id)?.full_name)
                  .filter(Boolean);
                const pending = evalPendingCounts[s.id] || 0;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedScheduleId(s.id)}
                    className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                        {courseLabels[s.course] || s.course}
                        {view === "evaluation_pending" && (
                          <span className="bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded text-xs font-bold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {pending} pending
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {s.date}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {s.location_label}</span>
                        {assignedNames.length > 0 && (
                          <span className="flex items-center gap-1"><UserCheck className="w-3 h-3" /> {assignedNames.join(", ")}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-foreground">
                        {enrollmentCounts[s.id] || 0} registered
                      </div>
                      <div className="text-xs text-muted-foreground">{s.spots_available} spots open</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Roster */}
      {loading && <p className="text-muted-foreground">Loading roster...</p>}

      {selectedSchedule && !loading && (
        <>
          {/* On-screen display */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-4 mb-1">
              <h2 className="text-lg font-bold text-foreground">
                {courseLabels[selectedSchedule.course] || selectedSchedule.course}
              </h2>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-2">
              <span className="flex items-center gap-1"><CalendarDays className="w-4 h-4" /> {selectedSchedule.date}</span>
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {selectedSchedule.location_label}</span>
              <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {regularBookings.length} student{regularBookings.length !== 1 ? "s" : ""} enrolled</span>
            </div>

            {selectedAssignments.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-4">
                {selectedAssignments.map((a, i) => (
                  <span key={i} className="text-xs bg-secondary px-2.5 py-1 rounded-full text-foreground">
                    <span className="font-semibold">{a.name}</span> — {a.role}
                  </span>
                ))}
              </div>
            )}

            {regularBookings.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center">No students enrolled in this class yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="text-left p-3 font-medium text-muted-foreground">#</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">First</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Last</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Phone</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">DL #</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">DOB</th>
                      <th className="text-center p-3 font-medium text-muted-foreground w-10">C1</th>
                      <th className="text-center p-3 font-medium text-muted-foreground w-10">R1</th>
                      <th className="text-center p-3 font-medium text-muted-foreground w-10">C2</th>
                      <th className="text-center p-3 font-medium text-muted-foreground w-10">R2</th>
                      <th className="text-left p-3 font-medium text-muted-foreground min-w-[180px]">Comments</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">KS</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">SS</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regularBookings.map((b, i) => (
                      <tr key={b.id} className="border-b border-border/50 hover:bg-secondary/30">
                        <td className="p-3 text-muted-foreground">{i + 1}</td>
                        <td className="p-3 font-medium text-foreground uppercase">{b.first_name}</td>
                        <td className="p-3 font-medium text-foreground uppercase">{b.last_name}</td>
                        <td className="p-3 text-muted-foreground">{b.phone}</td>
                        <td className="p-3 text-muted-foreground">{b.license_number || "—"}</td>
                        <td className="p-3 text-muted-foreground">{b.date_of_birth || "—"}</td>
                        <td className="p-3 text-center text-muted-foreground">☐</td>
                        <td className="p-3 text-center text-muted-foreground">☐</td>
                        <td className="p-3 text-center text-muted-foreground">☐</td>
                        <td className="p-3 text-center text-muted-foreground">☐</td>
                        {renderCommentCell(b)}
                        <td className="p-3 text-center text-muted-foreground">—</td>
                        <td className="p-3 text-center text-muted-foreground">—</td>
                        {renderResultCell(b)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Retest section on-screen */}
            <div className="mt-6 pt-4 border-t border-border">
              <h3 className="text-md font-bold text-foreground mb-3">RETESTS</h3>
              {retestBookings.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-3">No retest students added. Use the "Add Retest Student" button above.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/50">
                        <th className="text-left p-3 font-medium text-muted-foreground">#</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">First</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Last</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Phone</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">DL #</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">DOB</th>
                        <th className="text-left p-3 font-medium text-muted-foreground min-w-[180px]">Comments</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">KS</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">SS</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Result</th>
                        <th className="text-center p-3 font-medium text-muted-foreground w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {retestBookings.map((b, i) => (
                        <tr key={b.id} className="border-b border-border/50 hover:bg-secondary/30">
                          <td className="p-3 text-muted-foreground">{i + 1}</td>
                          <td className="p-3 font-medium text-foreground uppercase">{b.first_name}</td>
                          <td className="p-3 font-medium text-foreground uppercase">{b.last_name}</td>
                          <td className="p-3 text-muted-foreground">{b.phone}</td>
                          <td className="p-3 text-muted-foreground">{b.license_number || "—"}</td>
                          <td className="p-3 text-muted-foreground">{b.date_of_birth || "—"}</td>
                          {renderCommentCell(b)}
                          <td className="p-3 text-center text-muted-foreground">—</td>
                          <td className="p-3 text-center text-muted-foreground">—</td>
                          {renderResultCell(b)}
                          <td className="p-3 text-center">
                            <button onClick={() => handleRemoveRetest(b.id)} className="text-destructive hover:text-destructive/80">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Hidden printable roster */}
          <div className="hidden">
            <div ref={printRef}>
              <div className="header">
                <h1>CLASS ROSTER</h1>
                <h2>{selectedSchedule.location_label}</h2>
                <h2>{selectedSchedule.date} &nbsp;—&nbsp; {selectedSchedule.schedule}</h2>
              </div>

              {selectedAssignments.length > 0 && (
                <div className="instructors">
                  <span>Instructors: </span>
                  {selectedAssignments.map((a, i) => (
                    <span key={i}>{a.name} ({a.role}){i < selectedAssignments.length - 1 ? " / " : ""}</span>
                  ))}
                </div>
              )}

              <div className="count">{regularBookings.length} Student{regularBookings.length !== 1 ? "s" : ""} Enrolled</div>

              <table className="roster-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>First</th>
                    <th>Last</th>
                    <th>Phone No.</th>
                    <th>DL #</th>
                    <th>Birthdate</th>
                    <th className="check-col">C1</th>
                    <th className="check-col">R1</th>
                    <th className="check-col">C2</th>
                    <th className="check-col">R2</th>
                    <th>Comments</th>
                    <th className="score-col">KS Score</th>
                    <th className="score-col">SS Score</th>
                  </tr>
                </thead>
                <tbody>
                  {regularBookings.map((b, i) => (
                    <tr key={b.id}>
                      <td>{i + 1}</td>
                      <td style={{ textTransform: "uppercase" }}>{b.first_name}</td>
                      <td style={{ textTransform: "uppercase" }}>{b.last_name}</td>
                      <td>{b.phone}</td>
                      <td>{b.license_number || ""}</td>
                      <td>{b.date_of_birth || ""}</td>
                      <td className="center"></td>
                      <td className="center"></td>
                      <td className="center"></td>
                      <td className="center"></td>
                      <td>{b.roster_comment || ""}</td>
                      <td className="center"></td>
                      <td className="center"></td>
                    </tr>
                  ))}
                  {emptyRosterRows(Math.max(0, 12 - regularBookings.length), regularBookings.length + 1)}
                </tbody>
              </table>

              <div className="section-title">RETESTS</div>
              <table className="roster-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>First</th>
                    <th>Last</th>
                    <th>Phone No.</th>
                    <th>DL #</th>
                    <th>Birthdate</th>
                    <th>Retake Knowledge?</th>
                    <th>Retake Skills?</th>
                    <th>Comments</th>
                    <th className="score-col">KS Score</th>
                    <th className="score-col">SS Score</th>
                  </tr>
                </thead>
                <tbody>
                  {retestBookings.map((b, i) => (
                    <tr key={b.id}>
                      <td>{i + 1}</td>
                      <td style={{ textTransform: "uppercase" }}>{b.first_name}</td>
                      <td style={{ textTransform: "uppercase" }}>{b.last_name}</td>
                      <td>{b.phone}</td>
                      <td>{b.license_number || ""}</td>
                      <td>{b.date_of_birth || ""}</td>
                      <td className="center"></td>
                      <td className="center"></td>
                      <td>{b.roster_comment || ""}</td>
                      <td className="center"></td>
                      <td className="center"></td>
                    </tr>
                  ))}
                  {emptyRetestRows(Math.max(0, 5 - retestBookings.length), retestBookings.length + 1)}
                </tbody>
              </table>

              <div className="office-tracking">
                FOR OFFICE TRACKING: [ ] REMS &nbsp; [ ] DL389 LOG &nbsp; [ ] IRs &nbsp; [ ] C/O LOG
              </div>
            </div>
          </div>
        </>
      )}

      {!selectedScheduleId && !loading && view === "active" && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Select a class above to view its roster.</p>
        </div>
      )}

      {/* Fail-result dialog: pick retest eligibility */}
      <Dialog open={!!failDialogBookingId} onOpenChange={open => { if (!open) setFailDialogBookingId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Fail — Retest Eligibility</DialogTitle>
            <DialogDescription>
              Choose whether this student is eligible to retest within {RETEST_WINDOW_DAYS} days. Eligible students will appear in the Pending Retests list with a countdown.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 mt-2">
            <Button variant="outline" onClick={() => handleSetFailWithRetest("skill")} className="justify-start">
              <RotateCcw className="w-4 h-4 mr-2 text-primary" />
              Eligible — <span className="font-semibold ml-1">Skill Retest</span>
            </Button>
            <Button variant="outline" onClick={() => handleSetFailWithRetest("knowledge")} className="justify-start">
              <RotateCcw className="w-4 h-4 mr-2 text-amber-500" />
              Eligible — <span className="font-semibold ml-1">Knowledge Retest</span>
            </Button>
            <Button variant="outline" onClick={() => handleSetFailWithRetest("none")} className="justify-start">
              <X className="w-4 h-4 mr-2 text-destructive" />
              Not eligible for retest
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFailDialogBookingId(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClassRosters;

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Printer, Users, CalendarDays, MapPin, UserCheck, Pencil, Check, X, Plus, Trash2, History, ArrowLeft, Search, Smile, Frown, ClipboardList, RotateCcw, AlertCircle, Clock, FileCheck, FileText, UserX, UserMinus, Undo2, ShieldCheck, ShieldAlert } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { roleLabelMap } from "@/components/admin/InstructorAssignment";
import { WaiverStatusEditor } from "@/components/admin/WaiverStatusEditor";

import type { Tables } from "@/integrations/supabase/types";

type Schedule = Tables<"schedules">;
type Booking = Tables<"bookings"> & {
  result?: "pass" | "fail" | null;
  retest_type?: "skill" | "knowledge" | "both" | "none" | null;
  dl389_completed?: boolean;
  dl389_completed_at?: string | null;
  dl389_completed_by?: string | null;
  dropped?: boolean;
  dropped_reason?: string | null;
  dropped_at?: string | null;
  dropped_by?: string | null;
};

type ViewMode = "active" | "evaluation_pending" | "dl389" | "past" | "pending_retests";

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

const PART_OPTIONS = [
  { value: "c1", label: "C1 — Classroom 1" },
  { value: "r1", label: "R1 — Range 1" },
  { value: "c2", label: "C2 — Classroom 2" },
  { value: "r2", label: "R2 — Range 2" },
];

const partLabel = (p: string | null | undefined) => {
  if (!p) return "Full class";
  if (p === "full") return "Full class (all parts)";
  if (p.includes(",")) {
    return p.split(",").map(v => PART_OPTIONS.find(o => o.value === v)?.label ?? v.toUpperCase()).join(", ");
  }
  return PART_OPTIONS.find(o => o.value === p)?.label ?? p.toUpperCase();
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
  const { user, effectiveRole } = useAuth();
  const canManageEvaluations = effectiveRole === "owner" || effectiveRole === "admin";
  const [view, setView] = useState<ViewMode>("active");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [waiverIds, setWaiverIds] = useState<Set<string>>(new Set());
  const [waiverEmails, setWaiverEmails] = useState<Set<string>>(new Set());
  const [regFormEmails, setRegFormEmails] = useState<Set<string>>(new Set());
  const [modelReleaseByEmail, setModelReleaseByEmail] = useState<Map<string, "signed" | "declined">>(new Map());
  const [waiverEditFor, setWaiverEditFor] = useState<Booking | null>(null);
  const [savingWaiverStatus, setSavingWaiverStatus] = useState(false);
  const [editStudentFor, setEditStudentFor] = useState<Booking | null>(null);
  const [editStudentForm, setEditStudentForm] = useState({ first_name: "", last_name: "", preferred_name: "", email: "", phone: "", license_number: "", issuing_state: "", date_of_birth: "" });
  const [savingStudent, setSavingStudent] = useState(false);
  const canEditStudents = effectiveRole === "owner" || effectiveRole === "admin";

  const openEditStudent = (b: Booking) => {
    setEditStudentForm({
      first_name: b.first_name || "",
      last_name: b.last_name || "",
      preferred_name: (b as any).preferred_name || "",
      email: b.email || "",
      phone: b.phone || "",
      license_number: b.license_number || "",
      issuing_state: (b as any).issuing_state || "",
      date_of_birth: b.date_of_birth || "",
    });
    setEditStudentFor(b);
  };

  const handleSaveStudentEdit = async () => {
    if (!editStudentFor) return;
    if (!editStudentForm.first_name.trim() || !editStudentForm.last_name.trim()) {
      toast.error("First and last name are required");
      return;
    }
    setSavingStudent(true);
    const updates: any = {
      first_name: editStudentForm.first_name.trim(),
      last_name: editStudentForm.last_name.trim(),
      preferred_name: editStudentForm.preferred_name.trim() || null,
      email: editStudentForm.email.trim() || null,
      phone: editStudentForm.phone.trim() || null,
      license_number: editStudentForm.license_number.trim() || null,
      issuing_state: editStudentForm.issuing_state.trim() || null,
      date_of_birth: editStudentForm.date_of_birth || null,
    };
    const { error } = await supabase.from("bookings").update(updates).eq("id", editStudentFor.id);
    setSavingStudent(false);
    if (error) { toast.error("Could not save: " + error.message); return; }
    setBookings(prev => prev.map(b => b.id === editStudentFor.id ? { ...b, ...updates } as Booking : b));
    toast.success("Student info updated");
    setEditStudentFor(null);
  };

  const [loading, setLoading] = useState(false);
  const [locationFilter, setLocationFilter] = useState("");
  const [instructorFilter, setInstructorFilter] = useState("");
  const [myAssignedScheduleIds, setMyAssignedScheduleIds] = useState<Set<string>>(new Set());
  const [employees, setEmployees] = useState<{ id: string; full_name: string; user_id: string | null }[]>([]);
  const [allAssignments, setAllAssignments] = useState<FullAssignment[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [showRetestDialog, setShowRetestDialog] = useState(false);
  const [retestForm, setRetestForm] = useState({ first_name: "", last_name: "", phone: "", license_number: "", date_of_birth: "", comment: "" });
  const [addingRetest, setAddingRetest] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Booking[]>([]);
  const [searching, setSearching] = useState(false);
  const [enrollmentCounts, setEnrollmentCounts] = useState<Record<string, number>>({});
  const [retestCounts, setRetestCounts] = useState<Record<string, number>>({});
  const [evalPendingCounts, setEvalPendingCounts] = useState<Record<string, number>>({});
  const [pastSchedules, setPastSchedules] = useState<Schedule[]>([]);
  const [pendingRetests, setPendingRetests] = useState<Booking[]>([]);
  const [evalPendingSchedules, setEvalPendingSchedules] = useState<Schedule[]>([]);
  // Students from cancelled classes who were marked Resolved and still need evaluation.
  const [cancelledEvalBookings, setCancelledEvalBookings] = useState<Booking[]>([]);
  const [dl389Schedules, setDl389Schedules] = useState<Schedule[]>([]);
  const [dl389PendingCounts, setDl389PendingCounts] = useState<Record<string, number>>({});
  // Fail-result dialog state
  const [failDialogBookingId, setFailDialogBookingId] = useState<string | null>(null);
  // Schedule-retest dialog state
  const [scheduleRetestFor, setScheduleRetestFor] = useState<Booking | null>(null);
  const [retestTargetScheduleId, setRetestTargetScheduleId] = useState<string>("");
  const [schedulingRetest, setSchedulingRetest] = useState(false);
  // Per-schedule retest counts: { [schedule_id]: { skill: n, knowledge: n } }
  const [retestCountsByClass, setRetestCountsByClass] = useState<Record<string, { skill: number; knowledge: number }>>({});
  // DL389 view: list of passed students that still need their DL389 created
  const [dl389Students, setDl389Students] = useState<Booking[]>([]);
  const [dl389StudentSchedules, setDl389StudentSchedules] = useState<Record<string, Schedule>>({});
  const [dl389Detail, setDl389Detail] = useState<Booking | null>(null);
  const [savingDl389, setSavingDl389] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // No-Show / Drop dialog state
  const [noShowFor, setNoShowFor] = useState<Booking | null>(null);
  const [noShowParts, setNoShowParts] = useState<string[]>([]);
  const [noShowReason, setNoShowReason] = useState("");
  const [savingNoShow, setSavingNoShow] = useState(false);
  const [dropFor, setDropFor] = useState<Booking | null>(null);
  const [dropReason, setDropReason] = useState("");
  const [dropCanReschedule, setDropCanReschedule] = useState<"yes" | "no" | null>(null);
  const [savingDrop, setSavingDrop] = useState(false);


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
        .is("cancelled_at", null)
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
        const { data: bookingRows } = await (supabase as any)
          .from("bookings")
          .select("schedule_id, result, is_retest, dl389_completed")
          .in("schedule_id", allIds);
        const counts: Record<string, number> = {};
        const retestCountsLocal: Record<string, number> = {};
        const evalCounts: Record<string, number> = {};
        const dl389Counts: Record<string, number> = {};
        (bookingRows ?? []).forEach((b: { schedule_id: string | null; result: string | null; is_retest: boolean; dl389_completed: boolean }) => {
          if (!b.schedule_id) return;
          if (b.is_retest) {
            retestCountsLocal[b.schedule_id] = (retestCountsLocal[b.schedule_id] || 0) + 1;
          } else {
            counts[b.schedule_id] = (counts[b.schedule_id] || 0) + 1;
          }
          if (!b.result) {
            evalCounts[b.schedule_id] = (evalCounts[b.schedule_id] || 0) + 1;
          } else if (b.result === "pass" && !b.dl389_completed) {
            dl389Counts[b.schedule_id] = (dl389Counts[b.schedule_id] || 0) + 1;
          }
        });
        setEnrollmentCounts(counts);
        setRetestCounts(retestCountsLocal);
        setEvalPendingCounts(evalCounts);
        setDl389PendingCounts(dl389Counts);

        // Eval-pending schedules = past schedules with un-evaluated students,
        // EXCLUDING any schedule that has been cancelled (those students live
        // in their own synthetic "Cancelled Classes" bucket below).
        const liveEvalPending = pastList.filter(s =>
          (evalCounts[s.id] || 0) > 0 && !s.cancelled_at
        );

        // Pull bookings tied to ANY cancelled schedule (past or future) where
        // the student was marked resolved (needs_reschedule=false) but still
        // has no result. These deserve their own evaluation slot since the
        // original class is gone.
        const { data: cancelledSchedRows } = await supabase
          .from("schedules")
          .select("id")
          .not("cancelled_at", "is", null);
        const cancelledIds = (cancelledSchedRows ?? []).map(r => r.id);
        let cancelledEvalList: Booking[] = [];
        if (cancelledIds.length > 0) {
          const { data: cBks } = await (supabase as any)
            .from("bookings")
            .select("*")
            .in("schedule_id", cancelledIds)
            .is("result", null)
            .eq("needs_reschedule", false);
          cancelledEvalList = (cBks ?? []) as Booking[];
        }
        setCancelledEvalBookings(cancelledEvalList);

        // Build the final eval-pending list. If we have any cancelled-class
        // students, prepend a synthetic schedule entry so the bucket is
        // clickable from the same list UI.
        const finalEvalList: Schedule[] = [...liveEvalPending];
        if (cancelledEvalList.length > 0) {
          finalEvalList.unshift({
            id: "__cancelled_eval__",
            date: today,
            course: "basic",
            location: "cancelled",
            location_label: "Cancelled Classes — Resolved Students",
            group_name: "Needs Evaluation",
            schedule: "",
            spots_available: 0,
            price: "",
            cancelled_at: null,
            cancelled_by: null,
            cancellation_reason: null,
            created_at: today,
            updated_at: today,
            created_by: null,
          } as unknown as Schedule);
          // Surface the count in the per-card pending badge.
          evalCounts["__cancelled_eval__"] = cancelledEvalList.length;
          setEvalPendingCounts({ ...evalCounts });
        }
        setEvalPendingSchedules(finalEvalList);
        // DL389-pending schedules = past, fully evaluated, but at least one passed student still needs DL389
        setDl389Schedules(pastList.filter(s => (evalCounts[s.id] || 0) === 0 && (dl389Counts[s.id] || 0) > 0 && !s.cancelled_at));
      } else {
        setEnrollmentCounts({});
        setRetestCounts({});
        setEvalPendingCounts({});
        setEvalPendingSchedules([]);
        setCancelledEvalBookings([]);
        setDl389PendingCounts({});
        setDl389Schedules([]);
      }

      // Pending retests = failed students with retest_type skill/knowledge/both
      const { data: retestRows } = await (supabase as any)
        .from("bookings")
        .select("*")
        .eq("result", "fail")
        .in("retest_type", ["skill", "knowledge", "both"]);
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
    const interval = setInterval(fetchData, 300000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [user?.id, view]);

  useEffect(() => {
    if (!selectedScheduleId) {
      setBookings([]);
      return;
    }
    // Synthetic bucket: students from cancelled classes who were marked Resolved.
    if (selectedScheduleId === "__cancelled_eval__") {
      setBookings(cancelledEvalBookings);
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
      // Look up which of these bookings actually have a signed waiver on file
      const waiverIdList = (data ?? [])
        .map((b: any) => b.waiver_id)
        .filter((x: string | null): x is string => !!x);
      if (waiverIdList.length > 0) {
        const { data: w } = await (supabase as any)
          .from("signed_waivers")
          .select("id")
          .in("id", waiverIdList);
        setWaiverIds(new Set((w ?? []).map((row: { id: string }) => row.id)));
      } else {
        setWaiverIds(new Set());
      }
      // Look up registration form + model release + waiver-by-email for these students
      const emails = Array.from(new Set((data ?? []).map((b: any) => (b.email || "").toLowerCase()).filter(Boolean)));
      if (emails.length > 0) {
        const scheduleDate = schedules.find(s => s.id === selectedScheduleId)?.date || null;
        let extrasQuery = (supabase as any)
          .from("signed_waivers")
          .select("signer_email, document_type, schedule_id, schedule_date")
          .in("document_type", ["cmsp_waiver", "cmsp_registration_form", "cmsp_model_release", "cmsp_model_release_decline"]);

        extrasQuery = scheduleDate
          ? extrasQuery.or(`schedule_id.eq.${selectedScheduleId},schedule_date.eq.${scheduleDate}`)
          : extrasQuery.eq("schedule_id", selectedScheduleId);

        const { data: extras } = await extrasQuery;
        const regSet = new Set<string>();
        const wEmails = new Set<string>();
        const mrMap = new Map<string, "signed" | "declined">();
        const studentEmails = new Set(emails);
        (extras ?? []).forEach((r: any) => {
          const em = (r.signer_email || "").toLowerCase();
          if (!studentEmails.has(em)) return;
          const matchesClass = r.schedule_id === selectedScheduleId || (scheduleDate && r.schedule_date === scheduleDate);
          if (!matchesClass) return;
          if (r.document_type === "cmsp_waiver") wEmails.add(em);
          else if (r.document_type === "cmsp_registration_form") regSet.add(em);
          else if (r.document_type === "cmsp_model_release") mrMap.set(em, "signed");
          else if (r.document_type === "cmsp_model_release_decline" && !mrMap.has(em)) mrMap.set(em, "declined");
        });
        setWaiverEmails(wEmails);
        setRegFormEmails(regSet);
        setModelReleaseByEmail(mrMap);
      } else {
        setWaiverEmails(new Set());
        setRegFormEmails(new Set());
        setModelReleaseByEmail(new Map());
      }
      setLoading(false);
    };
    fetchBookings();
  }, [selectedScheduleId, cancelledEvalBookings, schedules]);

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
        const hasSkill = c.includes("skill");
        const hasKnowledge = c.includes("knowledge");
        if (hasSkill && hasKnowledge) {
          counts[row.schedule_id].skill += 1;
          counts[row.schedule_id].knowledge += 1;
        } else if (hasKnowledge) {
          counts[row.schedule_id].knowledge += 1;
        } else {
          counts[row.schedule_id].skill += 1; // default: treat unlabeled retests as skill
        }
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

  const allKnownSchedules = [...schedules, ...pastSchedules, ...evalPendingSchedules];
  const selectedSchedule = allKnownSchedules.find(s => s.id === selectedScheduleId);

  const nonRetestBookings = bookings.filter(b => !b.is_retest);
  const regularBookings = nonRetestBookings.filter(b => !b.dropped);
  const droppedBookings = nonRetestBookings.filter(b => b.dropped);
  const retestBookings = bookings.filter(b => b.is_retest);

  const DUTY_CODES_SET = new Set(["c1", "r1", "c2", "r2"]);
  const DUTY_ORDER = ["c1", "r1", "c2", "r2"];
  const selectedAssignments = (() => {
    const rows = allAssignments.filter(a => a.schedule_id === selectedScheduleId);
    const grouped = new Map<string, { name: string; role: string; duties: string[] }>();
    rows.forEach(a => {
      const emp = employees.find(e => e.id === a.employee_id);
      const name = emp?.full_name ?? "Unknown";
      let entry = grouped.get(a.employee_id);
      if (!entry) {
        entry = { name, role: "instructor_1", duties: [] };
        grouped.set(a.employee_id, entry);
      }
      if (DUTY_CODES_SET.has(a.assignment_role)) entry.duties.push(a.assignment_role);
      else entry.role = a.assignment_role;
    });
    return Array.from(grouped.values()).map(e => {
      const roleLabel = roleLabelMap[e.role] ?? e.role;
      const dutyLabels = DUTY_ORDER.filter(d => e.duties.includes(d)).map(d => (roleLabelMap[d] ?? d).toUpperCase());
      const role = dutyLabels.length > 0 ? `${roleLabel}: ${dutyLabels.join("/")}` : roleLabel;
      return { name: e.name, role };
    });
  })();

  // Pick which schedule list drives the current view.
  // Past Roster excludes schedules that still have DL389 work pending.
  const dl389PendingScheduleIds = new Set(dl389Schedules.map(s => s.id));
  const baseSchedules = view === "active"
    ? schedules.filter(s => !s.cancelled_at)
    : view === "past"
      ? pastSchedules.filter(s => !dl389PendingScheduleIds.has(s.id) && (evalPendingCounts[s.id] || 0) === 0)
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

  // Re-flag a cancelled-class student so they go back into the
  // "Needs Rescheduling" list (used when a Resolved click was a mistake).
  const handleRestoreToReschedule = async (booking: Booking) => {
    if (!confirm(`Move ${booking.first_name} ${booking.last_name} back to the Needs Rescheduling list?`)) return;
    const { error } = await supabase
      .from("bookings")
      .update({
        needs_reschedule: true,
        rescheduled_at: null,
        rescheduled_by: null,
      })
      .eq("id", booking.id);
    if (error) {
      toast.error("Failed to restore student");
      return;
    }
    setBookings(prev => prev.filter(b => b.id !== booking.id));
    setCancelledEvalBookings(prev => prev.filter(b => b.id !== booking.id));
    toast.success(`${booking.first_name} ${booking.last_name} moved back to Needs Rescheduling.`);
  };

  // Manually mark waivers / registration form / model release as signed in person.
  // Inserts sentinel rows into signed_waivers so the roster badges turn green.
  const handleSaveWaiverStatus = async (
    b: Booking,
    flags: { waiver: boolean; reg_form: boolean; model_release: "signed" | "declined" | "none" }
  ) => {
    const email = (b.email || "").toLowerCase().trim();
    if (!email) { toast.error("Student has no email on file"); return; }
    const sched = schedules.find(s => s.id === selectedScheduleId) || null;
    const sentinel = "(marked signed in person)";
    const baseRow = {
      document_version: "manual-in-person",
      document_text: sentinel,
      document_hash: sentinel,
      signer_first_name: b.first_name || "",
      signer_middle_name: (b as any).middle_name || null,
      signer_last_name: b.last_name || "",
      signer_email: email,
      signer_phone: b.phone || null,
      date_of_birth: b.date_of_birth || null,
      license_number: b.license_number || null,
      license_state: (b as any).issuing_state || null,
      signature_typed: sentinel,
      signature_drawn: sentinel,
      consent_acknowledgments: [{ manual_in_person: true, marked_at: new Date().toISOString() }],
      course: b.course || null,
      location: b.location || null,
      location_label: b.location_label || null,
      schedule_id: b.schedule_id || selectedScheduleId || null,
      schedule_date: b.schedule_date || sched?.date || null,
    };

    const inserts: any[] = [];
    if (flags.waiver && !(waiverEmails.has(email) || ((b as any).waiver_id && waiverIds.has((b as any).waiver_id)))) {
      inserts.push({ ...baseRow, document_type: "cmsp_waiver" });
    }
    if (flags.reg_form && !regFormEmails.has(email)) {
      inserts.push({ ...baseRow, document_type: "cmsp_registration_form" });
    }
    const currentMR = modelReleaseByEmail.get(email);
    if (flags.model_release === "signed" && currentMR !== "signed") {
      inserts.push({ ...baseRow, document_type: "cmsp_model_release" });
    } else if (flags.model_release === "declined" && currentMR !== "declined") {
      inserts.push({ ...baseRow, document_type: "cmsp_model_release_decline" });
    }

    if (inserts.length === 0) { setWaiverEditFor(null); return; }

    setSavingWaiverStatus(true);
    const { error } = await (supabase as any).from("signed_waivers").insert(inserts);
    setSavingWaiverStatus(false);
    if (error) { toast.error("Could not save: " + error.message); return; }

    // Update local sets so badges turn green immediately
    setWaiverEmails(prev => {
      const next = new Set(prev);
      if (flags.waiver) next.add(email);
      return next;
    });
    setRegFormEmails(prev => {
      const next = new Set(prev);
      if (flags.reg_form) next.add(email);
      return next;
    });
    setModelReleaseByEmail(prev => {
      const next = new Map(prev);
      if (flags.model_release === "signed") next.set(email, "signed");
      else if (flags.model_release === "declined") next.set(email, "declined");
      return next;
    });
    toast.success("Waiver status updated");
    setWaiverEditFor(null);
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
      roster_comment: retestForm.comment.trim() || null,
    }).select().single();

    if (error) {
      toast.error("Failed to add retest student");
    } else if (data) {
      setBookings(prev => [...prev, data as Booking]);
      setRetestForm({ first_name: "", last_name: "", phone: "", license_number: "", date_of_birth: "", comment: "" });
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

  // ===== No-Show: flag student to be rescheduled =====
  const openNoShow = (b: Booking) => {
    setNoShowFor(b);
    setNoShowParts([]);
    setNoShowReason("");
  };

  const submitNoShow = async () => {
    if (!noShowFor) return;
    if (noShowParts.length === 0) {
      toast.error("Pick at least one part the student missed");
      return;
    }
    setSavingNoShow(true);
    const isFull = noShowParts.length === PART_OPTIONS.length;
    const partValue = isFull ? "full" : [...noShowParts].sort().join(",");
    const sched = selectedSchedule;
    const { error } = await (supabase as any)
      .from("bookings")
      .update({
        needs_reschedule: true,
        reschedule_part: partValue,
        reschedule_reason: noShowReason.trim() ? `No-show: ${noShowReason.trim()}` : "No-show",
        original_schedule_id: sched?.id ?? noShowFor.schedule_id,
        original_schedule_date: sched?.date ?? noShowFor.schedule_date,
        original_location_label: sched?.location_label ?? noShowFor.location_label,
        original_course: sched?.course ?? noShowFor.course,
      })
      .eq("id", noShowFor.id);
    setSavingNoShow(false);
    if (error) {
      toast.error("Failed to mark as no-show");
      return;
    }
    setBookings(prev => prev.map(b => b.id === noShowFor.id ? { ...b, needs_reschedule: true, reschedule_part: partValue } : b));
    setNoShowFor(null);
    toast.success(`${noShowFor.first_name} ${noShowFor.last_name} flagged as no-show — moved to Needs Rescheduling.`);
  };

  // ===== Drop: remove from class with admin/owner-only reason =====
  const openDrop = (b: Booking) => {
    setDropFor(b);
    setDropReason(b.dropped_reason || "");
    setDropCanReschedule(null);
  };

  const submitDrop = async () => {
    if (!dropFor) return;
    if (!dropReason.trim()) {
      toast.error("A reason is required to drop a student");
      return;
    }
    if (dropCanReschedule === null) {
      toast.error("Please choose whether this student can be rescheduled");
      return;
    }
    setSavingDrop(true);
    const sched = selectedSchedule;
    const canReschedule = dropCanReschedule === "yes";
    const updates: Record<string, unknown> = {
      dropped: true,
      dropped_reason: dropReason.trim(),
      dropped_at: new Date().toISOString(),
      dropped_by: user?.id ?? null,
    };
    if (canReschedule) {
      // Send to Needs Rescheduling list (treated like a full-class reschedule)
      updates.needs_reschedule = true;
      updates.reschedule_part = "full";
      updates.reschedule_reason = `Dropped: ${dropReason.trim()}`;
      updates.original_schedule_id = sched?.id ?? dropFor.schedule_id;
      updates.original_schedule_date = sched?.date ?? dropFor.schedule_date;
      updates.original_location_label = sched?.location_label ?? dropFor.location_label;
      updates.original_course = sched?.course ?? dropFor.course;
    } else {
      updates.needs_reschedule = false;
    }
    const { error } = await (supabase as any)
      .from("bookings")
      .update(updates)
      .eq("id", dropFor.id);
    setSavingDrop(false);
    if (error) {
      toast.error("Failed to drop student");
      return;
    }
    setBookings(prev => prev.map(b => b.id === dropFor.id ? { ...b, ...updates } as Booking : b));
    const name = `${dropFor.first_name} ${dropFor.last_name}`;
    setDropFor(null);
    toast.success(canReschedule
      ? `${name} dropped and moved to Needs Rescheduling.`
      : `${name} dropped — recorded in past roster.`);
  };


  const handleUndropStudent = async (b: Booking) => {
    if (!confirm(`Restore ${b.first_name} ${b.last_name} to the active roster?`)) return;
    const { error } = await (supabase as any)
      .from("bookings")
      .update({
        dropped: false,
        dropped_reason: null,
        dropped_at: null,
        dropped_by: null,
      })
      .eq("id", b.id);
    if (error) {
      toast.error("Failed to restore student");
      return;
    }
    setBookings(prev => prev.map(x => x.id === b.id ? { ...x, dropped: false, dropped_reason: null } : x));
    toast.success("Student restored to roster");
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
            .roster-table .score-col { width: 28px; text-align: center; }
            .roster-table .id-verify-col { width: 90px; text-align: center; }
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
          <td></td><td></td>
          <td className="center"></td><td className="center"></td><td className="center"></td>
          <td></td><td></td><td className="center"></td><td></td>
          <td className="center"></td><td className="center"></td><td className="center"></td><td className="center"></td>
          <td></td>
          <td className="center"></td><td className="center"></td>
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
          <td></td><td></td><td></td><td></td><td></td><td></td>
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

  const handleSetFailWithRetest = async (retestType: "skill" | "knowledge" | "both" | "none") => {
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
    const label =
      retestType === "none" ? "Not eligible for retest" :
      retestType === "skill" ? "Skill retest eligible" :
      retestType === "knowledge" ? "Knowledge retest eligible" :
      "Skill & Knowledge retest eligible";
    toast.success(`Marked as Fail — ${label}`);
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
            {retest === "skill" ? "Skill retest"
              : retest === "knowledge" ? "Knowledge retest"
              : retest === "both" ? "Skill & Knowledge retest"
              : "Not eligible"}
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
        : src.retest_type === "both"
          ? "Skill & Knowledge retest"
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
  // DL389 view
  // ========================
  // Fetch all passed students still pending DL389 when the user opens DL389 view
  useEffect(() => {
    if (view !== "dl389" || !canManageEvaluations) return;
    const fetchDl389 = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await (supabase as any)
        .from("bookings")
        .select("*")
        .eq("result", "pass")
        .eq("dl389_completed", false)
        .lt("schedule_date", today)
        .order("schedule_date", { ascending: false });
      const list = (data ?? []) as Booking[];
      setDl389Students(list);
      // Build a quick lookup for the student's class info
      const ids = Array.from(new Set(list.map(b => b.schedule_id).filter(Boolean))) as string[];
      if (ids.length > 0) {
        const { data: scheds } = await supabase
          .from("schedules")
          .select("*")
          .in("id", ids);
        const map: Record<string, Schedule> = {};
        (scheds ?? []).forEach(s => { map[s.id] = s as Schedule; });
        setDl389StudentSchedules(map);
      } else {
        setDl389StudentSchedules({});
      }
    };
    fetchDl389();
  }, [view, canManageEvaluations]);

  const handleMarkDl389Created = async (booking: Booking, completed: boolean) => {
    setSavingDl389(true);
    const updates: any = {
      dl389_completed: completed,
      dl389_completed_at: completed ? new Date().toISOString() : null,
      dl389_completed_by: completed ? user?.id ?? null : null,
    };
    const { error } = await (supabase as any)
      .from("bookings")
      .update(updates)
      .eq("id", booking.id);
    setSavingDl389(false);
    if (error) {
      toast.error("Failed to update DL389 status");
      return;
    }
    if (completed) {
      // Remove from list — student moves to Past Roster
      setDl389Students(prev => prev.filter(b => b.id !== booking.id));
      // Update counts so Past Roster includes the schedule once empty
      if (booking.schedule_id) {
        setDl389PendingCounts(prev => {
          const next = { ...prev };
          const remaining = (next[booking.schedule_id!] || 1) - 1;
          if (remaining <= 0) {
            delete next[booking.schedule_id!];
            setDl389Schedules(prevS => prevS.filter(s => s.id !== booking.schedule_id));
          } else {
            next[booking.schedule_id!] = remaining;
          }
          return next;
        });
      }
      setDl389Detail(null);
      toast.success("DL389 marked as created — student moved to Past Roster");
    } else {
      toast.success("DL389 status cleared");
    }
  };

  const renderDL389 = () => {
    const grouped: Record<string, Booking[]> = {};
    dl389Students.forEach(b => {
      const key = b.schedule_id || "unknown";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(b);
    });
    const groupKeys = Object.keys(grouped).sort((a, b) => {
      const da = dl389StudentSchedules[a]?.date || "";
      const db = dl389StudentSchedules[b]?.date || "";
      return db.localeCompare(da);
    });

    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileCheck className="w-6 h-6" /> DL389
          </h1>
          <Button variant="outline" onClick={() => setView("active")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Class Rosters
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Passed students awaiting their DL389 form. Click a student to view their full info, then check the box to mark the DL389 as created — the student will move into the Past Roster.
        </p>

        {dl389Students.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <FileCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No students waiting on a DL389 right now.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupKeys.map(key => {
              const sched = dl389StudentSchedules[key];
              const courseName = sched ? (courseLabels[sched.course] || sched.course) : "Class";
              return (
                <div key={key} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-secondary/50 border-b border-border">
                    <div className="font-semibold text-foreground">{courseName}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {sched?.date} • {sched?.location_label}
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    {grouped[key].map(b => (
                      <button
                        key={b.id}
                        onClick={() => setDl389Detail(b)}
                        className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-center justify-between gap-4"
                      >
                        <div>
                          <div className="text-sm font-semibold text-foreground uppercase">
                            {b.first_name} {b.last_name}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {b.license_number ? `DL ${b.license_number}` : "No DL #"} • {b.phone}
                          </div>
                        </div>
                        <div className="text-xs text-primary flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" /> View & Mark
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Student detail dialog */}
        <Dialog open={!!dl389Detail} onOpenChange={open => { if (!open) setDl389Detail(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>DL389 — Student Info</DialogTitle>
              <DialogDescription>
                Review this student's information, then check the box to confirm the DL389 has been created.
              </DialogDescription>
            </DialogHeader>
            {dl389Detail && (() => {
              const b = dl389Detail;
              const sched = b.schedule_id ? dl389StudentSchedules[b.schedule_id] : undefined;
              const courseName = sched ? (courseLabels[sched.course] || sched.course) : (courseLabels[b.course] || b.course);
              const Field = ({ label, value }: { label: string; value: string | null | undefined }) => (
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
                  <div className="text-sm text-foreground mt-0.5">{value && value !== "retest@placeholder.com" ? value : "—"}</div>
                </div>
              );
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="First Name" value={b.first_name} />
                    <Field label="Last Name" value={b.last_name} />
                    <Field label="Phone" value={b.phone} />
                    <Field label="Email" value={b.email} />
                    <Field label="Date of Birth" value={b.date_of_birth} />
                    <Field label="Gender" value={b.gender} />
                    <Field label="DL #" value={b.license_number} />
                    <Field label="DL Expiration" value={b.license_expiration} />
                    <Field label="Issuing State" value={b.issuing_state} />
                    <Field label="Issuing Country" value={b.issuing_country} />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Address</div>
                    <div className="text-sm text-foreground mt-0.5">
                      {[b.address, b.city, b.state, b.zip].filter(Boolean).join(", ") || "—"}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
                    <Field label="Course" value={courseName} />
                    <Field label="Class Date" value={sched?.date || b.schedule_date} />
                    <Field label="Location" value={sched?.location_label || b.location_label} />
                    <Field label="Result" value="Pass" />
                  </div>
                  {b.roster_comment && (
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Roster Comment</div>
                      <div className="text-sm text-foreground mt-0.5">{b.roster_comment}</div>
                    </div>
                  )}
                  <div className="flex items-start gap-3 p-3 rounded-md border border-border bg-secondary/40">
                    <Checkbox
                      id={`dl389-${b.id}`}
                      checked={!!b.dl389_completed}
                      disabled={savingDl389}
                      onCheckedChange={checked => handleMarkDl389Created(b, checked === true)}
                      className="mt-0.5"
                    />
                    <label htmlFor={`dl389-${b.id}`} className="text-sm text-foreground cursor-pointer select-none">
                      <span className="font-semibold">DL389 has been created</span>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Checking this will move the student into the Past Roster.
                      </div>
                    </label>
                  </div>
                </div>
              );
            })()}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDl389Detail(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

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
          <div className="bg-card border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">

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
                          b.retest_type === "skill" ? "bg-primary/20 text-primary"
                            : b.retest_type === "both" ? "bg-accent/30 text-foreground"
                            : "bg-amber-500/20 text-amber-500"
                        }`}>
                          {b.retest_type === "skill" ? "Skill"
                            : b.retest_type === "both" ? "Skill & Knowledge"
                            : "Knowledge"}
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
                    class as a {scheduleRetestFor.retest_type === "skill" ? "Skill" : scheduleRetestFor.retest_type === "both" ? "Skill & Knowledge" : "Knowledge"} retest.
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
                      {candidates.map(s => {
                        const rc = retestCountsByClass[s.id] || { skill: 0, knowledge: 0 };
                        const totalRetests = rc.skill + rc.knowledge;
                        const retestSummary = totalRetests === 0
                          ? "no retests scheduled"
                          : `${totalRetests} retest${totalRetests !== 1 ? "s" : ""} (${rc.skill} skill, ${rc.knowledge} knowledge)`;
                        return (
                          <SelectItem key={s.id} value={s.id}>
                            {s.date} • {s.location_label} • {s.spots_available} spot{s.spots_available !== 1 ? "s" : ""} open • {retestSummary}
                          </SelectItem>
                        );
                      })}
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
  if (view === "dl389" && canManageEvaluations) {
    return renderDL389();
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
              <Button variant="outline" onClick={() => { setSelectedScheduleId(""); setView("dl389"); }}>
                <FileCheck className="w-4 h-4 mr-2" /> DL389
                {dl389Schedules.length > 0 && (
                  <span className="ml-2 bg-blue-500/20 text-blue-500 px-1.5 py-0.5 rounded text-xs font-bold">
                    {Object.values(dl389PendingCounts).reduce((a, b) => a + b, 0)}
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">DL #</label>
                          <Input value={retestForm.license_number} onChange={e => setRetestForm(p => ({ ...p, license_number: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Date of Birth</label>
                          <Input type="date" value={retestForm.date_of_birth} onChange={e => setRetestForm(p => ({ ...p, date_of_birth: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Instructor Notes (what are they retesting for?)</label>
                        <Textarea
                          value={retestForm.comment}
                          onChange={e => setRetestForm(p => ({ ...p, comment: e.target.value }))}
                          placeholder="e.g. Skill retest — dropped bike during eval"
                          className="min-h-[80px] text-sm"
                        />
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
                        {s.cancelled_at && (
                          <span className="bg-destructive/20 text-destructive px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wide">
                            Cancelled
                          </span>
                        )}
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
                      {(retestCounts[s.id] || 0) > 0 && (
                        <div className="text-xs text-primary font-medium">
                          {retestCounts[s.id]} retest{retestCounts[s.id] !== 1 ? "s" : ""}
                        </div>
                      )}
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

            {selectedScheduleId === "__cancelled_eval__" && regularBookings.length > 0 && (
              <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-foreground flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                <span>
                  These students were marked <strong>Resolved</strong> from a cancelled class.
                  Evaluate them here, or click <strong>Restore</strong> to send them back to the
                  Cancellations &rsaquo; Needs Rescheduling list.
                </span>
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
                      {canManageEvaluations && (
                        <th className="text-center p-3 font-medium text-muted-foreground">Result</th>
                      )}
                      {selectedScheduleId === "__cancelled_eval__" && canManageEvaluations && (
                        <th className="text-center p-3 font-medium text-muted-foreground">Action</th>
                      )}
                      {view === "active" && selectedScheduleId !== "__cancelled_eval__" && canManageEvaluations && (
                        <th className="text-center p-3 font-medium text-muted-foreground">Manage</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {regularBookings.map((b, i) => (
                      <tr key={b.id} className="border-b border-border/50 hover:bg-secondary/30">
                        <td className="p-3 text-muted-foreground">{i + 1}</td>
                        <td className="p-3 font-medium text-foreground uppercase">
                          {b.first_name}
                          {(b as any).preferred_name ? <span className="ml-1 text-muted-foreground normal-case">("{(b as any).preferred_name}")</span> : null}
                        </td>
                        <td className="p-3 font-medium text-foreground uppercase">
                          <div className="flex items-center gap-2">
                            <span>{b.last_name}</span>
                            {(((b as any).waiver_id && waiverIds.has((b as any).waiver_id)) || waiverEmails.has((b.email || "").toLowerCase())) ? (
                              <span title="Waiver signed" aria-label="Waiver signed" className="inline-flex items-center text-emerald-500">
                                <ShieldCheck className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <span title="Waiver not signed" aria-label="Waiver not signed" className="inline-flex items-center text-amber-500/80">
                                <ShieldAlert className="w-3.5 h-3.5" />
                              </span>
                            )}
                            {(() => {
                              const em = (b.email || "").toLowerCase();
                              const hasReg = regFormEmails.has(em);
                              return (
                                <span
                                  title={hasReg ? "Registration form signed" : "Registration form not signed"}
                                  className={`inline-flex items-center text-[10px] font-bold px-1 rounded ${hasReg ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"}`}
                                >
                                  REG {hasReg ? "✓" : "✗"}
                                </span>
                              );
                            })()}
                            {(() => {
                              const em = (b.email || "").toLowerCase();
                              const mr = modelReleaseByEmail.get(em);
                              const label = mr === "signed" ? "Model release: accepted" : mr === "declined" ? "Model release: declined" : "Model release: not completed";
                              const cls = mr === "signed" ? "bg-emerald-500/15 text-emerald-500" : mr === "declined" ? "bg-red-500/20 text-red-500 ring-1 ring-red-500/40" : "bg-muted text-muted-foreground";
                              const sym = mr === "signed" ? "✓" : mr === "declined" ? "✗" : "—";
                              return (
                                <span title={label} className={`inline-flex items-center text-[10px] font-bold px-1 rounded ${cls}`}>
                                  MR {sym}
                                </span>
                              );
                            })()}
                            <button
                              type="button"
                              onClick={() => setWaiverEditFor(b)}
                              title="Mark waivers signed in person"
                              className="ml-1 text-muted-foreground hover:text-foreground inline-flex items-center"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            {canEditStudents && (
                              <button
                                type="button"
                                onClick={() => openEditStudent(b)}
                                title="Edit student information"
                                className="ml-1 text-muted-foreground hover:text-accent inline-flex items-center"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
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
                        {canManageEvaluations && renderResultCell(b)}
                        {selectedScheduleId === "__cancelled_eval__" && canManageEvaluations && (
                          <td className="p-3 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRestoreToReschedule(b)}
                              title="Move back to Needs Rescheduling"
                            >
                              <RotateCcw className="w-3 h-3 mr-1" /> Restore
                            </Button>
                          </td>
                        )}
                        {view === "active" && selectedScheduleId !== "__cancelled_eval__" && canManageEvaluations && (
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openNoShow(b)}
                                title="Mark as No-Show (move to Needs Rescheduling)"
                                aria-label="Mark as No-Show"
                                className="p-1.5 rounded-full text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openDrop(b)}
                                title="Drop student from class (admin/owner only)"
                                aria-label="Drop student"
                                className="p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                <UserMinus className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Dropped students — admin/owner only */}
            {canManageEvaluations && droppedBookings.length > 0 && (
              <div className="mt-6 pt-4 border-t border-border">
                <h3 className="text-md font-bold text-foreground mb-3 flex items-center gap-2">
                  <UserMinus className="w-4 h-4 text-destructive" /> DROPPED STUDENTS
                  <span className="text-xs font-normal text-muted-foreground">(visible to admin & owner only)</span>
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/50">
                        <th className="text-left p-3 font-medium text-muted-foreground">Student</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Phone</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Reason</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Dropped</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {droppedBookings.map(b => (
                        <tr key={b.id} className="border-b border-border/50 hover:bg-secondary/30">
                          <td className="p-3 font-medium text-foreground uppercase">
                            {b.first_name} {b.last_name}
                          </td>
                          <td className="p-3 text-muted-foreground">{b.phone}</td>
                          <td className="p-3 text-foreground italic">{b.dropped_reason || "—"}</td>
                          <td className="p-3 text-muted-foreground text-xs">
                            {b.dropped_at ? new Date(b.dropped_at).toLocaleDateString() : "—"}
                          </td>
                          <td className="p-3 text-center">
                            <Button size="sm" variant="outline" onClick={() => handleUndropStudent(b)}>
                              <Undo2 className="w-3 h-3 mr-1" /> Restore
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                        {canManageEvaluations && (
                          <th className="text-center p-3 font-medium text-muted-foreground">Result</th>
                        )}
                        <th className="text-center p-3 font-medium text-muted-foreground w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {retestBookings.map((b, i) => (
                        <tr key={b.id} className="border-b border-border/50 hover:bg-secondary/30">
                          <td className="p-3 text-muted-foreground">{i + 1}</td>
                          <td className="p-3 font-medium text-foreground uppercase">
                            {b.first_name}
                            {(b as any).preferred_name ? <span className="ml-1 text-muted-foreground normal-case">("{(b as any).preferred_name}")</span> : null}
                          </td>
                          <td className="p-3 font-medium text-foreground uppercase">{b.last_name}</td>
                          <td className="p-3 text-muted-foreground">{b.phone}</td>
                          <td className="p-3 text-muted-foreground">{b.license_number || "—"}</td>
                          <td className="p-3 text-muted-foreground">{b.date_of_birth || "—"}</td>
                          {renderCommentCell(b)}
                          <td className="p-3 text-center text-muted-foreground">—</td>
                          <td className="p-3 text-center text-muted-foreground">—</td>
                          {canManageEvaluations && renderResultCell(b)}
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
                    <th className="check-col">Waiver</th>
                    <th className="check-col">Reg</th>
                    <th className="check-col">Model</th>
                    <th>Phone No.</th>
                    <th>DL #</th>
                    <th className="id-verify-col">ID Verification</th>
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
                      <td style={{ textTransform: "uppercase" }}>
                        {b.first_name}
                        {(b as any).preferred_name ? <span style={{ textTransform: "none", marginLeft: 4, fontWeight: 400 }}>("{(b as any).preferred_name}")</span> : null}
                      </td>
                      <td style={{ textTransform: "uppercase" }}>{b.last_name}</td>
                      <td className="center" style={{ fontWeight: 700 }}>
                        {(((b as any).waiver_id && waiverIds.has((b as any).waiver_id)) || waiverEmails.has((b.email || "").toLowerCase())) ? "✓" : "✗"}
                      </td>
                      <td className="center" style={{ fontWeight: 700 }}>
                        {regFormEmails.has((b.email || "").toLowerCase()) ? "✓" : "✗"}
                      </td>
                      <td className="center" style={{ fontWeight: 700 }}>
                        {(() => {
                          const mr = modelReleaseByEmail.get((b.email || "").toLowerCase());
                          return mr === "signed" ? "✓" : mr === "declined" ? "D" : "—";
                        })()}
                      </td>
                      <td>{b.phone}</td>
                      <td>{b.license_number || ""}</td>
                      <td className="center"></td>
                      <td>{b.date_of_birth || ""}</td>
                      <td className="center"></td>
                      <td className="center"></td>
                      <td className="center"></td>
                      <td className="center"></td>
                      <td></td>
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
                    <th className="id-verify-col">ID Verification</th>
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
                      <td className="center"></td>
                      <td>{b.date_of_birth || ""}</td>
                      <td className="center"></td>
                      <td className="center"></td>
                      <td></td>
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
            <Button variant="outline" onClick={() => handleSetFailWithRetest("both")} className="justify-start">
              <RotateCcw className="w-4 h-4 mr-2 text-foreground" />
              Eligible — <span className="font-semibold ml-1">Skill &amp; Knowledge Retest</span>
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

      {/* No-Show dialog */}
      <Dialog open={!!noShowFor} onOpenChange={open => { if (!open) setNoShowFor(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="w-5 h-5 text-amber-500" /> Mark as No-Show
            </DialogTitle>
            <DialogDescription>
              {noShowFor && (
                <>
                  Flag <span className="font-semibold text-foreground">{noShowFor.first_name} {noShowFor.last_name}</span> as a no-show
                  for one or more parts of this class. They'll be added to the <strong>Needs Rescheduling</strong> list.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">Which part(s) did they miss?</div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={noShowParts.length === PART_OPTIONS.length}
                    onCheckedChange={v => setNoShowParts(v ? PART_OPTIONS.map(o => o.value) : [])}
                  />
                  <span className="font-semibold">Entire class (all parts)</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-1">
                  {PART_OPTIONS.map(o => (
                    <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={noShowParts.includes(o.value)}
                        onCheckedChange={v => setNoShowParts(prev =>
                          v ? Array.from(new Set([...prev, o.value])) : prev.filter(p => p !== o.value)
                        )}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes (optional)</label>
              <Textarea
                value={noShowReason}
                onChange={e => setNoShowReason(e.target.value)}
                placeholder="Any additional context"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNoShowFor(null)}>Cancel</Button>
            <Button onClick={submitNoShow} disabled={savingNoShow || noShowParts.length === 0}>
              {savingNoShow ? "Saving…" : "Mark No-Show & Move to Reschedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drop dialog — admin/owner only */}
      <Dialog open={!!dropFor} onOpenChange={open => { if (!open) setDropFor(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserMinus className="w-5 h-5 text-destructive" /> Drop Student from Class
            </DialogTitle>
            <DialogDescription>
              {dropFor && (
                <>
                  Drop <span className="font-semibold text-foreground">{dropFor.first_name} {dropFor.last_name}</span> from this class.
                  A reason is required and will be saved to their record — visible only to admin and owner accounts.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Reason for dropping *</label>
              <Textarea
                value={dropReason}
                onChange={e => setDropReason(e.target.value)}
                placeholder="e.g. Unsafe riding behavior, refused to follow safety instructions, voluntarily withdrew, etc."
                rows={4}
                autoFocus
              />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">Can this student be rescheduled into another class? *</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDropCanReschedule("yes")}
                  className={`text-left p-3 rounded-md border transition-colors ${
                    dropCanReschedule === "yes"
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border hover:bg-secondary/40 text-muted-foreground"
                  }`}
                >
                  <div className="font-semibold text-sm flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5" /> Yes — reschedule
                  </div>
                  <div className="text-[11px] mt-0.5">Moves them to the Needs Rescheduling list.</div>
                </button>
                <button
                  type="button"
                  onClick={() => setDropCanReschedule("no")}
                  className={`text-left p-3 rounded-md border transition-colors ${
                    dropCanReschedule === "no"
                      ? "border-destructive bg-destructive/10 text-foreground"
                      : "border-border hover:bg-secondary/40 text-muted-foreground"
                  }`}
                >
                  <div className="font-semibold text-sm flex items-center gap-1.5">
                    <X className="w-3.5 h-3.5" /> No — final drop
                  </div>
                  <div className="text-[11px] mt-0.5">Goes to past roster, marked Dropped.</div>
                </button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground bg-secondary/40 border border-border rounded-md p-2">
              This note stays attached to the student's record and is only visible to admin and owner accounts.
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDropFor(null)}>Cancel</Button>
            <Button
              onClick={submitDrop}
              disabled={savingDrop || !dropReason.trim() || dropCanReschedule === null}
              variant="destructive"
            >
              {savingDrop ? "Dropping…" : dropCanReschedule === "yes" ? "Drop & Move to Reschedule" : "Drop Student"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WaiverStatusEditor
        booking={waiverEditFor}
        open={!!waiverEditFor}
        onOpenChange={(o) => { if (!o) setWaiverEditFor(null); }}
        currentWaiver={waiverEditFor ? (waiverEmails.has((waiverEditFor.email || "").toLowerCase()) || (((waiverEditFor as any).waiver_id) && waiverIds.has((waiverEditFor as any).waiver_id))) : false}
        currentReg={waiverEditFor ? regFormEmails.has((waiverEditFor.email || "").toLowerCase()) : false}
        currentMR={waiverEditFor ? (modelReleaseByEmail.get((waiverEditFor.email || "").toLowerCase()) || "none") : "none"}
        saving={savingWaiverStatus}
        onSave={(flags) => waiverEditFor && handleSaveWaiverStatus(waiverEditFor, flags)}
      />
    </div>
  );
};

export default ClassRosters;

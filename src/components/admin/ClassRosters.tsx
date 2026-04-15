import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Printer, Users, CalendarDays, MapPin, UserCheck, Pencil, Check, X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { roleLabelMap } from "@/components/admin/InstructorAssignment";
import type { Tables } from "@/integrations/supabase/types";

type Schedule = Tables<"schedules">;
type Booking = Tables<"bookings">;

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

const ClassRosters = () => {
  const { user } = useAuth();
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
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      const today = new Date().toISOString().split("T")[0];
      const [schedRes, empRes, assignRes] = await Promise.all([
        supabase.from("schedules").select("*").gte("date", today).order("date"),
        supabase.from("employees").select("id, full_name, user_id").eq("is_active", true),
        supabase.from("instructor_assignments").select("schedule_id, employee_id, assignment_role"),
      ]);
      if (schedRes.data) setSchedules(schedRes.data);
      if (empRes.data) setEmployees(empRes.data);
      if (assignRes.data) {
        setAllAssignments(assignRes.data);
        const myEmp = (empRes.data ?? []).find(e => e.user_id === user?.id);
        if (myEmp) {
          const myIds = new Set(assignRes.data.filter(a => a.employee_id === myEmp.id).map(a => a.schedule_id));
          setMyAssignedScheduleIds(myIds);
        }
      }
    };
    fetchData();
  }, [user?.id]);

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
      if (data) setBookings(data);
      setLoading(false);
    };
    fetchBookings();
  }, [selectedScheduleId]);

  const selectedSchedule = schedules.find(s => s.id === selectedScheduleId);

  const regularBookings = bookings.filter(b => !b.is_retest);
  const retestBookings = bookings.filter(b => b.is_retest);

  const selectedAssignments = allAssignments
    .filter(a => a.schedule_id === selectedScheduleId)
    .map(a => {
      const emp = employees.find(e => e.id === a.employee_id);
      return { name: emp?.full_name ?? "Unknown", role: roleLabelMap[a.assignment_role] ?? a.assignment_role };
    });

  const filteredSchedules = schedules.filter(s => {
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
      setBookings(prev => [...prev, data]);
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Class Rosters</h1>
        <div className="flex items-center gap-2">
          {selectedSchedule && (
            <>
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
              <Button onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" /> Print Roster
              </Button>
            </>
          )}
        </div>
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
        <Select value={selectedScheduleId} onValueChange={setSelectedScheduleId}>
          <SelectTrigger className="w-[400px]"><SelectValue placeholder="Select a class to view roster" /></SelectTrigger>
          <SelectContent>
            {filteredSchedules.map(s => (
              <SelectItem key={s.id} value={s.id}>
                {s.date} — {courseLabels[s.course] || s.course} — {s.location_label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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

      {!selectedScheduleId && !loading && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Select a class above to view its roster.</p>
        </div>
      )}
    </div>
  );
};

export default ClassRosters;

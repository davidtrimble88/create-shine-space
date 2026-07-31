import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { UserMinus, UserCheck, CalendarDays, AlertTriangle, History, ShieldAlert } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  instructor_1: "Instructor 1",
  instructor_2: "Instructor 2",
  range_assistant: "Range Assistant",
  instructor_candidate: "Instructor Candidate",
  c1: "C1",
  r1: "R1",
  c2: "C2",
  r2: "R2",
};

interface Employee { id: string; full_name: string; user_id: string | null; }
interface Schedule { id: string; date: string; course: string; location_label: string | null; group_name: string | null; schedule: string | null; }
interface Assignment { id: string; schedule_id: string; employee_id: string; assignment_role: string; }
interface SubRequest {
  id: string;
  schedule_id: string;
  requester_employee_id: string;
  reason: string;
  roles: string[];
  status: string;
  covering_employee_id: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  is_manual: boolean;
  created_at: string;
}

const fmtDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });

const SubCoverage = () => {
  const { user, effectiveRole } = useAuth();
  const { toast } = useToast();
  const canManage = effectiveRole === "owner" || effectiveRole === "admin";

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [requests, setRequests] = useState<SubRequest[]>([]);
  const [myEmployeeId, setMyEmployeeId] = useState<string | null>(null);

  // request dialog (instructor self-serve)
  const [reqOpen, setReqOpen] = useState(false);
  const [reqScheduleId, setReqScheduleId] = useState<string>("");
  const [reqRoles, setReqRoles] = useState<string[]>([]);
  const [reqFull, setReqFull] = useState(true);
  const [reqReason, setReqReason] = useState("");

  // fill dialog
  const [fillTarget, setFillTarget] = useState<SubRequest | null>(null);
  const [fillEmployee, setFillEmployee] = useState("");
  const [fillNote, setFillNote] = useState("");

  // manual sub dialog (office-entered)
  const [manualOpen, setManualOpen] = useState(false);
  const [mSchedule, setMSchedule] = useState("");
  const [mOut, setMOut] = useState("");
  const [mIn, setMIn] = useState("");
  const [mFull, setMFull] = useState(true);
  const [mRoles, setMRoles] = useState<string[]>([]);
  const [mReason, setMReason] = useState("");

  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const [empRes, schedRes, assignRes, reqRes] = await Promise.all([
      supabase.from("employees").select("id, full_name, user_id").eq("is_active", true).order("full_name"),
      supabase.from("schedules").select("id, date, course, location_label, group_name, schedule").gte("date", today).is("cancelled_at", null).order("date"),
      supabase.from("instructor_assignments").select("id, schedule_id, employee_id, assignment_role"),
      supabase.from("sub_requests").select("*").order("created_at", { ascending: false }),
    ]);
    setEmployees((empRes.data as Employee[]) || []);
    setSchedules((schedRes.data as Schedule[]) || []);
    setAssignments((assignRes.data as Assignment[]) || []);
    setRequests((reqRes.data as SubRequest[]) || []);
    if (user) {
      const mine = (empRes.data as Employee[] | null)?.find(e => e.user_id === user.id);
      setMyEmployeeId(mine?.id ?? null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const empName = (id: string | null) => employees.find(e => e.id === id)?.full_name ?? "—";
  const schedById = useMemo(() => new Map(schedules.map(s => [s.id, s])), [schedules]);
  const schedLabel = (id: string) => {
    const s = schedById.get(id);
    if (!s) return "Class (past or removed)";
    return `${fmtDate(s.date)} — ${s.location_label ?? ""}${s.group_name ? ` (${s.group_name})` : ""}`;
  };

  const myClasses = useMemo(() => {
    if (!myEmployeeId) return [] as { schedule: Schedule; roles: string[] }[];
    const map = new Map<string, string[]>();
    assignments.filter(a => a.employee_id === myEmployeeId).forEach(a => {
      if (!schedById.has(a.schedule_id)) return;
      const arr = map.get(a.schedule_id) ?? [];
      if (!arr.includes(a.assignment_role)) arr.push(a.assignment_role);
      map.set(a.schedule_id, arr);
    });
    return Array.from(map.entries())
      .map(([sid, roles]) => ({ schedule: schedById.get(sid)!, roles }))
      .sort((a, b) => a.schedule.date.localeCompare(b.schedule.date));
  }, [assignments, myEmployeeId, schedById]);

  const rolesFor = (scheduleId: string, employeeId: string) =>
    Array.from(new Set(assignments.filter(a => a.schedule_id === scheduleId && a.employee_id === employeeId).map(a => a.assignment_role)));

  const instructorsOn = (scheduleId: string) =>
    Array.from(new Set(assignments.filter(a => a.schedule_id === scheduleId).map(a => a.employee_id)));

  const openRequests = requests.filter(r => r.status === "open");
  const historyRequests = requests.filter(r => r.status !== "open");

  const visibleOpen = canManage ? openRequests : openRequests.filter(r => r.requester_employee_id === myEmployeeId);

  /* ---------- create request ---------- */
  const submitRequest = async () => {
    if (!myEmployeeId || !reqScheduleId || !reqReason.trim()) {
      toast({ title: "Missing info", description: "Pick a class and give a reason.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("sub_requests").insert({
      schedule_id: reqScheduleId,
      requester_employee_id: myEmployeeId,
      created_by: user?.id ?? null,
      reason: reqReason.trim(),
      roles: reqFull ? [] : reqRoles,
      status: "open",
    });
    setSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Sub requested", description: "The office has been notified." });
    setReqOpen(false); setReqReason(""); setReqRoles([]); setReqFull(true); setReqScheduleId("");
    load();
  };

  const cancelRequest = async (r: SubRequest) => {
    const { error } = await supabase.from("sub_requests").update({ status: "cancelled", resolved_by: user?.id ?? null, resolved_at: new Date().toISOString() }).eq("id", r.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Request cancelled" });
    load();
  };

  /* ---------- swap assignments ---------- */
  const swapAssignments = async (scheduleId: string, outId: string, inId: string, roles: string[]) => {
    let q = supabase.from("instructor_assignments").update({ employee_id: inId }).eq("schedule_id", scheduleId).eq("employee_id", outId);
    if (roles.length > 0) q = q.in("assignment_role", roles);
    return q;
  };

  const confirmFill = async () => {
    if (!fillTarget || !fillEmployee) return;
    setSaving(true);
    const { error: swapErr } = await swapAssignments(fillTarget.schedule_id, fillTarget.requester_employee_id, fillEmployee, fillTarget.roles);
    if (swapErr) { setSaving(false); toast({ title: "Error", description: swapErr.message, variant: "destructive" }); return; }
    const { error } = await supabase.from("sub_requests").update({
      status: "filled",
      covering_employee_id: fillEmployee,
      resolution_note: fillNote.trim() || null,
      resolved_by: user?.id ?? null,
      resolved_at: new Date().toISOString(),
    }).eq("id", fillTarget.id);
    setSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Sub assigned", description: `${empName(fillEmployee)} is now on the class.` });
    setFillTarget(null); setFillEmployee(""); setFillNote("");
    load();
  };

  /* ---------- manual sub (office enters on behalf of instructor) ---------- */
  const submitManual = async () => {
    if (!mSchedule || !mOut || !mIn || !mReason.trim()) {
      toast({ title: "Missing info", description: "Pick the class, who is out, who is covering, and a reason.", variant: "destructive" });
      return;
    }
    if (mOut === mIn) { toast({ title: "Invalid", description: "Pick a different covering instructor.", variant: "destructive" }); return; }
    setSaving(true);
    const roles = mFull ? [] : mRoles;
    const { error: swapErr } = await swapAssignments(mSchedule, mOut, mIn, roles);
    if (swapErr) { setSaving(false); toast({ title: "Error", description: swapErr.message, variant: "destructive" }); return; }
    const { error } = await supabase.from("sub_requests").insert({
      schedule_id: mSchedule,
      requester_employee_id: mOut,
      created_by: user?.id ?? null,
      reason: mReason.trim(),
      roles,
      status: "filled",
      covering_employee_id: mIn,
      is_manual: true,
      resolved_by: user?.id ?? null,
      resolved_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Sub logged", description: `${empName(mIn)} is covering for ${empName(mOut)}.` });
    setManualOpen(false); setMSchedule(""); setMOut(""); setMIn(""); setMRoles([]); setMFull(true); setMReason("");
    load();
  };

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) =>
    setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);

  const roleBadges = (roles: string[]) =>
    roles.length === 0
      ? <Badge variant="secondary">Whole class</Badge>
      : roles.map(r => <Badge key={r} variant="secondary">{ROLE_LABELS[r] ?? r}</Badge>);

  if (loading) return <div className="p-6 text-muted-foreground">Loading sub coverage…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><UserMinus className="w-6 h-6" /> Sub Coverage</h2>
          <p className="text-sm text-muted-foreground">Request a substitute for a class you can't teach, or let the office log one for you.</p>
        </div>
        {canManage && (
          <Button onClick={() => setManualOpen(true)} variant="secondary">
            <ShieldAlert className="w-4 h-4 mr-2" /> Log sub manually
          </Button>
        )}
      </div>

      {/* My upcoming classes */}
      {myEmployeeId && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><CalendarDays className="w-4 h-4" /> My upcoming classes</h3>
          {myClasses.length === 0 ? (
            <p className="text-sm text-muted-foreground">You have no upcoming assigned classes.</p>
          ) : (
            <div className="space-y-2">
              {myClasses.map(({ schedule, roles }) => {
                const pending = openRequests.some(r => r.schedule_id === schedule.id && r.requester_employee_id === myEmployeeId);
                return (
                  <div key={schedule.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-lg p-3">
                    <div>
                      <div className="font-medium">{fmtDate(schedule.date)} — {schedule.location_label}{schedule.group_name ? ` (${schedule.group_name})` : ""}</div>
                      <div className="flex flex-wrap gap-1 mt-1">{roleBadges(roles)}</div>
                    </div>
                    {pending ? (
                      <Badge className="bg-amber-500/15 text-amber-600 border border-amber-500/40">Sub requested</Badge>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => { setReqScheduleId(schedule.id); setReqRoles([]); setReqFull(true); setReqReason(""); setReqOpen(true); }}>
                        Request sub
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Open requests */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" /> Open coverage requests
          {visibleOpen.length > 0 && <Badge variant="destructive">{visibleOpen.length}</Badge>}
        </h3>
        {visibleOpen.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open requests.</p>
        ) : (
          <div className="space-y-2">
            {visibleOpen.map(r => (
              <div key={r.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{empName(r.requester_employee_id)} — needs coverage</div>
                    <div className="text-sm text-muted-foreground">{schedLabel(r.schedule_id)}</div>
                  </div>
                  <div className="flex gap-2">
                    {canManage && (
                      <Button size="sm" onClick={() => { setFillTarget(r); setFillEmployee(""); setFillNote(""); }}>
                        <UserCheck className="w-4 h-4 mr-1" /> Assign sub
                      </Button>
                    )}
                    {(canManage || r.requester_employee_id === myEmployeeId) && (
                      <Button size="sm" variant="ghost" onClick={() => cancelRequest(r)}>Cancel</Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">{roleBadges(r.roles)}</div>
                <p className="text-sm"><span className="text-muted-foreground">Reason: </span>{r.reason}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* History */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><History className="w-4 h-4" /> Sub history</h3>
        {historyRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sub history yet.</p>
        ) : (
          <div className="space-y-2">
            {historyRequests.map(r => (
              <div key={r.id} className="border rounded-lg p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">
                    {empName(r.requester_employee_id)}
                    {r.status === "filled" ? <> → <span className="text-primary">{empName(r.covering_employee_id)}</span></> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {r.is_manual && <Badge variant="outline">Office entered</Badge>}
                    <Badge variant={r.status === "filled" ? "default" : "secondary"}>{r.status === "filled" ? "Covered" : "Cancelled"}</Badge>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">{schedLabel(r.schedule_id)}</div>
                <div className="flex flex-wrap gap-1 mt-1">{roleBadges(r.roles)}</div>
                <p className="text-sm mt-1"><span className="text-muted-foreground">Reason: </span>{r.reason}</p>
                {r.resolution_note && <p className="text-sm"><span className="text-muted-foreground">Note: </span>{r.resolution_note}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Request sub dialog */}
      <Dialog open={reqOpen} onOpenChange={setReqOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request a substitute</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Class</Label>
              <Select value={reqScheduleId} onValueChange={(v) => { setReqScheduleId(v); setReqRoles([]); }}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {myClasses.map(({ schedule }) => (
                    <SelectItem key={schedule.id} value={schedule.id}>{schedLabel(schedule.id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>What needs covering?</Label>
              <div className="flex items-center gap-2">
                <Checkbox id="req-full" checked={reqFull} onCheckedChange={(c) => setReqFull(!!c)} />
                <label htmlFor="req-full" className="text-sm">Whole class</label>
              </div>
              {!reqFull && reqScheduleId && myEmployeeId && (
                <div className="flex flex-wrap gap-3">
                  {rolesFor(reqScheduleId, myEmployeeId).map(role => (
                    <div key={role} className="flex items-center gap-2">
                      <Checkbox id={`req-${role}`} checked={reqRoles.includes(role)} onCheckedChange={() => toggle(reqRoles, setReqRoles, role)} />
                      <label htmlFor={`req-${role}`} className="text-sm">{ROLE_LABELS[role] ?? role}</label>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea value={reqReason} onChange={(e) => setReqReason(e.target.value)} placeholder="e.g. sick, family emergency, vehicle issue" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReqOpen(false)}>Close</Button>
            <Button onClick={submitRequest} disabled={saving}>Submit request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign sub dialog */}
      <Dialog open={!!fillTarget} onOpenChange={(o) => !o && setFillTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign a substitute</DialogTitle></DialogHeader>
          {fillTarget && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {schedLabel(fillTarget.schedule_id)} · out: <span className="text-foreground font-medium">{empName(fillTarget.requester_employee_id)}</span>
              </div>
              <div>
                <Label>Covering instructor</Label>
                <Select value={fillEmployee} onValueChange={setFillEmployee}>
                  <SelectTrigger><SelectValue placeholder="Select instructor" /></SelectTrigger>
                  <SelectContent>
                    {employees.filter(e => e.id !== fillTarget.requester_employee_id).map(e => {
                      const busy = instructorsOn(fillTarget.schedule_id).includes(e.id);
                      return <SelectItem key={e.id} value={e.id}>{e.full_name}{busy ? " · already on this class" : ""}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Note (optional)</Label>
                <Textarea value={fillNote} onChange={(e) => setFillNote(e.target.value)} placeholder="Visible on the sub history" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFillTarget(null)}>Close</Button>
            <Button onClick={confirmFill} disabled={saving || !fillEmployee}>Assign sub</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual sub dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log a sub manually</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Class</Label>
              <Select value={mSchedule} onValueChange={(v) => { setMSchedule(v); setMOut(""); setMIn(""); setMRoles([]); }}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {schedules.map(s => <SelectItem key={s.id} value={s.id}>{schedLabel(s.id)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Instructor who can't make it</Label>
              <Select value={mOut} onValueChange={(v) => { setMOut(v); setMRoles([]); }} disabled={!mSchedule}>
                <SelectTrigger><SelectValue placeholder="Select instructor" /></SelectTrigger>
                <SelectContent>
                  {instructorsOn(mSchedule).map(id => <SelectItem key={id} value={id}>{empName(id)}</SelectItem>)}
                </SelectContent>
              </Select>
              {mSchedule && instructorsOn(mSchedule).length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">No instructors assigned to this class yet.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>What needs covering?</Label>
              <div className="flex items-center gap-2">
                <Checkbox id="m-full" checked={mFull} onCheckedChange={(c) => setMFull(!!c)} />
                <label htmlFor="m-full" className="text-sm">Whole class</label>
              </div>
              {!mFull && mSchedule && mOut && (
                <div className="flex flex-wrap gap-3">
                  {rolesFor(mSchedule, mOut).map(role => (
                    <div key={role} className="flex items-center gap-2">
                      <Checkbox id={`m-${role}`} checked={mRoles.includes(role)} onCheckedChange={() => toggle(mRoles, setMRoles, role)} />
                      <label htmlFor={`m-${role}`} className="text-sm">{ROLE_LABELS[role] ?? role}</label>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>Covering instructor</Label>
              <Select value={mIn} onValueChange={setMIn}>
                <SelectTrigger><SelectValue placeholder="Select instructor" /></SelectTrigger>
                <SelectContent>
                  {employees.filter(e => e.id !== mOut).map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea value={mReason} onChange={(e) => setMReason(e.target.value)} placeholder="e.g. called in sick this morning" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setManualOpen(false)}>Close</Button>
            <Button onClick={submitManual} disabled={saving}>Save sub</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubCoverage;

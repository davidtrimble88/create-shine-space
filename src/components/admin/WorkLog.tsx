import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { ChevronDown, ChevronRight, Download, ClipboardList, CalendarRange, Plus, Pencil, Trash2 } from "lucide-react";
import { formatPSTDate } from "@/lib/formatDate";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ExtraHoursRequests from "./ExtraHoursRequests";

type Duty = "c1" | "r1" | "c2" | "r2";
const DUTIES: Duty[] = ["c1", "r1", "c2", "r2"];

// Pay periods: 1st–15th (A) and 16th–end of month (B)
type PayPeriod = { key: string; label: string; start: string; end: string; isCurrent: boolean };

const pad = (n: number) => String(n).padStart(2, "0");
const lastDayOfMonth = (y: number, m: number) => new Date(y, m, 0).getDate(); // m is 1-12

const buildPeriod = (year: number, month: number, half: "A" | "B", today: Date): PayPeriod => {
  const start = half === "A" ? `${year}-${pad(month)}-01` : `${year}-${pad(month)}-16`;
  const end =
    half === "A"
      ? `${year}-${pad(month)}-15`
      : `${year}-${pad(month)}-${pad(lastDayOfMonth(year, month))}`;
  const monthName = new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long" });
  const label = half === "A" ? `${monthName} 1–15, ${year}` : `${monthName} 16–${lastDayOfMonth(year, month)}, ${year}`;
  const todayStr = today.toISOString().slice(0, 10);
  const isCurrent = todayStr >= start && todayStr <= end;
  return { key: `${year}-${pad(month)}-${half}`, label, start, end, isCurrent };
};

const getCurrentPeriod = (today: Date): PayPeriod => {
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  const half: "A" | "B" = today.getDate() <= 15 ? "A" : "B";
  return buildPeriod(y, m, half, today);
};

const listPayPeriods = (count = 24): PayPeriod[] => {
  const today = new Date();
  const periods: PayPeriod[] = [];
  let y = today.getFullYear();
  let m = today.getMonth() + 1;
  let half: "A" | "B" = today.getDate() <= 15 ? "A" : "B";
  for (let i = 0; i < count; i++) {
    periods.push(buildPeriod(y, m, half, today));
    if (half === "B") {
      half = "A";
    } else {
      half = "B";
      m -= 1;
      if (m === 0) {
        m = 12;
        y -= 1;
      }
    }
  }
  return periods;
};


interface Employee {
  id: string;
  user_id: string | null;
  full_name: string;
  position: string | null;
  is_active: boolean;
}

interface AssignmentRow {
  employee_id: string;
  assignment_role: string;
  part: string | null;
  schedule_id: string;
  schedules: { id: string; date: string; course: string | null; location: string | null; schedule: string | null } | null;
}

interface ExtraHoursRow {
  id: string;
  employee_id: string;
  hours: number;
  justification: string;
  work_date: string | null;
  decided_at: string | null;
}

interface EmployeeSummary {
  employee: Employee;
  counts: Record<Duty, number>;
  total: number;
  extraHours: number;
  extraEntries: ExtraHoursRow[];
  entries: {
    date: string;
    scheduleId: string;
    course: string | null;
    location: string | null;
    duties: Duty[];
  }[];
}

const WorkLog = () => {
  const { user, effectiveRole } = useAuth();
  const isAdmin = effectiveRole === "owner" || effectiveRole === "admin";
  const isOwner = effectiveRole === "owner";

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [extraHours, setExtraHours] = useState<ExtraHoursRow[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const payPeriods = useMemo(() => listPayPeriods(24), []);
  const currentPeriod = useMemo(() => getCurrentPeriod(new Date()), []);
  const [periodKey, setPeriodKey] = useState<string>(currentPeriod.key);
  const [fromDate, setFromDate] = useState<string>(currentPeriod.start);
  const [toDate, setToDate] = useState<string>(currentPeriod.end);

  // Owner-only extra hours editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorEmployee, setEditorEmployee] = useState<Employee | null>(null);
  const [editorEntry, setEditorEntry] = useState<ExtraHoursRow | null>(null);
  const [formHours, setFormHours] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formJustification, setFormJustification] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExtraHoursRow | null>(null);

  const openAdd = (emp: Employee) => {
    setEditorEmployee(emp);
    setEditorEntry(null);
    setFormHours("");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormJustification("");
    setEditorOpen(true);
  };

  const openEdit = (emp: Employee, entry: ExtraHoursRow) => {
    setEditorEmployee(emp);
    setEditorEntry(entry);
    setFormHours(String(entry.hours));
    setFormDate(entry.work_date ?? entry.decided_at?.slice(0, 10) ?? "");
    setFormJustification(entry.justification ?? "");
    setEditorOpen(true);
  };

  const saveEntry = async () => {
    if (!isOwner || !editorEmployee || !user) return;
    const h = parseFloat(formHours);
    if (!h || h <= 0) {
      toast({ title: "Enter a valid hours amount", variant: "destructive" });
      return;
    }
    if (formJustification.trim().length < 3) {
      toast({ title: "Please add justification", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      hours: h,
      work_date: formDate || null,
      justification: formJustification.trim(),
    };
    const { error } = editorEntry
      ? await supabase.from("extra_hours_requests").update(payload).eq("id", editorEntry.id)
      : await supabase.from("extra_hours_requests").insert({
          ...payload,
          employee_id: editorEmployee.id,
          requested_by: user.id,
          status: "approved",
          decided_by: user.id,
          decided_at: new Date().toISOString(),
        });
    setSaving(false);
    if (error) {
      toast({ title: "Could not save hours", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editorEntry ? "Extra hours updated" : "Extra hours added" });
    setEditorOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!isOwner || !deleteTarget) return;
    const { error } = await supabase.from("extra_hours_requests").delete().eq("id", deleteTarget.id);
    if (error) {
      toast({ title: "Could not remove hours", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Extra hours removed" });
    setDeleteTarget(null);
    load();
  };

  const applyPeriod = (key: string) => {
    setPeriodKey(key);
    if (key === "all") {
      setFromDate("");
      setToDate("");
      return;
    }
    if (key === "custom") return;
    const p = payPeriods.find((pp) => pp.key === key);
    if (p) {
      setFromDate(p.start);
      setToDate(p.end);
    }
  };


  const load = async () => {
    setLoading(true);

    const empRes = await supabase
      .from("employees")
      .select("id, user_id, full_name, position, is_active");

    const assignRes = await supabase
      .from("instructor_assignments")
      .select("employee_id, assignment_role, part, schedule_id, schedules(id, date, course, location, schedule)");

    const extraRes = await supabase
      .from("extra_hours_requests")
      .select("id, employee_id, hours, justification, work_date, decided_at")
      .eq("status", "approved");

    setEmployees((empRes.data ?? []) as Employee[]);
    // A class only counts once the WHOLE class is over (day after its last session),
    // not the day after its start date.
    const rows = ((assignRes.data ?? []) as any[]).filter(
      (r) => r.schedules?.date && isClassPast(r.schedules.date, r.schedules.schedule),
    ) as AssignmentRow[];
    setAssignments(rows);
    setExtraHours((extraRes.data ?? []) as ExtraHoursRow[]);
    setLoading(false);
  };


  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summaries = useMemo<EmployeeSummary[]>(() => {
    // Determine which employees to include
    let empList = employees;
    if (!isAdmin) {
      empList = employees.filter((e) => e.user_id && user && e.user_id === user.id);
    }

    // Group assignments by employee, then by the actual class DAY worked
    // (a multi-day class has sessions on several dates, not just its start date).
    const byEmp = new Map<string, Map<string, { row: AssignmentRow; date: string; duties: Set<Duty> }>>();
    for (const a of assignments) {
      const duty = a.assignment_role as Duty;
      if (!DUTIES.includes(duty)) continue;

      const start = a.schedules?.date ?? "";
      const sessionDates = classSessionDates(start, a.schedules?.schedule);
      const partDate = sessionDateForPart(start, a.schedules?.schedule, a.part);
      // Dates this assignment could have been worked on
      const candidates = partDate ? [partDate] : sessionDates.length ? sessionDates : [start];
      const inRange = candidates.filter(
        (d) => (!fromDate || d >= fromDate) && (!toDate || d <= toDate),
      );
      if (inRange.length === 0) continue;
      const workedDate = partDate ?? inRange[0];

      let empMap = byEmp.get(a.employee_id);
      if (!empMap) {
        empMap = new Map();
        byEmp.set(a.employee_id, empMap);
      }
      const key = `${a.schedule_id}|${a.part ?? ""}`;
      let entry = empMap.get(key);
      if (!entry) {
        entry = { row: a, date: workedDate, duties: new Set() };
        empMap.set(key, entry);
      }
      entry.duties.add(duty);
    }

    const result: EmployeeSummary[] = empList.map((emp) => {
      const empMap = byEmp.get(emp.id) ?? new Map();
      const counts: Record<Duty, number> = { c1: 0, r1: 0, c2: 0, r2: 0 };
      const entries: EmployeeSummary["entries"] = [];
      for (const { row, date, duties } of empMap.values()) {
        duties.forEach((d) => counts[d]++);
        entries.push({
          date,
          scheduleId: row.schedule_id,
          course: row.schedules?.course ?? null,
          location: row.schedules?.location ?? null,
          duties: DUTIES.filter((d) => duties.has(d)),
        });
      }

      entries.sort((a, b) => (a.date < b.date ? 1 : -1));
      const total = counts.c1 + counts.r1 + counts.c2 + counts.r2;

      const empExtras = extraHours.filter((x) => {
        if (x.employee_id !== emp.id) return false;
        const d = x.work_date ?? x.decided_at?.slice(0, 10);
        if (fromDate && d && d < fromDate) return false;
        if (toDate && d && d > toDate) return false;
        return true;
      });
      const extraTotal = empExtras.reduce((sum, x) => sum + Number(x.hours || 0), 0);

      return { employee: emp, counts, total, entries, extraHours: extraTotal, extraEntries: empExtras };
    });

    // Filter by search + sort by total desc then name
    const filtered = result.filter((r) =>
      search ? r.employee.full_name.toLowerCase().includes(search.toLowerCase()) : true,
    );
    filtered.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.employee.full_name.localeCompare(b.employee.full_name);
    });
    return filtered;
  }, [employees, assignments, extraHours, isAdmin, user, search, fromDate, toDate]);

  const totals = useMemo(() => {
    const t: Record<Duty, number> = { c1: 0, r1: 0, c2: 0, r2: 0 };
    let extra = 0;
    summaries.forEach((s) => {
      DUTIES.forEach((d) => (t[d] += s.counts[d]));
      extra += s.extraHours;
    });
    return { ...t, extra };
  }, [summaries]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportCSV = () => {
    const header = ["Employee", "Position", "C1", "R1", "C2", "R2", "Total Sessions", "Extra Hours"];
    const rows = summaries.map((s) => [
      s.employee.full_name,
      s.employee.position ?? "",
      s.counts.c1,
      s.counts.r1,
      s.counts.c2,
      s.counts.r2,
      s.total,
      s.extraHours,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `work-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="w-7 h-7" />
            Work Log
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin
              ? "Classrooms (C1, C2) and ranges (R1, R2) taught per employee. Only counts classes that have already occurred."
              : "Your teaching history — classrooms (C1, C2) and ranges (R1, R2) after each class date has passed."}
          </p>
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={exportCSV} disabled={summaries.length === 0}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          {isAdmin && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Search employee</label>
              <Input
                placeholder="Name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-56"
              />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <CalendarRange className="w-3 h-3" /> Pay Period
            </label>
            <Select value={periodKey} onValueChange={applyPeriod}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select pay period" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value={currentPeriod.key}>
                  Current — {currentPeriod.label}
                </SelectItem>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="custom">Custom range…</SelectItem>
                <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Past pay periods
                </div>
                {payPeriods
                  .filter((p) => !p.isCurrent)
                  .map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">From</label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPeriodKey("custom");
              }}
              className="w-44"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">To</label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPeriodKey("custom");
              }}
              className="w-44"
            />
          </div>
          <Button variant="ghost" onClick={() => applyPeriod(currentPeriod.key)}>
            Reset to current
          </Button>

        </CardContent>
      </Card>

      <ExtraHoursRequests onDecision={load} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-2">
            <span>{isAdmin ? "Employee Totals" : "My Totals"}</span>
            <Badge variant="outline" className="font-normal">
              {periodKey === "all"
                ? "All time"
                : periodKey === "custom"
                  ? `${fromDate || "—"} to ${toDate || "—"}`
                  : payPeriods.find((p) => p.key === periodKey)?.label ?? currentPeriod.label}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : summaries.length === 0 ? (
            <p className="text-muted-foreground text-sm">No completed classes found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-center">C1</TableHead>
                    <TableHead className="text-center">R1</TableHead>
                    <TableHead className="text-center">C2</TableHead>
                    <TableHead className="text-center">R2</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Extra Hrs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaries.map((s) => {
                    const open = expanded.has(s.employee.id);
                    return (
                      <>
                        <TableRow
                          key={s.employee.id}
                          className="cursor-pointer"
                          onClick={() => toggle(s.employee.id)}
                        >
                          <TableCell>
                            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </TableCell>
                          <TableCell className="font-medium">
                            {s.employee.full_name}
                            {s.employee.position && (
                              <span className="text-xs text-muted-foreground ml-2">({s.employee.position})</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">{s.counts.c1}</TableCell>
                          <TableCell className="text-center">{s.counts.r1}</TableCell>
                          <TableCell className="text-center">{s.counts.c2}</TableCell>
                          <TableCell className="text-center">{s.counts.r2}</TableCell>
                          <TableCell className="text-center font-semibold">{s.total}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {s.extraHours > 0 ? (
                                <span className="font-semibold text-primary">{s.extraHours}</span>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                              {isOwner && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-primary"
                                  title="Add extra hours"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openAdd(s.employee);
                                  }}
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                              )}
                              {isOwner && s.extraEntries.length > 0 && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  title="Edit or delete approved hours"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!expanded.has(s.employee.id)) toggle(s.employee.id);
                                  }}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {open && (
                          <TableRow key={s.employee.id + "-detail"}>
                            <TableCell colSpan={8} className="bg-muted/30">
                              {s.entries.length === 0 && s.extraEntries.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">No sessions or extra hours in range.</p>
                              ) : (
                                <div className="py-2 space-y-4">
                                  {s.entries.length > 0 && (
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Date</TableHead>
                                          <TableHead>Course</TableHead>
                                          <TableHead>Location</TableHead>
                                          <TableHead>Sessions Taught</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {s.entries.map((e) => (
                                          <TableRow key={e.scheduleId}>
                                            <TableCell>{formatPSTDate(e.date)}</TableCell>
                                            <TableCell className="capitalize">{e.course ?? "—"}</TableCell>
                                            <TableCell>{e.location ?? "—"}</TableCell>
                                            <TableCell>
                                              <div className="flex gap-1 flex-wrap">
                                                {e.duties.map((d) => (
                                                  <Badge key={d} variant="secondary" className="uppercase">
                                                    {d}
                                                  </Badge>
                                                ))}
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  )}
                                  {s.extraEntries.length > 0 && (
                                    <div>
                                      <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                                        Approved Extra Hours
                                      </p>
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead className="text-center">Hours</TableHead>
                                            <TableHead>Justification</TableHead>
                                            {isOwner && <TableHead className="text-right">Actions</TableHead>}
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {s.extraEntries.map((x, i) => (
                                            <TableRow key={i}>
                                              <TableCell className="whitespace-nowrap">
                                                {formatPSTDate(x.work_date ?? x.decided_at ?? "")}
                                              </TableCell>
                                              <TableCell className="text-center font-semibold">{x.hours}</TableCell>
                                              <TableCell className="whitespace-pre-wrap text-sm">
                                                {x.justification}
                                              </TableCell>
                                              {isOwner && (
                                                <TableCell className="text-right whitespace-nowrap">
                                                  <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7"
                                                    title="Edit hours"
                                                    onClick={(ev) => {
                                                      ev.stopPropagation();
                                                      openEdit(s.employee, x);
                                                    }}
                                                  >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                  </Button>
                                                  <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-destructive"
                                                    title="Delete hours"
                                                    onClick={(ev) => {
                                                      ev.stopPropagation();
                                                      setDeleteTarget(x);
                                                    }}
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </Button>
                                                </TableCell>
                                              )}
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  )}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
                {isAdmin && summaries.length > 1 && (
                  <TableRow className="font-semibold border-t-2">
                    <TableCell></TableCell>
                    <TableCell>Totals</TableCell>
                    <TableCell className="text-center">{totals.c1}</TableCell>
                    <TableCell className="text-center">{totals.r1}</TableCell>
                    <TableCell className="text-center">{totals.c2}</TableCell>
                    <TableCell className="text-center">{totals.r2}</TableCell>
                    <TableCell className="text-center">
                      {totals.c1 + totals.r1 + totals.c2 + totals.r2}
                    </TableCell>
                    <TableCell className="text-center">{totals.extra}</TableCell>
                  </TableRow>
                )}
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {isOwner && (
        <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editorEntry ? "Edit Extra Hours" : "Add Extra Hours"}
                {editorEmployee ? ` — ${editorEmployee.full_name}` : ""}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Hours</label>
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  value={formHours}
                  onChange={(e) => setFormHours(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Work date</label>
                <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Justification</label>
                <Textarea
                  rows={3}
                  value={formJustification}
                  onChange={(e) => setFormJustification(e.target.value)}
                  placeholder="What was the extra time for?"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditorOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveEntry} disabled={saving}>
                {saving ? "Saving…" : editorEntry ? "Save changes" : "Add hours"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {isOwner && (
        <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove extra hours?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This permanently deletes {deleteTarget?.hours} approved hour(s). This cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete}>
                Remove
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default WorkLog;

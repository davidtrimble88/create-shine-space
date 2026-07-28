import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Download, ClipboardList } from "lucide-react";
import { formatPSTDate } from "@/lib/formatDate";
import ExtraHoursRequests from "./ExtraHoursRequests";

type Duty = "c1" | "r1" | "c2" | "r2";
const DUTIES: Duty[] = ["c1", "r1", "c2", "r2"];

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

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [extraHours, setExtraHours] = useState<ExtraHoursRow[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const today = new Date().toISOString().slice(0, 10);

      const empRes = await supabase
        .from("employees")
        .select("id, user_id, full_name, position, is_active");

      const assignRes = await supabase
        .from("instructor_assignments")
        .select("employee_id, assignment_role, part, schedule_id, schedules(id, date, course, location, schedule)")
        .lt("schedules.date", today);

      // RLS filters to what this user is allowed to see (own rows, or all for owner/admin approved)
      const extraRes = await supabase
        .from("extra_hours_requests")
        .select("employee_id, hours, justification, work_date, decided_at")
        .eq("status", "approved");

      setEmployees((empRes.data ?? []) as Employee[]);
      const rows = ((assignRes.data ?? []) as any[]).filter(
        (r) => r.schedules && r.schedules.date && r.schedules.date < today,
      ) as AssignmentRow[];
      setAssignments(rows);
      setExtraHours((extraRes.data ?? []) as ExtraHoursRow[]);
      setLoading(false);
    };
    load();
  }, []);

  const summaries = useMemo<EmployeeSummary[]>(() => {
    // Determine which employees to include
    let empList = employees;
    if (!isAdmin) {
      empList = employees.filter((e) => e.user_id && user && e.user_id === user.id);
    }

    // Group assignments by employee, then by schedule
    const byEmp = new Map<string, Map<string, { row: AssignmentRow; duties: Set<Duty> }>>();
    for (const a of assignments) {
      const duty = a.assignment_role as Duty;
      if (!DUTIES.includes(duty)) continue;
      if (fromDate && a.schedules && a.schedules.date < fromDate) continue;
      if (toDate && a.schedules && a.schedules.date > toDate) continue;

      let empMap = byEmp.get(a.employee_id);
      if (!empMap) {
        empMap = new Map();
        byEmp.set(a.employee_id, empMap);
      }
      const key = a.schedule_id;
      let entry = empMap.get(key);
      if (!entry) {
        entry = { row: a, duties: new Set() };
        empMap.set(key, entry);
      }
      entry.duties.add(duty);
    }

    const result: EmployeeSummary[] = empList.map((emp) => {
      const empMap = byEmp.get(emp.id) ?? new Map();
      const counts: Record<Duty, number> = { c1: 0, r1: 0, c2: 0, r2: 0 };
      const entries: EmployeeSummary["entries"] = [];
      for (const { row, duties } of empMap.values()) {
        duties.forEach((d) => counts[d]++);
        entries.push({
          date: row.schedules?.date ?? "",
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
            <label className="text-xs text-muted-foreground">From</label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-44" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">To</label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-44" />
          </div>
          {(fromDate || toDate || search) && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch("");
                setFromDate("");
                setToDate("");
              }}
            >
              Clear
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {isAdmin ? "Employee Totals" : "My Totals"}
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
                        </TableRow>
                        {open && (
                          <TableRow key={s.employee.id + "-detail"}>
                            <TableCell colSpan={7} className="bg-muted/30">
                              {s.entries.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">No sessions in range.</p>
                              ) : (
                                <div className="py-2">
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
                  </TableRow>
                )}
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkLog;

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Hand, X, CalendarDays, Calendar } from "lucide-react";

const ROLES = [
  { value: "instructor_1", label: "Instructor 1" },
  { value: "instructor_2", label: "Instructor 2" },
  { value: "range_assistant", label: "Range Assistant" },
  { value: "instructor_candidate", label: "Instructor Candidate" },
];

const DUTIES = [
  { value: "c1", label: "C1" },
  { value: "r1", label: "R1" },
  { value: "c2", label: "C2" },
  { value: "r2", label: "R2" },
];

const DUTY_VALUES = new Set(DUTIES.map(d => d.value));

const roleLabelMap: Record<string, string> = {
  ...Object.fromEntries(ROLES.map(r => [r.value, r.label])),
  ...Object.fromEntries(DUTIES.map(d => [d.value, d.label])),
};

const parsePartsFromSchedule = (scheduleText: string): string[] => {
  return scheduleText
    .split(/[,;]|\s\|\s/)
    .map(s => s.trim())
    .filter(Boolean);
};

interface Employee {
  id: string;
  full_name: string;
  email: string;
  position: string | null;
  user_id?: string | null;
}

type AssignMode = "full" | "parts";

interface AssignmentEntry {
  employee_id: string;
  role: string;
  mode: AssignMode;
  fullDuties: Set<string>; // duties when mode = full
  perPart: Map<string, Set<string>>; // part -> duty set (only used in 'parts' mode; key present = day selected)
}

interface Props {
  scheduleId: string;
  scheduleName: string;
  onClose: () => void;
}

const InstructorAssignment = ({ scheduleId, scheduleName, onClose }: Props) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [availability, setAvailability] = useState<Map<string, string[] | null>>(new Map());
  const [scheduleParts, setScheduleParts] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<AssignmentEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      const [empRes, assignRes, availRes, schedRes] = await Promise.all([
        supabase.from("employees").select("id, full_name, email, position, user_id").eq("is_active", true),
        supabase.from("instructor_assignments").select("employee_id, assignment_role, part").eq("schedule_id", scheduleId),
        supabase.from("instructor_availability").select("user_id, parts").eq("schedule_id", scheduleId),
        supabase.from("schedules").select("schedule").eq("id", scheduleId).maybeSingle(),
      ]);

      const parts = schedRes.data?.schedule ? parsePartsFromSchedule(schedRes.data.schedule) : [];
      setScheduleParts(parts);

      const availMap = new Map<string, string[] | null>();
      (availRes.data ?? []).forEach(a => {
        if (a.user_id) availMap.set(a.user_id, (a.parts as string[] | null) ?? null);
      });
      setAvailability(availMap);

      const emps = (empRes.data ?? []) as Employee[];
      emps.sort((a, b) => {
        const aAvail = a.user_id ? availMap.has(a.user_id) : false;
        const bAvail = b.user_id ? availMap.has(b.user_id) : false;
        if (aAvail && !bAvail) return -1;
        if (!aAvail && bAvail) return 1;
        return a.full_name.localeCompare(b.full_name);
      });
      setEmployees(emps);

      // Group rows by employee
      const grouped = new Map<string, AssignmentEntry>();
      (assignRes.data ?? []).forEach((row: any) => {
        const r = row.assignment_role ?? "instructor_1";
        const part: string | null = row.part ?? null;
        let entry = grouped.get(row.employee_id);
        if (!entry) {
          entry = {
            employee_id: row.employee_id,
            role: "instructor_1",
            mode: "full",
            fullDuties: new Set(),
            perPart: new Map(),
          };
          grouped.set(row.employee_id, entry);
        }
        if (part) {
          entry.mode = "parts";
          if (!entry.perPart.has(part)) entry.perPart.set(part, new Set());
          if (DUTY_VALUES.has(r)) entry.perPart.get(part)!.add(r);
          else entry.role = r;
        } else {
          if (DUTY_VALUES.has(r)) entry.fullDuties.add(r);
          else entry.role = r;
        }
      });
      setAssignments(Array.from(grouped.values()));
    };
    load();
  }, [scheduleId]);

  const isAssigned = (empId: string) => assignments.some(a => a.employee_id === empId);
  const getEntry = (empId: string) => assignments.find(a => a.employee_id === empId);

  const toggleEmployee = (empId: string) => {
    if (isAssigned(empId)) {
      setAssignments(prev => prev.filter(a => a.employee_id !== empId));
    } else {
      setAssignments(prev => [...prev, {
        employee_id: empId,
        role: "instructor_1",
        mode: "full",
        fullDuties: new Set(),
        perPart: new Map(),
      }]);
    }
  };

  const updateEntry = (empId: string, fn: (e: AssignmentEntry) => AssignmentEntry) => {
    setAssignments(prev => prev.map(a => a.employee_id === empId ? fn(a) : a));
  };

  const setRole = (empId: string, role: string) => updateEntry(empId, a => ({ ...a, role }));

  const setMode = (empId: string, mode: AssignMode) => updateEntry(empId, a => ({ ...a, mode }));

  const toggleFullDuty = (empId: string, duty: string) => {
    updateEntry(empId, a => {
      const next = new Set(a.fullDuties);
      if (next.has(duty)) next.delete(duty); else next.add(duty);
      return { ...a, fullDuties: next };
    });
  };

  const togglePartDay = (empId: string, part: string) => {
    updateEntry(empId, a => {
      const next = new Map(a.perPart);
      if (next.has(part)) next.delete(part);
      else next.set(part, new Set());
      return { ...a, perPart: next };
    });
  };

  const togglePartDuty = (empId: string, part: string, duty: string) => {
    updateEntry(empId, a => {
      const next = new Map(a.perPart);
      const duties = new Set(next.get(part) ?? []);
      if (duties.has(duty)) duties.delete(duty); else duties.add(duty);
      next.set(part, duties);
      return { ...a, perPart: next };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    await supabase.from("instructor_assignments").delete().eq("schedule_id", scheduleId);
    const rows: { schedule_id: string; employee_id: string; assignment_role: string; part: string | null }[] = [];
    assignments.forEach(a => {
      if (a.mode === "full") {
        rows.push({ schedule_id: scheduleId, employee_id: a.employee_id, assignment_role: a.role, part: null });
        a.fullDuties.forEach(d => {
          rows.push({ schedule_id: scheduleId, employee_id: a.employee_id, assignment_role: d, part: null });
        });
      } else {
        // per-part mode: emit role row + duty rows per selected day
        a.perPart.forEach((duties, part) => {
          rows.push({ schedule_id: scheduleId, employee_id: a.employee_id, assignment_role: a.role, part });
          duties.forEach(d => {
            rows.push({ schedule_id: scheduleId, employee_id: a.employee_id, assignment_role: d, part });
          });
        });
      }
    });
    if (rows.length > 0) {
      const { error } = await supabase.from("instructor_assignments").insert(rows);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }
    toast({ title: "Saved", description: "Instructor assignments updated." });
    setSaving(false);
    onClose();
  };

  const availabilityFor = (emp: Employee): { has: boolean; parts: string[] | null } => {
    if (!emp.user_id || !availability.has(emp.user_id)) return { has: false, parts: null };
    return { has: true, parts: availability.get(emp.user_id) ?? null };
  };

  const hasMultiDay = scheduleParts.length > 1;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Assign Instructors
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">{scheduleName}</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-1 my-4">
          {employees.map(emp => {
            const assigned = isAssigned(emp.id);
            const entry = getEntry(emp.id);
            const avail = availabilityFor(emp);
            return (
              <div
                key={emp.id}
                className={`rounded-lg border transition-colors ${
                  assigned ? "bg-accent/10 border-accent/30" : "border-transparent hover:bg-secondary"
                }`}
              >
                <button
                  onClick={() => toggleEmployee(emp.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    assigned ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground"
                  }`}>
                    {emp.full_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{emp.full_name}</span>
                      {avail.has && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded-full">
                          <Hand className="w-3 h-3" />
                          {avail.parts === null ? "Available (full)" : `Available: ${avail.parts.join(", ")}`}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{emp.position || emp.email}</span>
                  </div>
                  {assigned && (
                    <X className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </button>
                {assigned && entry && (
                  <div className="px-3 pb-3 pl-14 space-y-2.5">
                    <Select value={entry.role} onValueChange={v => setRole(emp.id, v)}>
                      <SelectTrigger className="h-8 text-xs w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map(r => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {hasMultiDay && (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setMode(emp.id, "full")}
                          className={`flex-1 h-8 text-xs font-medium rounded-md border flex items-center justify-center gap-1.5 transition-colors ${
                            entry.mode === "full"
                              ? "bg-accent text-accent-foreground border-accent"
                              : "bg-background text-muted-foreground border-border hover:bg-secondary"
                          }`}
                        >
                          <CalendarDays className="w-3.5 h-3.5" /> Whole class
                        </button>
                        <button
                          type="button"
                          onClick={() => setMode(emp.id, "parts")}
                          className={`flex-1 h-8 text-xs font-medium rounded-md border flex items-center justify-center gap-1.5 transition-colors ${
                            entry.mode === "parts"
                              ? "bg-accent text-accent-foreground border-accent"
                              : "bg-background text-muted-foreground border-border hover:bg-secondary"
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5" /> Specific days
                        </button>
                      </div>
                    )}

                    {entry.mode === "full" || !hasMultiDay ? (
                      <div className="flex gap-1.5 flex-nowrap">
                        {DUTIES.map(d => {
                          const active = entry.fullDuties.has(d.value);
                          return (
                            <button
                              key={d.value}
                              type="button"
                              onClick={() => toggleFullDuty(emp.id, d.value)}
                              className={`h-8 flex-1 text-xs font-semibold rounded-md border transition-colors ${
                                active
                                  ? "bg-accent text-accent-foreground border-accent"
                                  : "bg-background text-muted-foreground border-border hover:bg-secondary hover:text-foreground"
                              }`}
                              title={`Toggle ${d.label}`}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {scheduleParts.map(part => {
                          const selected = entry.perPart.has(part);
                          const duties = entry.perPart.get(part) ?? new Set<string>();
                          return (
                            <div key={part} className={`rounded-md border ${selected ? "border-accent/40 bg-accent/5" : "border-border"}`}>
                              <button
                                type="button"
                                onClick={() => togglePartDay(emp.id, part)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 text-left"
                              >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                                  selected ? "bg-accent border-accent text-accent-foreground" : "border-border"
                                }`}>
                                  {selected ? "✓" : ""}
                                </div>
                                <span className="text-xs font-medium">{part}</span>
                              </button>
                              {selected && (
                                <div className="flex gap-1.5 px-2 pb-2">
                                  {DUTIES.map(d => {
                                    const active = duties.has(d.value);
                                    return (
                                      <button
                                        key={d.value}
                                        type="button"
                                        onClick={() => togglePartDuty(emp.id, part, d.value)}
                                        className={`h-7 flex-1 text-[11px] font-semibold rounded border transition-colors ${
                                          active
                                            ? "bg-accent text-accent-foreground border-accent"
                                            : "bg-background text-muted-foreground border-border hover:bg-secondary hover:text-foreground"
                                        }`}
                                      >
                                        {d.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : `Save (${assignments.length} assigned)`}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export { roleLabelMap };
export default InstructorAssignment;

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Hand, X } from "lucide-react";

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

interface Employee {
  id: string;
  full_name: string;
  email: string;
  position: string | null;
  user_id?: string | null;
}

interface AssignmentEntry {
  employee_id: string;
  role: string; // primary role (instructor_1, etc.)
  duties: Set<string>; // c1/r1/c2/r2
}

interface Props {
  scheduleId: string;
  scheduleName: string;
  onClose: () => void;
}

const InstructorAssignment = ({ scheduleId, scheduleName, onClose }: Props) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [availableUserIds, setAvailableUserIds] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<AssignmentEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      const [empRes, assignRes, availRes] = await Promise.all([
        supabase.from("employees").select("id, full_name, email, position, user_id").eq("is_active", true),
        supabase.from("instructor_assignments").select("employee_id, assignment_role").eq("schedule_id", scheduleId),
        supabase.from("instructor_availability").select("user_id").eq("schedule_id", scheduleId),
      ]);

      const availUserIds = new Set((availRes.data ?? []).map(a => a.user_id));
      setAvailableUserIds(availUserIds);

      const emps = (empRes.data ?? []) as Employee[];
      emps.sort((a, b) => {
        const aAvail = a.user_id ? availUserIds.has(a.user_id) : false;
        const bAvail = b.user_id ? availUserIds.has(b.user_id) : false;
        if (aAvail && !bAvail) return -1;
        if (!aAvail && bAvail) return 1;
        return a.full_name.localeCompare(b.full_name);
      });
      setEmployees(emps);

      // Group rows by employee: collect primary role + duty codes
      const grouped = new Map<string, AssignmentEntry>();
      (assignRes.data ?? []).forEach(row => {
        const r = row.assignment_role ?? "instructor_1";
        let entry = grouped.get(row.employee_id);
        if (!entry) {
          entry = { employee_id: row.employee_id, role: "instructor_1", duties: new Set() };
          grouped.set(row.employee_id, entry);
        }
        if (DUTY_VALUES.has(r)) entry.duties.add(r);
        else entry.role = r;
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
      setAssignments(prev => [...prev, { employee_id: empId, role: "instructor_1", duties: new Set() }]);
    }
  };

  const setRole = (empId: string, role: string) => {
    setAssignments(prev => prev.map(a => a.employee_id === empId ? { ...a, role } : a));
  };

  const toggleDuty = (empId: string, duty: string) => {
    setAssignments(prev => prev.map(a => {
      if (a.employee_id !== empId) return a;
      const next = new Set(a.duties);
      if (next.has(duty)) next.delete(duty); else next.add(duty);
      return { ...a, duties: next };
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    await supabase.from("instructor_assignments").delete().eq("schedule_id", scheduleId);
    const rows: { schedule_id: string; employee_id: string; assignment_role: string }[] = [];
    assignments.forEach(a => {
      rows.push({ schedule_id: scheduleId, employee_id: a.employee_id, assignment_role: a.role });
      a.duties.forEach(d => {
        rows.push({ schedule_id: scheduleId, employee_id: a.employee_id, assignment_role: d });
      });
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

  const hasAvailability = (emp: Employee) => emp.user_id ? availableUserIds.has(emp.user_id) : false;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
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
            const avail = hasAvailability(emp);
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
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{emp.full_name}</span>
                      {avail && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded-full">
                          <Hand className="w-3 h-3" /> Available
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
                  <div className="px-3 pb-2.5 pl-14 flex items-center gap-2 flex-nowrap">
                    <Select value={entry.role} onValueChange={v => setRole(emp.id, v)}>
                      <SelectTrigger className="h-8 text-xs flex-1 min-w-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map(r => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-1 shrink-0">
                      {DUTIES.map(d => {
                        const active = entry.duties.has(d.value);
                        return (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => toggleDuty(emp.id, d.value)}
                            className={`h-8 w-9 px-0 text-xs font-semibold rounded-md border transition-colors ${
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

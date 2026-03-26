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

const roleLabelMap: Record<string, string> = Object.fromEntries(ROLES.map(r => [r.value, r.label]));

interface Employee {
  id: string;
  full_name: string;
  email: string;
  position: string | null;
  user_id?: string | null;
}

interface Assignment {
  employee_id: string;
  assignment_role: string;
}

interface Props {
  scheduleId: string;
  scheduleName: string;
  onClose: () => void;
}

const InstructorAssignment = ({ scheduleId, scheduleName, onClose }: Props) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [availableUserIds, setAvailableUserIds] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
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
      setAssignments((assignRes.data ?? []).map(a => ({
        employee_id: a.employee_id,
        assignment_role: a.assignment_role ?? "instructor_1",
      })));
    };
    load();
  }, [scheduleId]);

  const isAssigned = (empId: string) => assignments.some(a => a.employee_id === empId);
  const getRole = (empId: string) => assignments.find(a => a.employee_id === empId)?.assignment_role ?? "instructor_1";

  const toggleEmployee = (empId: string) => {
    if (isAssigned(empId)) {
      setAssignments(prev => prev.filter(a => a.employee_id !== empId));
    } else {
      setAssignments(prev => [...prev, { employee_id: empId, assignment_role: "instructor_1" }]);
    }
  };

  const setRole = (empId: string, role: string) => {
    setAssignments(prev => prev.map(a => a.employee_id === empId ? { ...a, assignment_role: role } : a));
  };

  const handleSave = async () => {
    setSaving(true);
    await supabase.from("instructor_assignments").delete().eq("schedule_id", scheduleId);
    if (assignments.length > 0) {
      const rows = assignments.map(a => ({
        schedule_id: scheduleId,
        employee_id: a.employee_id,
        assignment_role: a.assignment_role,
      }));
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
                {assigned && (
                  <div className="px-3 pb-2.5 pl-14">
                    <Select value={getRole(emp.id)} onValueChange={v => setRole(emp.id, v)}>
                      <SelectTrigger className="h-8 text-xs w-52">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map(r => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

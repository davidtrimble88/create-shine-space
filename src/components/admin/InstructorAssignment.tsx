import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Check, Hand } from "lucide-react";

interface Employee {
  id: string;
  full_name: string;
  email: string;
  position: string | null;
}

interface Props {
  scheduleId: string;
  scheduleName: string;
  onClose: () => void;
}

const InstructorAssignment = ({ scheduleId, scheduleName, onClose }: Props) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [availableUserIds, setAvailableUserIds] = useState<Set<string>>(new Set());
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      const [empRes, assignRes, availRes] = await Promise.all([
        supabase.from("employees").select("id, full_name, email, position, user_id").eq("is_active", true),
        supabase.from("instructor_assignments").select("employee_id").eq("schedule_id", scheduleId),
        supabase.from("instructor_availability").select("user_id").eq("schedule_id", scheduleId),
      ]);

      const availUserIds = new Set((availRes.data ?? []).map(a => a.user_id));
      setAvailableUserIds(availUserIds);

      // Sort: available employees first
      const emps = (empRes.data ?? []) as (Employee & { user_id: string | null })[];
      emps.sort((a, b) => {
        const aAvail = a.user_id ? availUserIds.has(a.user_id) : false;
        const bAvail = b.user_id ? availUserIds.has(b.user_id) : false;
        if (aAvail && !bAvail) return -1;
        if (!aAvail && bAvail) return 1;
        return a.full_name.localeCompare(b.full_name);
      });

      setEmployees(emps);
      setAssignedIds(new Set((assignRes.data ?? []).map(a => a.employee_id)));
    };
    load();
  }, [scheduleId]);

  const toggle = (empId: string) => {
    setAssignedIds(prev => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    // Delete all current, re-insert selected
    await supabase.from("instructor_assignments").delete().eq("schedule_id", scheduleId);
    if (assignedIds.size > 0) {
      const rows = [...assignedIds].map(employee_id => ({ schedule_id: scheduleId, employee_id }));
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

  // Check if employee has availability
  const hasAvailability = (emp: Employee & { user_id?: string | null }) => {
    return emp.user_id ? availableUserIds.has(emp.user_id) : false;
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Assign Instructors
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">{scheduleName}</p>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-1 my-4">
          {employees.map((emp: any) => {
            const isAvail = hasAvailability(emp);
            return (
              <button
                key={emp.id}
                onClick={() => toggle(emp.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  assignedIds.has(emp.id) ? "bg-accent/10 border border-accent/30" : "hover:bg-secondary border border-transparent"
                }`}
              >
                <Checkbox checked={assignedIds.has(emp.id)} className="pointer-events-none" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{emp.full_name}</span>
                    {isAvail && (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full">
                        <Hand className="w-3 h-3" /> Available
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{emp.position || emp.email}</span>
                </div>
                {assignedIds.has(emp.id) && <Check className="w-4 h-4 text-accent shrink-0" />}
              </button>
            );
          })}
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : `Save (${assignedIds.size} assigned)`}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default InstructorAssignment;

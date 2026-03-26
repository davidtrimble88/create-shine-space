import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Users, Shield, UserCog, Eye, Crown } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Employee = Tables<"employees">;

interface EmployeeWithRole extends Employee {
  role?: string;
}

const roleIcons: Record<string, typeof Shield> = {
  owner: Crown,
  admin: Shield,
  manager: UserCog,
  employee: Eye,
};

const roleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  employee: "Viewer",
};

const roleColors: Record<string, string> = {
  owner: "bg-amber-500/10 text-amber-400",
  admin: "bg-accent/10 text-accent",
  manager: "bg-blue-500/10 text-blue-400",
  employee: "bg-secondary text-muted-foreground",
};

const AdminEmployees = () => {
  const { userRole } = useAuth();
  const [employees, setEmployees] = useState<EmployeeWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", position: "", role: "employee" });

  // Determine which roles the current user can assign
  const assignableRoles = userRole === "owner"
    ? [
        { value: "owner", label: "Owner — Full access + analytics" },
        { value: "admin", label: "Admin — Full access to everything" },
        { value: "manager", label: "Manager — Can manage schedules" },
        { value: "employee", label: "Viewer — View-only access" },
      ]
    : userRole === "admin"
    ? [
        { value: "manager", label: "Manager — Can manage schedules" },
        { value: "employee", label: "Viewer — View-only access" },
      ]
    : [];

  const canManageRoles = userRole === "owner" || userRole === "admin";
  const { toast } = useToast();

  const fetchEmployees = async () => {
    setLoading(true);
    const { data: empData, error } = await supabase.from("employees").select("*").order("created_at");
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Fetch roles for employees that have user_ids
    const empsWithRoles: EmployeeWithRole[] = (empData ?? []).map(e => ({ ...e, role: "employee" }));
    
    const userIds = empsWithRoles.filter(e => e.user_id).map(e => e.user_id!);
    if (userIds.length > 0) {
      const { data: roles } = await supabase.from("user_roles").select("*").in("user_id", userIds);
      if (roles) {
        for (const role of roles) {
          const emp = empsWithRoles.find(e => e.user_id === role.user_id);
          if (emp) emp.role = role.role;
        }
      }
    }

    setEmployees(empsWithRoles);
    setLoading(false);
  };

  useEffect(() => { fetchEmployees(); }, []);

  const handleSave = async () => {
    if (editingId) {
      const { error } = await supabase.from("employees").update({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || null,
        position: form.position || null,
      }).eq("id", editingId);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }

      // Update role if the employee has a user_id
      const emp = employees.find(e => e.id === editingId);
      if (emp?.user_id) {
        // Remove old roles and set new one
        await supabase.from("user_roles").delete().eq("user_id", emp.user_id);
        await supabase.from("user_roles").insert({ user_id: emp.user_id, role: form.role as any });
      }

      toast({ title: "Updated", description: "Employee updated." });
    } else {
      // Create auth user first, then employee record
      const tempPassword = Math.random().toString(36).slice(-10) + "A1!";
      
      const response = await fetch(`https://tdoyunayplyrmdixhvmn.supabase.co/auth/v1/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          email: form.email,
          password: tempPassword,
          email_confirm: true,
        }),
      });

      // If we can't create auth user via admin API (which requires service role),
      // just create the employee record without auth
      let userId: string | null = null;

      const { data: empData, error } = await supabase.from("employees").insert({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || null,
        position: form.position || null,
        user_id: userId,
      }).select().single();

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }

      toast({
        title: "Employee Added",
        description: `${form.full_name} has been added. They'll need to be set up with portal access separately.`,
      });
    }

    setDialogOpen(false);
    setEditingId(null);
    setForm({ full_name: "", email: "", phone: "", position: "", role: "employee" });
    fetchEmployees();
  };

  const handleEdit = (e: EmployeeWithRole) => {
    setEditingId(e.id);
    setForm({
      full_name: e.full_name,
      email: e.email,
      phone: e.phone ?? "",
      position: e.position ?? "",
      role: e.role ?? "employee",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (emp: EmployeeWithRole) => {
    if (!confirm(`Remove ${emp.full_name}?`)) return;
    const { error } = await supabase.from("employees").delete().eq("id", emp.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Removed", description: `${emp.full_name} has been removed.` });
      fetchEmployees();
    }
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ full_name: "", email: "", phone: "", position: "", role: "employee" });
    setDialogOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Employee Management</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="w-4 h-4 mr-2" /> Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Employee" : "Add New Employee"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Full Name</Label>
                <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="John Doe" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@learntoridevc.com" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 123-4567" />
                </div>
                <div>
                  <Label>Position</Label>
                  <Input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="Instructor" />
                </div>
              </div>
              {canManageRoles && assignableRoles.length > 0 && (
              <div>
                <Label>Access Role</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {assignableRoles.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              )}
              <Button onClick={handleSave} className="w-full">{editingId ? "Save Changes" : "Add Employee"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : employees.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No employees yet. Add your first team member above.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {employees.map((emp) => {
            const RoleIcon = roleIcons[emp.role ?? "employee"] ?? Eye;
            return (
              <div key={emp.id} className="bg-card border border-border rounded-xl p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-foreground font-semibold text-sm">
                    {emp.full_name.split(" ").map(n => n[0]).join("").toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{emp.full_name}</p>
                    <p className="text-sm text-muted-foreground">{emp.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {emp.position && (
                    <span className="text-sm text-muted-foreground">{emp.position}</span>
                  )}
                  <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${roleColors[emp.role ?? "employee"]}`}>
                    <RoleIcon className="w-3 h-3" />
                    {roleLabels[emp.role ?? "employee"]}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(emp)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(emp)} className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminEmployees;

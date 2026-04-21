import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Users, Shield, UserCog, Eye, Crown, Upload, X, KeyRound, Search } from "lucide-react";
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
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", position: "", role: "employee", bio: "", show_on_website: false, photo_position_x: 50, photo_position_y: 50, photo_zoom: 100 });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tempPasswordInfo, setTempPasswordInfo] = useState<{ name: string; email: string; password: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tempPasswordInputRef = useRef<HTMLInputElement>(null);

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

  const uploadPhoto = async (employeeId: string): Promise<string | null> => {
    if (!photoFile) return null;
    
    const fileExt = photoFile.name.split(".").pop();
    const filePath = `${employeeId}.${fileExt}`;
    
    // Delete existing photo if any
    await supabase.storage.from("employee-photos").remove([filePath]);
    
    const { error } = await supabase.storage
      .from("employee-photos")
      .upload(filePath, photoFile, { upsert: true });
    
    if (error) {
      toast({ title: "Photo upload failed", description: error.message, variant: "destructive" });
      return null;
    }
    
    const { data: urlData } = supabase.storage.from("employee-photos").getPublicUrl(filePath);
    return urlData.publicUrl;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setUploading(true);
    
    if (editingId) {
      let photoUrl: string | undefined = undefined;
      if (photoFile) {
        const url = await uploadPhoto(editingId);
        if (url) photoUrl = url;
      }

      const updateData: any = {
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || null,
        position: form.position || null,
        bio: form.bio || null,
        show_on_website: form.show_on_website,
        photo_position_x: form.photo_position_x,
        photo_position_y: form.photo_position_y,
        photo_zoom: form.photo_zoom,
      };
      if (photoUrl) updateData.photo_url = photoUrl;

      const { error } = await supabase.from("employees").update(updateData).eq("id", editingId);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setUploading(false);
        return;
      }

      const emp = employees.find(e => e.id === editingId);
      if (emp?.user_id) {
        await supabase.from("user_roles").delete().eq("user_id", emp.user_id);
        await supabase.from("user_roles").insert({ user_id: emp.user_id, role: form.role as any });
      }

      toast({ title: "Updated", description: "Employee updated." });
    } else {
      const tempPassword = Math.random().toString(36).slice(-10) + "A1!";

      const createRes = await supabase.functions.invoke("create-employee-user", {
        body: { email: form.email, password: tempPassword },
      });

      let userId: string | null = null;
      if (createRes.data?.user_id) {
        userId = createRes.data.user_id;
      } else if (createRes.error) {
        toast({ title: "Error creating login", description: createRes.error.message || "Could not create auth account", variant: "destructive" });
        setUploading(false);
        return;
      }

      const { data: empData, error } = await supabase.from("employees").insert({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || null,
        position: form.position || null,
        bio: form.bio || null,
        show_on_website: form.show_on_website,
        photo_position_x: form.photo_position_x,
        photo_position_y: form.photo_position_y,
        photo_zoom: form.photo_zoom,
        user_id: userId,
        must_change_password: true,
      }).select().single();

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setUploading(false);
        return;
      }

      // Upload photo if selected
      if (photoFile && empData) {
        const url = await uploadPhoto(empData.id);
        if (url) {
          await supabase.from("employees").update({ photo_url: url }).eq("id", empData.id);
        }
      }

      // Assign role if user was created
      if (userId) {
        await supabase.from("user_roles").insert({ user_id: userId, role: form.role as any });
      }

      setTempPasswordInfo({ name: form.full_name, email: form.email, password: tempPassword });

      toast({
        title: "Employee Added",
        description: `${form.full_name} has been added. Share the temporary password with them.`,
      });
    }

    setDialogOpen(false);
    setEditingId(null);
    setForm({ full_name: "", email: "", phone: "", position: "", role: "employee", bio: "", show_on_website: false, photo_position_x: 50, photo_position_y: 50, photo_zoom: 100 });
    setPhotoFile(null);
    setPhotoPreview(null);
    setUploading(false);
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
      bio: (e as any).bio ?? "",
      show_on_website: (e as any).show_on_website ?? false,
      photo_position_x: (e as any).photo_position_x ?? 50,
      photo_position_y: (e as any).photo_position_y ?? 50,
      photo_zoom: (e as any).photo_zoom ?? 100,
    });
    setPhotoPreview((e as any).photo_url ?? null);
    setPhotoFile(null);
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
  const handleResetPassword = async (emp: EmployeeWithRole) => {
    if (!emp.user_id) {
      toast({ title: "No account", description: "This employee doesn't have a login account.", variant: "destructive" });
      return;
    }
    // Admins cannot reset owner passwords
    if (userRole === "admin" && emp.role === "owner") {
      toast({ title: "Not allowed", description: "Admins cannot reset owner passwords.", variant: "destructive" });
      return;
    }
    if (!confirm(`Reset password for ${emp.full_name}? They will receive a temporary password.`)) return;

    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return;

    const { data, error } = await supabase.functions.invoke("reset-user-password", {
      body: { target_user_id: emp.user_id },
    });

    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
      return;
    }

    setTempPasswordInfo({ name: emp.full_name, email: emp.email, password: data.temp_password });
    toast({ title: "Password Reset", description: `Temporary password created for ${emp.full_name}.` });
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ full_name: "", email: "", phone: "", position: "", role: "employee", bio: "", show_on_website: false, photo_position_x: 50, photo_position_y: 50, photo_zoom: 100 });
    setPhotoFile(null);
    setPhotoPreview(null);
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
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Employee" : "Add New Employee"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {/* Photo Upload */}
              <div>
                <Label>Photo</Label>
                <div className="mt-2 flex items-center gap-4">
                  {photoPreview ? (
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full overflow-hidden border border-border">
                        <img
                          src={photoPreview}
                          alt="Preview"
                          className="w-full h-full"
                          style={{
                            objectFit: "cover",
                            objectPosition: `${form.photo_position_x}% ${form.photo_position_y}%`,
                            transform: `scale(${form.photo_zoom / 100})`,
                            transformOrigin: `${form.photo_position_x}% ${form.photo_position_y}%`,
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-20 h-20 rounded-full bg-secondary border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-accent transition-colors"
                    >
                      <Upload className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    {photoPreview ? "Change Photo" : "Upload Photo"}
                  </Button>
                </div>

                {/* Position & Zoom Controls */}
                {photoPreview && (
                  <div className="mt-3 space-y-3 p-3 rounded-lg border border-border bg-secondary/30">
                    <div>
                      <div className="flex justify-between mb-1">
                        <Label className="text-xs">Horizontal Position</Label>
                        <span className="text-xs text-muted-foreground">{form.photo_position_x}%</span>
                      </div>
                      <Slider
                        value={[form.photo_position_x]}
                        onValueChange={([v]) => setForm(f => ({ ...f, photo_position_x: v }))}
                        min={0} max={100} step={1}
                      />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <Label className="text-xs">Vertical Position</Label>
                        <span className="text-xs text-muted-foreground">{form.photo_position_y}%</span>
                      </div>
                      <Slider
                        value={[form.photo_position_y]}
                        onValueChange={([v]) => setForm(f => ({ ...f, photo_position_y: v }))}
                        min={0} max={100} step={1}
                      />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <Label className="text-xs">Zoom</Label>
                        <span className="text-xs text-muted-foreground">{form.photo_zoom}%</span>
                      </div>
                      <Slider
                        value={[form.photo_zoom]}
                        onValueChange={([v]) => setForm(f => ({ ...f, photo_zoom: v }))}
                        min={100} max={300} step={5}
                      />
                    </div>
                  </div>
                )}
              </div>

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

              {/* Bio */}
              <div>
                <Label>Bio</Label>
                <Textarea
                  value={form.bio}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                  placeholder="Brief description of background, riding experience, and teaching philosophy..."
                  rows={3}
                />
              </div>

              {/* Show on Website Toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <Label className="text-sm font-medium">Show on About Page</Label>
                  <p className="text-xs text-muted-foreground">Display this employee on the public website</p>
                </div>
                <Switch
                  checked={form.show_on_website}
                  onCheckedChange={v => setForm(f => ({ ...f, show_on_website: v }))}
                />
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
              <Button onClick={handleSave} className="w-full" disabled={uploading}>
                {uploading ? "Saving..." : editingId ? "Save Changes" : "Add Employee"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {(() => {
        const term = searchTerm.trim().toLowerCase();
        const filteredEmployees = employees.filter(emp => {
          if (roleFilter !== "all" && (emp.role ?? "employee") !== roleFilter) return false;
          if (!term) return true;
          return (
            emp.full_name?.toLowerCase().includes(term) ||
            emp.email?.toLowerCase().includes(term) ||
            (emp.phone ?? "").toLowerCase().includes(term) ||
            (emp.position ?? "").toLowerCase().includes(term)
          );
        });
        if (loading) return <p className="text-muted-foreground">Loading...</p>;
        if (employees.length === 0) {
          return (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No employees yet. Add your first team member above.</p>
            </div>
          );
        }
        if (filteredEmployees.length === 0) {
          return (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No employees match your search or filter.</p>
            </div>
          );
        }
        return (
          <div className="grid gap-4">
            {filteredEmployees.map((emp) => {
            const RoleIcon = roleIcons[emp.role ?? "employee"] ?? Eye;
            return (
              <div key={emp.id} className="bg-card border border-border rounded-xl p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {(emp as any).photo_url ? (
                    <img src={(emp as any).photo_url} alt={emp.full_name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-foreground font-semibold text-sm">
                      {emp.full_name.split(" ").map(n => n[0]).join("").toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{emp.full_name}</p>
                      {(emp as any).show_on_website && (
                        <span className="text-[10px] bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded-full">On Website</span>
                      )}
                    </div>
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
                    {emp.user_id && !(userRole === "admin" && emp.role === "owner") && (
                      <Button variant="ghost" size="sm" onClick={() => handleResetPassword(emp)} title="Reset Password">
                        <KeyRound className="w-4 h-4" />
                      </Button>
                    )}
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

      {/* Temp Password Dialog */}
      <Dialog open={!!tempPasswordInfo} onOpenChange={(open) => { if (!open) setTempPasswordInfo(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Temporary Password Created</DialogTitle>
          </DialogHeader>
          {tempPasswordInfo && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                Share these credentials with <strong className="text-foreground">{tempPasswordInfo.name}</strong>. They will be asked to set a new password on first login.
              </p>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <p className="font-medium text-foreground">{tempPasswordInfo.email}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Temporary Password</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      ref={tempPasswordInputRef}
                      readOnly
                      value={tempPasswordInfo.password}
                      onFocus={(e) => e.currentTarget.select()}
                      onClick={(e) => e.currentTarget.select()}
                      className="font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const input = tempPasswordInputRef.current;
                        if (!input) return;

                        input.focus();
                        input.select();
                        input.setSelectionRange(0, input.value.length);

                        const copied = document.execCommand("copy");

                        if (copied) {
                          toast({ title: "Copied!", description: "Password copied to clipboard." });
                        } else {
                          toast({
                            title: "Select and copy",
                            description: "The password is highlighted — press Ctrl+C or Cmd+C.",
                          });
                        }
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              </div>
              <Button className="w-full" onClick={() => setTempPasswordInfo(null)}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEmployees;

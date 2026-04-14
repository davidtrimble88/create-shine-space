import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, CalendarDays, Hand, UserPlus } from "lucide-react";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import InstructorAssignment, { roleLabelMap } from "./InstructorAssignment";

type Schedule = Tables<"schedules">;

interface AvailabilityInfo {
  schedule_id: string;
  employee_name: string;
  employee_email: string;
}

interface AssignmentInfo {
  schedule_id: string;
  employee_name: string;
  role: string;
}

const courseLabels: Record<string, string> = {
  basic: "Motorcycle Training Course",
  intermediate: "Intermediate Course",
  advanced: "Advanced Riding Clinic",
};

const locationLabels: Record<string, string> = {
  "high-desert": "High Desert — Hesperia",
  "ventura-county": "Ventura County — Somis",
};

const emptyForm: Omit<TablesInsert<"schedules">, "id" | "created_at" | "updated_at" | "created_by"> = {
  date: "",
  course: "basic",
  location: "ventura-county",
  location_label: "Ventura County — Somis",
  group_name: "",
  schedule: "",
  spots_available: 12,
  price: "$425",
};

interface ScheduleTemplate {
  label: string;
  schedule: string;
  group_name: string;
  price: string;
  spots_available: number;
}

const scheduleTemplates: Record<string, ScheduleTemplate[]> = {
  "ventura-county": [
    {
      label: "Group A — Sat & Sun",
      schedule: "Sat 6:45am–5:00pm, Sun 6:45am–5:00pm",
      group_name: "Group A",
      price: "$425",
      spots_available: 12,
    },
    {
      label: "Group B — Fri, Sat & Sun",
      schedule: "Fri 5:45pm–9:30pm, Sat 5:45am–4:30pm, Sun 6:00am–11:30am",
      group_name: "Group B",
      price: "$425",
      spots_available: 12,
    },
    {
      label: "Intermediate — Sat Only",
      schedule: "Sat 7:30am–5:00pm",
      group_name: "",
      price: "$350",
      spots_available: 12,
    },
  ],
  "high-desert": [
    {
      label: "Standard — Wed, Sat & Sun",
      schedule: "Wed 5:45pm–9:30pm, Sat 6:45am–6:00pm, Sun 6:45am–12:00pm",
      group_name: "",
      price: "$425",
      spots_available: 12,
    },
  ],
};

const AdminSchedule = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [availability, setAvailability] = useState<AvailabilityInfo[]>([]);
  const [assignmentData, setAssignmentData] = useState<AssignmentInfo[]>([]);
  const [assigningSchedule, setAssigningSchedule] = useState<{ id: string; name: string } | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const { toast } = useToast();

  const fetchSchedules = async () => {
    setLoading(true);
    let query = supabase.from("schedules").select("*").order("date", { ascending: true });
    if (filterCourse !== "all") query = query.eq("course", filterCourse);
    if (filterLocation !== "all") query = query.eq("location", filterLocation);
    const [schedRes, availRes, assignRes] = await Promise.all([
      query,
      supabase.from("instructor_availability").select("schedule_id, user_id"),
      supabase.from("instructor_assignments").select("schedule_id, employee_id, assignment_role"),
    ]);

    if (schedRes.error) {
      toast({ title: "Error", description: schedRes.error.message, variant: "destructive" });
    } else {
      setSchedules(schedRes.data ?? []);
    }

    // Fetch employee names for availability
    if (availRes.data && availRes.data.length > 0) {
      const userIds = [...new Set(availRes.data.map(a => a.user_id))];
      const { data: employees } = await supabase
        .from("employees")
        .select("user_id, full_name, email")
        .in("user_id", userIds);

      const empMap = new Map((employees ?? []).map(e => [e.user_id, e]));
      setAvailability(
        availRes.data.map(a => ({
          schedule_id: a.schedule_id,
          employee_name: empMap.get(a.user_id)?.full_name ?? "Unknown",
          employee_email: empMap.get(a.user_id)?.email ?? "",
        }))
      );
    } else {
      setAvailability([]);
    }

    // Fetch employee names for assignments
    if (assignRes.data && assignRes.data.length > 0) {
      const empIds = [...new Set(assignRes.data.map(a => a.employee_id))];
      const { data: emps } = await supabase.from("employees").select("id, full_name").in("id", empIds);
      const empNameMap = new Map((emps ?? []).map(e => [e.id, e.full_name]));
      setAssignmentData(
        assignRes.data.map(a => ({
          schedule_id: a.schedule_id,
          employee_name: empNameMap.get(a.employee_id) ?? "Unknown",
          role: a.assignment_role ?? "instructor_1",
        }))
      );
    } else {
      setAssignmentData([]);
    }

    setLoading(false);
  };

  useEffect(() => { fetchSchedules(); }, [filterCourse, filterLocation]);

  const getAvailabilityForSchedule = (scheduleId: string) =>
    availability.filter(a => a.schedule_id === scheduleId);

  const getAssignmentsForSchedule = (scheduleId: string) =>
    assignmentData.filter(a => a.schedule_id === scheduleId);

  const handleLocationChange = (loc: string) => {
    setForm(f => ({ ...f, location: loc, location_label: locationLabels[loc] || loc, schedule: "", group_name: "" }));
    setSelectedTemplate(""); // reset template when location changes
  };


  const handleTemplateChange = (value: string) => {
    setSelectedTemplate(value);
    if (value === "custom") {
      // Keep current form values, let user type freely
      return;
    }
    const templates = scheduleTemplates[form.location] || [];
    const tpl = templates.find(t => t.label === value);
    if (tpl) {
      setForm(f => ({
        ...f,
        schedule: tpl.schedule,
        group_name: tpl.group_name,
        price: tpl.price,
        spots_available: tpl.spots_available,
      }));
    }
  };

  const handleSave = async () => {
    const payload = {
      ...form,
      group_name: form.group_name || null,
      spots_available: Number(form.spots_available),
    };

    if (editingId) {
      const { error } = await supabase.from("schedules").update(payload).eq("id", editingId);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Updated", description: "Schedule updated successfully." });
    } else {
      const { error } = await supabase.from("schedules").insert(payload);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Added", description: "New class added successfully." });
    }

    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    fetchSchedules();
  };

  const handleEdit = (s: Schedule) => {
    setEditingId(s.id);
    setForm({
      date: s.date,
      course: s.course,
      location: s.location,
      location_label: s.location_label,
      group_name: s.group_name ?? "",
      schedule: s.schedule,
      spots_available: s.spots_available,
      price: s.price,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this class?")) return;
    const { error } = await supabase.from("schedules").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Class removed." });
      fetchSchedules();
    }
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSelectedTemplate("");
    setDialogOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Schedule Management</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="w-4 h-4 mr-2" /> Add Class
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Class" : "Add New Class"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <Label>Course</Label>
                  <Select value={form.course} onValueChange={v => setForm(f => ({ ...f, course: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Motorcycle Training Course</SelectItem>
                      <SelectItem value="intermediate">Intermediate Course</SelectItem>
                      <SelectItem value="advanced">Advanced Riding Clinic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Location</Label>
                  <Select value={form.location} onValueChange={handleLocationChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high-desert">High Desert — Hesperia</SelectItem>
                      <SelectItem value="ventura-county">Ventura County — Somis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Group (optional)</Label>
                  <Input value={form.group_name ?? ""} onChange={e => setForm(f => ({ ...f, group_name: e.target.value }))} placeholder="e.g. Group A" />
                </div>
              </div>
              <div>
                <Label>Schedule Template</Label>
                <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                  <SelectTrigger><SelectValue placeholder="Select a preset..." /></SelectTrigger>
                  <SelectContent>
                    {(scheduleTemplates[form.location] || []).map(t => (
                      <SelectItem key={t.label} value={t.label}>{t.label}</SelectItem>
                    ))}
                    <SelectItem value="custom">✏️ Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Schedule Description</Label>
                <Input value={form.schedule} onChange={e => setForm(f => ({ ...f, schedule: e.target.value }))} placeholder="e.g. Sat 6:45am–5:00pm, Sun 6:45am–5:00pm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Spots Available</Label>
                  <Input type="number" min={0} value={form.spots_available} onChange={e => setForm(f => ({ ...f, spots_available: parseInt(e.target.value) || 0 }))} />
                </div>
                <div>
                  <Label>Price</Label>
                  <Input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="$425" />
                </div>
              </div>
              <Button onClick={handleSave} className="w-full">{editingId ? "Save Changes" : "Add Class"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <Select value={filterCourse} onValueChange={setFilterCourse}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Courses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Courses</SelectItem>
            <SelectItem value="basic">Basic</SelectItem>
            <SelectItem value="intermediate">Intermediate</SelectItem>
            <SelectItem value="advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterLocation} onValueChange={setFilterLocation}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Locations" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            <SelectItem value="high-desert">High Desert</SelectItem>
            <SelectItem value="ventura-county">Ventura County</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : schedules.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No classes found. Add your first class above.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left p-4 font-medium text-muted-foreground">Date</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Course</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Location</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Group</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Schedule</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Spots</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Price</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Assigned</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Available</th>
                <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/10">
                  <td className="p-4 text-foreground">{new Date(s.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      s.course === "basic" ? "bg-accent/10 text-accent" :
                      s.course === "intermediate" ? "bg-blue-500/10 text-blue-400" :
                      "bg-purple-500/10 text-purple-400"
                    }`}>
                      {courseLabels[s.course] || s.course}
                    </span>
                  </td>
                  <td className="p-4 text-foreground">{s.location_label}</td>
                  <td className="p-4 text-muted-foreground">{s.group_name || "—"}</td>
                  <td className="p-4 text-muted-foreground text-xs">{s.schedule}</td>
                  <td className="p-4">
                    <span className={`font-medium ${s.spots_available === 0 ? "text-destructive" : "text-green-400"}`}>
                      {s.spots_available === 0 ? "Full" : s.spots_available}
                    </span>
                  </td>
                  <td className="p-4 text-foreground">{s.price}</td>
                  <td className="p-4">
                    {(() => {
                      const assigned = getAssignmentsForSchedule(s.id);
                      if (assigned.length === 0) return <span className="text-muted-foreground text-xs italic">Not assigned</span>;
                      return (
                        <div className="space-y-1">
                          {assigned.map((a, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                                {roleLabelMap[a.role] || a.role}
                              </span>
                              <span className="text-xs text-foreground">{a.employee_name}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="p-4">
                    {(() => {
                      const avail = getAvailabilityForSchedule(s.id);
                      if (avail.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
                      return (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="flex items-center gap-1.5 text-green-400 hover:text-green-300 transition-colors">
                              <Hand className="w-4 h-4" />
                              <span className="text-sm font-medium">{avail.length}</span>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-3" align="start">
                            <p className="text-xs font-semibold text-foreground mb-2">Available to Teach</p>
                            <div className="space-y-2">
                              {avail.map((a, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-green-500/15 flex items-center justify-center text-green-400 text-xs font-bold">
                                    {a.employee_name.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="text-sm text-foreground">{a.employee_name}</p>
                                    <p className="text-xs text-muted-foreground">{a.employee_email}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      );
                    })()}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setAssigningSchedule({
                        id: s.id,
                        name: `${courseLabels[s.course] || s.course} — ${new Date(s.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}${s.group_name ? ` (${s.group_name})` : ""}`
                      })} title="Assign instructors">
                        <UserPlus className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(s)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {assigningSchedule && (
        <InstructorAssignment
          scheduleId={assigningSchedule.id}
          scheduleName={assigningSchedule.name}
          onClose={() => { setAssigningSchedule(null); fetchSchedules(); }}
        />
      )}
    </div>
  );
};

export default AdminSchedule;

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Printer, Mail, CalendarDays, History, ArrowLeft } from "lucide-react";
import { roleLabelMap } from "./InstructorAssignment";

interface ScheduleRow {
  id: string;
  date: string;
  course: string;
  location: string;
  location_label: string;
  group_name: string | null;
  schedule: string;
  spots_available: number;
  price: string;
  instructors: { name: string; role: string; employeeId: string }[];
}

const courseLabels: Record<string, string> = {
  basic: "Motorcycle Training Course",
  intermediate: "Intermediate Course",
  advanced: "Advanced Riding Clinic",
};

const ComprehensiveSchedule = () => {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLocation, setFilterLocation] = useState("all");
  const [filterCourse, setFilterCourse] = useState("all");
  const [filterInstructor, setFilterInstructor] = useState("all");
  const [view, setView] = useState<"upcoming" | "past">("upcoming");
  const [instructorList, setInstructorList] = useState<{ id: string; name: string }[]>([]);
  const printRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const today = new Date().toISOString().split("T")[0];
      let query = supabase.from("schedules").select("*");
      if (view === "past") {
        query = query.lt("date", today).order("date", { ascending: false });
      } else {
        query = query.gte("date", today).is("cancelled_at", null).order("date", { ascending: true });
      }
      if (filterCourse !== "all") query = query.eq("course", filterCourse);
      if (filterLocation !== "all") query = query.eq("location", filterLocation);

      const [schedRes, assignRes] = await Promise.all([
        query,
        supabase.from("instructor_assignments").select("schedule_id, employee_id, assignment_role"),
      ]);

      if (schedRes.error) { setLoading(false); return; }

      const empIds = [...new Set((assignRes.data ?? []).map(a => a.employee_id))];
      let empMap = new Map<string, string>();
      if (empIds.length > 0) {
        const { data: emps } = await supabase.from("employees").select("id, full_name").in("id", empIds);
        empMap = new Map((emps ?? []).map(e => [e.id, e.full_name]));
        setInstructorList((emps ?? []).map(e => ({ id: e.id, name: e.full_name })).sort((a, b) => a.name.localeCompare(b.name)));
      }

      const assignMap = new Map<string, { name: string; role: string; employeeId: string }[]>();
      for (const a of assignRes.data ?? []) {
        const name = empMap.get(a.employee_id) ?? "Unknown";
        if (!assignMap.has(a.schedule_id)) assignMap.set(a.schedule_id, []);
        assignMap.get(a.schedule_id)!.push({ name, role: a.assignment_role ?? "instructor_1", employeeId: a.employee_id });
      }

      setRows(
        (schedRes.data ?? []).map(s => ({
          ...s,
          instructors: assignMap.get(s.id) ?? [],
        }))
      );
      setLoading(false);
    };
    load();
    const interval = setInterval(load, 300000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [filterCourse, filterLocation, view]);

  const filteredRows = filterInstructor === "all"
    ? rows
    : rows.filter(r => r.instructors.some(i => i.employeeId === filterInstructor));

  // Group by location
  const groupedByLocation = filteredRows.reduce<Record<string, ScheduleRow[]>>((acc, r) => {
    const key = r.location_label;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Schedule</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #1a1a1a; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        h2 { font-size: 16px; margin: 20px 0 8px; color: #333; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
        th { background: #f3f4f6; text-align: left; padding: 8px; border: 1px solid #d1d5db; font-weight: 600; }
        td { padding: 8px; border: 1px solid #d1d5db; }
        .subtitle { font-size: 12px; color: #666; margin-bottom: 16px; }
        .no-instructor { color: #999; font-style: italic; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>Learn to Ride VC — Comprehensive Schedule</h1>
      <p class="subtitle">Generated ${formatPSTDate(new Date(), { month: "long", day: "numeric", year: "numeric" })}</p>
      ${content.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const handleEmail = async () => {
    const subject = encodeURIComponent("Learn to Ride VC — Schedule");
    let body = "Learn to Ride VC — Comprehensive Schedule\n\n";
    for (const [loc, items] of Object.entries(groupedByLocation)) {
      body += `📍 ${loc}\n`;
      body += "─".repeat(50) + "\n";
      for (const r of items) {
        const d = new Date(r.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
        body += `${d} | ${courseLabels[r.course] || r.course}${r.group_name ? ` (${r.group_name})` : ""}\n`;
        body += `  Schedule: ${r.schedule}\n`;
        body += `  Instructors: ${r.instructors.length > 0 ? r.instructors.map(i => `${roleLabelMap[i.role] || i.role}: ${i.name}`).join(", ") : "Not assigned"}\n`;
        body += `  Spots: ${r.spots_available} | Price: ${r.price}\n\n`;
      }
    }
    window.open(`mailto:?subject=${subject}&body=${encodeURIComponent(body)}`);
    toast({ title: "Email", description: "Email client opened with schedule." });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-foreground">
          {view === "past" ? "Past Schedule" : "Comprehensive Schedule"}
        </h1>
        <div className="flex gap-2">
          {view === "upcoming" ? (
            <Button variant="outline" size="sm" onClick={() => setView("past")}>
              <History className="w-4 h-4 mr-2" /> Past Classes
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setView("upcoming")}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Upcoming
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleEmail}>
            <Mail className="w-4 h-4 mr-2" /> Email
          </Button>
        </div>
      </div>

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
            <SelectItem value="high-desert-hesperia">High Desert — Hesperia</SelectItem>
            <SelectItem value="high-desert-wrightwood">High Desert — Wrightwood</SelectItem>
            <SelectItem value="ventura-county">Ventura County</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterInstructor} onValueChange={setFilterInstructor}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Instructors" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Instructors</SelectItem>
            {instructorList.map(i => (
              <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : filteredRows.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No classes found.</p>
        </div>
      ) : (
        <div ref={printRef}>
          {Object.entries(groupedByLocation).map(([loc, items]) => (
            <div key={loc} className="mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-3 border-b border-border pb-2">📍 {loc}</h2>
              <div className="bg-card border border-border rounded-xl overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">

                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Course</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Group</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Schedule</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Instructors</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Spots</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(r => (
                      <tr
                        key={r.id}
                        className="border-b border-border/50 cursor-pointer hover:bg-secondary/40 transition-colors"
                        onClick={() => {
                          sessionStorage.setItem(
                            "openRosterSchedule",
                            JSON.stringify({ id: r.id, date: r.date })
                          );
                          window.dispatchEvent(new CustomEvent("openRoster"));
                        }}
                        title="Click to view this class roster"
                      >
                        <td className="p-3 text-foreground whitespace-nowrap">
                          {new Date(r.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            r.course === "basic" ? "bg-accent/10 text-accent" :
                            r.course === "intermediate" ? "bg-blue-500/10 text-blue-400" :
                            "bg-purple-500/10 text-purple-400"
                          }`}>
                            {courseLabels[r.course] || r.course}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">{r.group_name || "—"}</td>
                        <td className="p-3 text-muted-foreground text-xs">{r.schedule}</td>
                        <td className="p-3">
                          {r.instructors.length > 0 ? (() => {
                            const DUTY_CODES = new Set(["c1", "r1", "c2", "r2"]);
                            const dutyOrder = ["c1", "r1", "c2", "r2"];
                            const grouped = new Map<string, { name: string; role: string; duties: string[] }>();
                            r.instructors.forEach(inst => {
                              let entry = grouped.get(inst.employeeId);
                              if (!entry) {
                                entry = { name: inst.name, role: "instructor_1", duties: [] };
                                grouped.set(inst.employeeId, entry);
                              }
                              if (DUTY_CODES.has(inst.role)) entry.duties.push(inst.role);
                              else entry.role = inst.role;
                            });
                            return (
                              <div className="space-y-1.5">
                                {Array.from(grouped.entries()).map(([empId, entry]) => (
                                  <div key={empId} className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                                      {roleLabelMap[entry.role] || entry.role}
                                    </span>
                                    <span className="text-xs text-foreground">{entry.name}</span>
                                    {entry.duties.length > 0 && (
                                      <div className="flex gap-1 ml-1">
                                        {dutyOrder.filter(d => entry.duties.includes(d)).map(d => (
                                          <span key={d} className="text-[10px] font-semibold text-accent-foreground bg-accent px-1.5 py-0.5 rounded">
                                            {roleLabelMap[d] || d.toUpperCase()}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            );
                          })() : (
                            <span className="text-xs text-muted-foreground italic">Not assigned</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`font-medium ${r.spots_available === 0 ? "text-destructive" : "text-green-400"}`}>
                            {r.spots_available === 0 ? "Full" : r.spots_available}
                          </span>
                        </td>
                        <td className="p-3 text-foreground">{r.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ComprehensiveSchedule;

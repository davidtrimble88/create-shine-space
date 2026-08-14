import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, CalendarDays, CalendarPlus, Users, CalendarCheck } from "lucide-react";
import { format, parseISO } from "date-fns";

const courseLabels: Record<string, string> = {
  basic: "Motorcyclist Training Course",
  intermediate: "Intermediate Course",
  advanced: "Advanced Riding Clinic",
};

const placeholderLabels: Record<string, string> = {
  "high-desert-hesperia": "High Desert — Hesperia",
  "high-desert-wrightwood": "High Desert — Wrightwood",
  "ventura-county-a": "Ventura — Group A (Sat/Sun)",
  "ventura-county-b": "Ventura — Group B (Fri/Sat/Sun)",
  "ventura-county": "Ventura County — Somis",
};

const roleDisplay: Record<string, string> = {
  c1: "C1",
  r1: "R1",
  c2: "C2",
  r2: "R2",
  instructor_1: "Instructor 1",
  instructor_2: "Instructor 2",
  range_asst: "Range Assistant",
  candidate: "Candidate",
};

interface ClassRow {
  scheduleId: string;
  date: string;
  label: string;
  locationLabel: string;
  parts: string[] | null; // null = full class
}

interface DateRow {
  date: string;
  locationLabel: string;
}

interface AssignmentSession {
  sessionKey: string;
  scheduleIds: string[];
  dates: string[];
  label: string;
  locationLabel: string;
  scheduleText: string;
  roles: string[];
}

interface InstructorReport {
  employeeId: string;
  name: string;
  classes: ClassRow[];
  dates: DateRow[];
  assignmentSessions: AssignmentSession[];
}

interface Props {
  onClose: () => void;
}

const formatRole = (role: string) => roleDisplay[role] ?? role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

const AvailabilityReport = ({ onClose }: Props) => {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<InstructorReport[]>([]);

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split("T")[0];
      const [empRes, schedRes, availRes, dateAvailRes, assignRes] = await Promise.all([
        supabase.from("employees").select("id, full_name, user_id, is_active").eq("is_active", true),
        supabase.from("schedules").select("*").gte("date", today).is("cancelled_at", null).order("date"),
        supabase.from("instructor_availability").select("schedule_id, user_id, parts"),
        supabase.from("instructor_date_availability").select("user_id, date, location").gte("date", today),
        supabase.from("instructor_assignments").select("schedule_id, employee_id, assignment_role, part").gte("created_at", "2025-01-01"),
      ]);

      const employees = (empRes.data ?? []).filter(e => e.user_id);
      const schedById = new Map((schedRes.data ?? []).map(s => [s.id, s]));
      const employeeById = new Map((empRes.data ?? []).map(e => [e.id, e]));

      // Group schedule rows into class sessions (multi-day classes share the same schedule pattern).
      const sessionByKey = new Map<string, { scheduleIds: string[]; dates: string[]; schedule: any }>();
      (schedRes.data ?? []).forEach((s: any) => {
        const key = `${s.course}|${s.location}|${s.group_name || ""}|${s.schedule}`;
        if (!sessionByKey.has(key)) {
          sessionByKey.set(key, { scheduleIds: [], dates: [], schedule: s });
        }
        const session = sessionByKey.get(key)!;
        session.scheduleIds.push(s.id);
        session.dates.push(s.date);
      });
      sessionByKey.forEach(s => s.dates.sort());

      const scheduleIdToSessionKey = new Map<string, string>();
      sessionByKey.forEach((session, key) => {
        session.scheduleIds.forEach(id => scheduleIdToSessionKey.set(id, key));
      });

      const byUser = new Map<string, InstructorReport>();
      employees.forEach(e => {
        byUser.set(e.user_id as string, {
          employeeId: e.id,
          name: e.full_name,
          classes: [],
          dates: [],
          assignmentSessions: [],
        });
      });

      (availRes.data ?? []).forEach((a: any) => {
        const rep = byUser.get(a.user_id);
        const s = schedById.get(a.schedule_id);
        if (!rep || !s) return;
        rep.classes.push({
          scheduleId: s.id,
          date: s.date,
          label: `${courseLabels[s.course] || s.course}${s.group_name ? ` (${s.group_name})` : ""}`,
          locationLabel: s.location_label,
          parts: (a.parts as string[] | null) ?? null,
        });
      });

      (dateAvailRes.data ?? []).forEach((d: any) => {
        const rep = byUser.get(d.user_id);
        if (!rep) return;
        rep.dates.push({
          date: d.date,
          locationLabel: placeholderLabels[d.location] ?? d.location,
        });
      });

      (assignRes.data ?? []).forEach((a: any) => {
        const emp = employeeById.get(a.employee_id);
        if (!emp || !emp.user_id) return;
        const rep = byUser.get(emp.user_id as string);
        const s = schedById.get(a.schedule_id);
        if (!rep || !s) return;
        const sessionKey = scheduleIdToSessionKey.get(a.schedule_id);
        if (!sessionKey) return;
        let session = rep.assignmentSessions.find(x => x.sessionKey === sessionKey);
        if (!session) {
          const sessionData = sessionByKey.get(sessionKey)!;
          session = {
            sessionKey,
            scheduleIds: sessionData.scheduleIds,
            dates: sessionData.dates,
            label: `${courseLabels[s.course] || s.course}${s.group_name ? ` (${s.group_name})` : ""}`,
            locationLabel: s.location_label,
            scheduleText: s.schedule,
            roles: [],
          };
          rep.assignmentSessions.push(session);
        }
        const role = a.assignment_role ?? "Instructor";
        if (!session.roles.includes(role)) session.roles.push(role);
      });

      const list = Array.from(byUser.values()).map(r => ({
        ...r,
        classes: r.classes.sort((a, b) => a.date.localeCompare(b.date)),
        dates: r.dates.sort((a, b) => a.date.localeCompare(b.date) || a.locationLabel.localeCompare(b.locationLabel)),
        assignmentSessions: r.assignmentSessions.sort((a, b) => a.dates[0].localeCompare(b.dates[0])),
      }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setReports(list);
      setLoading(false);
    };
    load();
  }, []);

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const summaryRows = reports.map(r => `
      <tr>
        <td>${r.name}</td>
        <td class="num">${r.assignmentSessions.length}</td>
        <td class="num">${r.classes.length}</td>
        <td class="num">${r.dates.length}</td>
      </tr>
    `).join("");
    const rowsHtml = reports.map(r => `
      <h2>${r.name}</h2>
      <p class="sub">${r.assignmentSessions.length} scheduled class(es) · ${r.classes.length} availability class(es) · ${r.dates.length} placeholder day(s)</p>
      ${r.assignmentSessions.length === 0 && r.classes.length === 0 && r.dates.length === 0 ? '<p class="none">No availability or assignments submitted.</p>' : ""}
      ${r.assignmentSessions.length > 0 ? `<table><tr><th>Dates</th><th>Class</th><th>Location</th><th>Schedule</th><th>Roles</th></tr>
        ${r.assignmentSessions.map(s => `<tr>
          <td>${s.dates.map(d => format(parseISO(d), "EEE, MMM d")).join(" · ")}</td>
          <td>${s.label}</td>
          <td>${s.locationLabel}</td>
          <td>${s.scheduleText}</td>
          <td>${s.roles.map(formatRole).join(", ")}</td>
        </tr>`).join("")}
      </table>` : ""}
      ${r.classes.length > 0 ? `<table><tr><th>Date</th><th>Class</th><th>Location</th><th>Available for</th></tr>
        ${r.classes.map(c => `<tr><td>${format(parseISO(c.date), "EEE, MMM d, yyyy")}</td><td>${c.label}</td><td>${c.locationLabel}</td><td>${c.parts === null ? "Full class" : c.parts.join(", ")}</td></tr>`).join("")}
      </table>` : ""}
      ${r.dates.length > 0 ? `<table><tr><th>Placeholder Date</th><th>Location</th></tr>
        ${r.dates.map(d => `<tr><td>${format(parseISO(d.date), "EEE, MMM d, yyyy")}</td><td>${d.locationLabel}</td></tr>`).join("")}
      </table>` : ""}
    `).join("");
    win.document.write(`<html><head><title>Instructor Availability</title><style>
      body{font-family:Arial,sans-serif;padding:20px;color:#1a1a1a}
      h1{font-size:20px;margin-bottom:4px}
      h2{font-size:15px;margin:18px 0 2px;border-bottom:2px solid #e5e7eb;padding-bottom:3px}
      .sub{font-size:11px;color:#666;margin:0 0 6px}
      .none{font-size:12px;color:#999;font-style:italic}
      table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:11px}
      th{background:#f3f4f6;text-align:left;padding:6px;border:1px solid #d1d5db}
      td{padding:6px;border:1px solid #d1d5db;vertical-align:top}
      td.num{text-align:center}
      .summary-box{border:1px solid #d1d5db;padding:12px;margin-bottom:16px;background:#fafafa}
      .summary-title{font-size:14px;font-weight:bold;margin-bottom:8px}
    </style></head><body>
      <h1>Instructor Availability Report</h1>
      <p class="sub">Generated ${format(new Date(), "MMMM d, yyyy")}</p>
      <div class="summary-box">
        <div class="summary-title">Summary — Scheduled Classes per Instructor</div>
        <table>
          <tr><th>Instructor</th><th class="num">Scheduled Classes</th><th class="num">Available Classes</th><th class="num">Placeholder Days</th></tr>
          ${summaryRows}
        </table>
      </div>
      ${rowsHtml}
    </body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-accent" /> Instructor Availability Report
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-accent" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" /> Print
              </Button>
            </div>

            {reports.length === 0 && (
              <p className="text-muted-foreground text-sm">No active instructors found.</p>
            )}

            {reports.length > 0 && (
              <div className="border border-border rounded-xl p-4 bg-card">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarCheck className="w-5 h-5 text-accent" />
                  <h3 className="font-bold text-foreground">Summary — Scheduled Classes per Instructor</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 font-semibold text-foreground">Instructor</th>
                        <th className="text-center py-2 px-3 font-semibold text-foreground">Scheduled Classes</th>
                        <th className="text-center py-2 px-3 font-semibold text-foreground">Available Classes</th>
                        <th className="text-center py-2 px-3 font-semibold text-foreground">Placeholder Days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map(r => (
                        <tr key={`summary-${r.employeeId}`} className="border-b border-border/50 last:border-0">
                          <td className="py-2 px-3 text-foreground">{r.name}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-medium ${r.assignmentSessions.length > 0 ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"}`}>
                              {r.assignmentSessions.length}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                              {r.classes.length}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                              {r.dates.length}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {reports.map(r => (
              <div key={r.employeeId} className="border border-border rounded-xl p-4 bg-card">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <h3 className="font-bold text-foreground">{r.name}</h3>
                  <div className="flex gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                      {r.assignmentSessions.length} scheduled
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400">
                      {r.classes.length} available
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {r.dates.length} placeholder day{r.dates.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                {r.assignmentSessions.length === 0 && r.classes.length === 0 && r.dates.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">No availability or assignments submitted.</p>
                )}

                {r.assignmentSessions.length > 0 && (
                  <div className="space-y-3 mb-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Scheduled classes</p>
                    {r.assignmentSessions.map(s => (
                      <div key={s.sessionKey} className="bg-background/50 border border-border/60 rounded-lg p-3">
                        <div className="flex items-start gap-2 text-sm mb-1">
                          <CalendarCheck className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="text-foreground font-medium">
                              {s.dates.map(d => format(parseISO(d), "EEE, MMM d")).join(" · ")}
                            </div>
                            <div className="text-muted-foreground">
                              {s.label} · {s.locationLabel}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {s.scheduleText}
                            </div>
                          </div>
                        </div>
                        <div className="pl-6 text-xs">
                          <span className="text-muted-foreground">Scheduled for: </span>
                          <span className="text-accent font-medium">
                            {s.roles.map(formatRole).join(" · ")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {r.classes.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Availability</p>
                    {r.classes.map(c => (
                      <div key={c.scheduleId} className="flex items-start gap-2 text-sm">
                        <CalendarDays className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-foreground font-medium">{format(parseISO(c.date), "EEE, MMM d, yyyy")}</span>
                          <span className="text-muted-foreground"> — {c.label} · {c.locationLabel}</span>
                          <div className="text-xs text-green-400">
                            {c.parts === null ? "Available: full class" : `Available: ${c.parts.join(", ")}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {r.dates.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Placeholder dates</p>
                    <div className="flex flex-wrap gap-1.5">
                      {r.dates.map(d => (
                        <span key={`${d.date}-${d.locationLabel}`} className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground inline-flex items-center gap-1">
                          <CalendarPlus className="w-3 h-3 text-muted-foreground" />
                          {format(parseISO(d.date), "EEE, MMM d")} · {d.locationLabel}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AvailabilityReport;

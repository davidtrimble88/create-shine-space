import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, MapPin } from "lucide-react";
import { format } from "date-fns";
import { formatClassDates } from "@/lib/classDates";

const courseLabels: Record<string, string> = {
  basic: "Motorcyclist Training Course",
  intermediate: "Intermediate Riding Clinic",
  "1dpc": "1-Day Premier Course",
  advanced: "Advanced Riding Clinic",
};

/** Report buckets used for the side-by-side summary. */
const CATEGORIES = ["MTC", "IRC/1DPC", "ARC"] as const;
type Category = typeof CATEGORIES[number];

const categoryFor = (course: string): Category | null => {
  const c = (course || "").toLowerCase();
  if (c === "basic" || c.includes("mtc")) return "MTC";
  if (c === "intermediate" || c === "1dpc" || c.includes("irc")) return "IRC/1DPC";
  if (c === "advanced" || c.includes("arc")) return "ARC";
  return null;
};

interface ClassRow {
  id: string;
  date: string;
  scheduleText: string;
  course: string;
  groupName: string | null;
  category: Category | null;
}

interface SiteReport {
  location: string;
  label: string;
  counts: Record<Category, number>;
  total: number;
  classes: ClassRow[];
}

interface Props {
  onClose: () => void;
}

const SiteCoverageReport = ({ onClose }: Props) => {
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<SiteReport[]>([]);

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("schedules")
        .select("id, date, course, location, location_label, group_name, schedule")
        .gte("date", today)
        .is("cancelled_at", null)
        .order("date");

      const bySite = new Map<string, SiteReport>();
      (data ?? []).forEach((s: any) => {
        if (!bySite.has(s.location)) {
          bySite.set(s.location, {
            location: s.location,
            label: s.location_label,
            counts: { MTC: 0, "IRC/1DPC": 0, ARC: 0 },
            total: 0,
            classes: [],
          });
        }
        const site = bySite.get(s.location)!;
        const category = categoryFor(s.course);
        if (category) site.counts[category] += 1;
        site.total += 1;
        site.classes.push({
          id: s.id,
          date: s.date,
          scheduleText: s.schedule,
          course: s.course,
          groupName: s.group_name,
          category,
        });
      });

      const list = Array.from(bySite.values()).sort((a, b) => a.label.localeCompare(b.label));
      setSites(list);
      setLoading(false);
    };
    load();
  }, []);

  const totals = CATEGORIES.reduce(
    (acc, c) => ({ ...acc, [c]: sites.reduce((n, s) => n + s.counts[c], 0) }),
    {} as Record<Category, number>,
  );

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const summaryHead = `<tr><th>Location</th>${CATEGORIES.map(c => `<th class="num">${c}</th>`).join("")}<th class="num">Total</th></tr>`;
    const summaryRows = sites.map(s => `
      <tr>
        <td>${s.label}</td>
        ${CATEGORIES.map(c => `<td class="num">${s.counts[c]}</td>`).join("")}
        <td class="num"><strong>${s.total}</strong></td>
      </tr>`).join("");
    const totalRow = `<tr><td><strong>All locations</strong></td>${CATEGORIES.map(c => `<td class="num"><strong>${totals[c]}</strong></td>`).join("")}<td class="num"><strong>${sites.reduce((n, s) => n + s.total, 0)}</strong></td></tr>`;

    const detail = sites.map(s => `
      <h2>${s.label}</h2>
      <p class="sub">${CATEGORIES.map(c => `${c}: ${s.counts[c]}`).join(" · ")} · Total: ${s.total}</p>
      ${s.classes.length === 0 ? '<p class="none">No upcoming classes scheduled.</p>' : `
      <table>
        <tr><th>Dates</th><th>Course</th><th>Type</th><th>Schedule</th></tr>
        ${s.classes.map(c => `<tr>
          <td>${formatClassDates(c.date, c.scheduleText)}</td>
          <td>${courseLabels[c.course] || c.course}${c.groupName ? ` (${c.groupName})` : ""}</td>
          <td>${c.category ?? "—"}</td>
          <td>${c.scheduleText}</td>
        </tr>`).join("")}
      </table>`}
    `).join("");

    win.document.write(`<html><head><title>Schedule Coverage by Location</title><style>
      body{font-family:Arial,sans-serif;padding:20px;color:#1a1a1a}
      h1{font-size:20px;margin-bottom:4px}
      h2{font-size:15px;margin:18px 0 2px;border-bottom:2px solid #e5e7eb;padding-bottom:3px}
      .sub{font-size:11px;color:#666;margin:0 0 6px}
      .none{font-size:12px;color:#999;font-style:italic}
      table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:11px}
      th{background:#f3f4f6;text-align:left;padding:6px;border:1px solid #d1d5db}
      td{padding:6px;border:1px solid #d1d5db;vertical-align:top}
      td.num,th.num{text-align:center}
      .summary-box{border:1px solid #d1d5db;padding:12px;margin-bottom:16px;background:#fafafa}
      .summary-title{font-size:14px;font-weight:bold;margin-bottom:8px}
    </style></head><body>
      <h1>Schedule Coverage by Location</h1>
      <p class="sub">Upcoming classes · Generated ${format(new Date(), "MMMM d, yyyy")}</p>
      <div class="summary-box">
        <div class="summary-title">Summary — Classes per Location</div>
        <table>${summaryHead}${summaryRows}${totalRow}</table>
      </div>
      ${detail}
    </body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-accent" /> Schedule Coverage by Location
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

            {sites.length === 0 && (
              <p className="text-sm text-muted-foreground">No upcoming classes on the schedule.</p>
            )}

            {sites.length > 0 && (
              <div className="border border-border rounded-xl p-4 bg-card">
                <h3 className="font-bold text-foreground mb-3">Summary — Classes per Location</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 font-semibold text-foreground">Location</th>
                        {CATEGORIES.map(c => (
                          <th key={c} className="text-center py-2 px-3 font-semibold text-foreground">{c}</th>
                        ))}
                        <th className="text-center py-2 px-3 font-semibold text-foreground">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sites.map(s => (
                        <tr key={s.location} className="border-b border-border/50">
                          <td className="py-2 px-3 text-foreground">{s.label}</td>
                          {CATEGORIES.map(c => (
                            <td key={c} className="py-2 px-3 text-center">
                              <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-medium ${s.counts[c] > 0 ? "bg-accent/20 text-accent" : "bg-destructive/15 text-destructive"}`}>
                                {s.counts[c]}
                              </span>
                            </td>
                          ))}
                          <td className="py-2 px-3 text-center font-semibold text-foreground">{s.total}</td>
                        </tr>
                      ))}
                      <tr>
                        <td className="py-2 px-3 font-semibold text-foreground">All locations</td>
                        {CATEGORIES.map(c => (
                          <td key={c} className="py-2 px-3 text-center font-semibold text-foreground">{totals[c]}</td>
                        ))}
                        <td className="py-2 px-3 text-center font-semibold text-foreground">
                          {sites.reduce((n, s) => n + s.total, 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Red counts mark a course type with nothing scheduled at that site.
                </p>
              </div>
            )}

            {sites.map(s => (
              <div key={`detail-${s.location}`} className="border border-border rounded-xl p-4 bg-card">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <h3 className="font-bold text-foreground">{s.label}</h3>
                  <div className="flex gap-2 text-xs">
                    {CATEGORIES.map(c => (
                      <span key={c} className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {c}: {s.counts[c]}
                      </span>
                    ))}
                  </div>
                </div>
                {s.classes.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No upcoming classes scheduled.</p>
                ) : (
                  <div className="space-y-2">
                    {s.classes.map(c => (
                      <div key={c.id} className="bg-background/50 border border-border/60 rounded-lg p-3 text-sm">
                        <div className="text-foreground font-medium">{formatClassDates(c.date, c.scheduleText)}</div>
                        <div className="text-muted-foreground">
                          {courseLabels[c.course] || c.course}{c.groupName ? ` (${c.groupName})` : ""}
                          {c.category ? ` · ${c.category}` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{c.scheduleText}</div>
                      </div>
                    ))}
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

export default SiteCoverageReport;

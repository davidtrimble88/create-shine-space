import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  Download,
  FileText,
  Loader2,
  MapPin,
  Search,
  User,
} from "lucide-react";

interface IncidentReport {
  id: string;
  schedule_id: string | null;
  booking_id: string | null;
  student_name: string | null;
  class_date: string | null;
  class_course: string | null;
  class_location_label: string | null;
  incident_date: string;
  incident_time: string | null;
  incident_type: string;
  severity: string;
  description: string;
  witnesses: string | null;
  action_taken: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
  attachment_size: number | null;
  reporter_name: string;
  reporter_email: string | null;
  signature: string;
  acknowledged: boolean;
  created_at: string;
}

const courseLabels: Record<string, string> = {
  basic: "Motorcycle Training Course",
  intermediate: "Intermediate Course",
  advanced: "Advanced Riding Clinic",
};

const severityColors: Record<string, string> = {
  minor: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
  moderate: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
  serious: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
};

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString(
    undefined,
    { year: "numeric", month: "short", day: "numeric" }
  );
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const IncidentReports = () => {
  const { userRole } = useAuth();
  const canView = userRole === "owner" || userRole === "admin";
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<IncidentReport | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!canView) return;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("incident_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) toast.error("Failed to load incident reports");
      else setReports((data ?? []) as IncidentReport[]);
      setLoading(false);
    };
    load();
  }, [canView]);

  const handleDownload = async (r: IncidentReport) => {
    if (!r.attachment_path) return;
    setDownloadingId(r.id);
    const { data, error } = await supabase.storage
      .from("incident-reports")
      .createSignedUrl(r.attachment_path, 60, {
        download: r.attachment_name ?? undefined,
      });
    setDownloadingId(null);
    if (error || !data?.signedUrl) {
      toast.error("Could not get download link");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  if (!canView) {
    return (
      <div className="text-muted-foreground">
        You don't have permission to view incident reports.
      </div>
    );
  }

  const term = search.trim().toLowerCase();
  const filtered = !term
    ? reports
    : reports.filter((r) =>
        [
          r.student_name,
          r.reporter_name,
          r.class_location_label,
          r.class_course && courseLabels[r.class_course],
          r.incident_type,
          r.severity,
          r.description,
        ]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(term))
      );

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-6 h-6 text-accent" />
          <h2 className="text-2xl font-bold text-foreground">Incident Reports</h2>
        </div>
        <p className="text-muted-foreground text-sm">
          All incident reports submitted by staff. Append-only — reports cannot be
          edited or deleted.
        </p>
      </div>

      <div className="mb-4 relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by student, reporter, class, type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading reports...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <AlertTriangle className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {reports.length === 0
                ? "No incident reports have been submitted yet."
                : "No reports match your search."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => setDetail(r)}
                className="w-full text-left p-4 hover:bg-secondary/30 transition-colors block"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-medium text-foreground">
                        {r.student_name || (
                          <em className="text-muted-foreground">Class-level (no student)</em>
                        )}
                      </span>
                      <Badge
                        variant="outline"
                        className={`capitalize ${severityColors[r.severity] ?? ""}`}
                      >
                        {r.severity}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {r.incident_type}
                      </Badge>
                      {r.attachment_path && (
                        <Badge variant="outline" className="gap-1">
                          <FileText className="w-3 h-3" /> Attachment
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {r.description}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" /> Class:{" "}
                        {r.class_course
                          ? courseLabels[r.class_course] ?? r.class_course
                          : "—"}{" "}
                        on {formatDate(r.class_date)}
                      </span>
                      {r.class_location_label && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {r.class_location_label}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> Reported by {r.reporter_name}
                      </span>
                      <span>Submitted {formatDateTime(r.created_at)}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-accent" />
                  Incident Report
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div className="rounded-lg bg-secondary/40 border border-border p-3 space-y-1">
                  <div>
                    <span className="text-muted-foreground">Student involved: </span>
                    <span className="font-medium text-foreground">
                      {detail.student_name || (
                        <em className="text-muted-foreground">
                          Class-level (no specific student)
                        </em>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Class: </span>
                    <span className="text-foreground">
                      {detail.class_course
                        ? courseLabels[detail.class_course] ?? detail.class_course
                        : "—"}
                      {detail.class_location_label
                        ? ` — ${detail.class_location_label}`
                        : ""}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Class date: </span>
                    <span className="text-foreground">{formatDate(detail.class_date)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Incident Date</div>
                    <div className="font-medium">{formatDate(detail.incident_date)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Time</div>
                    <div className="font-medium">{detail.incident_time || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Type</div>
                    <div className="font-medium capitalize">{detail.incident_type}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Severity</div>
                    <Badge
                      variant="outline"
                      className={`capitalize ${severityColors[detail.severity] ?? ""}`}
                    >
                      {detail.severity}
                    </Badge>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-1">What happened</div>
                  <div className="whitespace-pre-wrap rounded-md bg-secondary/40 border border-border p-3">
                    {detail.description}
                  </div>
                </div>

                {detail.witnesses && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Witnesses</div>
                    <div className="rounded-md bg-secondary/40 border border-border p-3">
                      {detail.witnesses}
                    </div>
                  </div>
                )}

                {detail.action_taken && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Action taken</div>
                    <div className="whitespace-pre-wrap rounded-md bg-secondary/40 border border-border p-3">
                      {detail.action_taken}
                    </div>
                  </div>
                )}

                {detail.attachment_path && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Attachment</div>
                    <div className="flex items-center gap-2 rounded-md bg-secondary/40 border border-border p-3">
                      <FileText className="w-4 h-4 text-accent" />
                      <span className="flex-1 truncate text-sm">
                        {detail.attachment_name}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(detail)}
                        disabled={downloadingId === detail.id}
                      >
                        {downloadingId === detail.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-1.5" /> Download
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="border-t border-border pt-3 space-y-1">
                  <div>
                    <span className="text-muted-foreground">Reported by: </span>
                    <span className="font-medium">{detail.reporter_name}</span>
                    {detail.reporter_email && (
                      <span className="text-muted-foreground"> ({detail.reporter_email})</span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Signature: </span>
                    <span className="font-serif italic">{detail.signature}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Submitted {formatDateTime(detail.created_at)}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IncidentReports;

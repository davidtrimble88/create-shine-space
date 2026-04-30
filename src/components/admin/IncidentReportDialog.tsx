import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Upload } from "lucide-react";

export interface IncidentReportContext {
  scheduleId?: string | null;
  bookingId?: string | null;
  studentName?: string | null; // null/empty => class-level (not tied to a specific student)
  classDate?: string | null;
  classCourse?: string | null;
  classLocationLabel?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: IncidentReportContext;
  onSubmitted?: () => void;
}

const INCIDENT_TYPES = [
  { value: "injury", label: "Injury" },
  { value: "equipment", label: "Equipment" },
  { value: "behavior", label: "Behavior" },
  { value: "other", label: "Other" },
];

const SEVERITIES = [
  { value: "minor", label: "Minor" },
  { value: "moderate", label: "Moderate" },
  { value: "serious", label: "Serious" },
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const IncidentReportDialog = ({ open, onOpenChange, context, onSubmitted }: Props) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [reporterName, setReporterName] = useState("");
  const [incidentDate, setIncidentDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [incidentTime, setIncidentTime] = useState("");
  const [incidentType, setIncidentType] = useState("");
  const [severity, setSeverity] = useState("");
  const [description, setDescription] = useState("");
  const [witnesses, setWitnesses] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [signature, setSignature] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill incident date with class date when opening
  useEffect(() => {
    if (open) {
      if (context.classDate) setIncidentDate(context.classDate);
      // Try to pre-fill reporter name from employees table
      (async () => {
        if (!user?.id) return;
        const { data } = await supabase
          .from("employees")
          .select("full_name")
          .eq("user_id", user.id)
          .maybeSingle();
        if (data?.full_name) setReporterName(data.full_name);
        else if (user.email) setReporterName(user.email);
      })();
    } else {
      // Reset on close
      setIncidentDate(new Date().toISOString().split("T")[0]);
      setIncidentTime("");
      setIncidentType("");
      setSeverity("");
      setDescription("");
      setWitnesses("");
      setActionTaken("");
      setSignature("");
      setAcknowledged(false);
      setFile(null);
      setReporterName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open, context.classDate, user?.id, user?.email]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > MAX_FILE_SIZE) {
      toast.error("File too large (max 25 MB)");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setFile(f);
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      toast.error("You must be signed in");
      return;
    }
    if (!incidentType) return toast.error("Select an incident type");
    if (!severity) return toast.error("Select a severity");
    if (!description.trim()) return toast.error("Description is required");
    if (!reporterName.trim()) return toast.error("Reporter name is required");
    if (!signature.trim()) return toast.error("Signature is required");
    if (!acknowledged)
      return toast.error("Please acknowledge the statement before submitting");

    setSubmitting(true);

    let attachmentPath: string | null = null;
    let attachmentName: string | null = null;
    let attachmentMime: string | null = null;
    let attachmentSize: number | null = null;

    if (file) {
      const safeBase = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}-${safeBase}`;
      const { error: uploadErr } = await supabase.storage
        .from("incident-reports")
        .upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (uploadErr) {
        toast.error("Attachment upload failed: " + uploadErr.message);
        setSubmitting(false);
        return;
      }
      attachmentPath = path;
      attachmentName = file.name;
      attachmentMime = file.type || null;
      attachmentSize = file.size;
    }

    const { error: insertErr } = await supabase.from("incident_reports").insert({
      schedule_id: context.scheduleId ?? null,
      booking_id: context.bookingId ?? null,
      student_name: context.studentName?.trim() || null,
      class_date: context.classDate ?? null,
      class_course: context.classCourse ?? null,
      class_location_label: context.classLocationLabel ?? null,
      incident_date: incidentDate,
      incident_time: incidentTime.trim() || null,
      incident_type: incidentType,
      severity,
      description: description.trim(),
      witnesses: witnesses.trim() || null,
      action_taken: actionTaken.trim() || null,
      attachment_path: attachmentPath,
      attachment_name: attachmentName,
      attachment_mime: attachmentMime,
      attachment_size: attachmentSize,
      reported_by: user.id,
      reporter_name: reporterName.trim(),
      reporter_email: user.email ?? null,
      signature: signature.trim(),
      acknowledged: true,
    });

    setSubmitting(false);

    if (insertErr) {
      // Roll back the attachment if any
      if (attachmentPath) {
        await supabase.storage.from("incident-reports").remove([attachmentPath]);
      }
      toast.error("Failed to submit report: " + insertErr.message);
      return;
    }

    toast.success("Incident report submitted");
    onOpenChange(false);
    onSubmitted?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-accent" />
            Submit Incident Report
          </DialogTitle>
          <DialogDescription>
            Reports are permanent and cannot be edited after submission. Please be
            thorough and accurate.
          </DialogDescription>
        </DialogHeader>

        {/* Class context summary */}
        <div className="rounded-lg bg-secondary/40 border border-border p-3 text-sm space-y-1">
          {context.studentName ? (
            <div>
              <span className="text-muted-foreground">Student: </span>
              <span className="font-medium text-foreground">{context.studentName}</span>
            </div>
          ) : (
            <div className="text-muted-foreground italic">
              Class-level report (not tied to a specific student)
            </div>
          )}
          {(context.classCourse || context.classLocationLabel) && (
            <div>
              <span className="text-muted-foreground">Class: </span>
              <span className="text-foreground">
                {context.classCourse}
                {context.classLocationLabel ? ` — ${context.classLocationLabel}` : ""}
              </span>
            </div>
          )}
          {context.classDate && (
            <div>
              <span className="text-muted-foreground">Class date: </span>
              <span className="text-foreground">{context.classDate}</span>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="incident-date">Incident Date *</Label>
              <Input
                id="incident-date"
                type="date"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="incident-time">Approx. Time</Label>
              <Input
                id="incident-time"
                placeholder="e.g. 10:30 AM"
                value={incidentTime}
                onChange={(e) => setIncidentTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type *</Label>
              <Select value={incidentType} onValueChange={setIncidentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Severity *</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger>
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">What happened? *</Label>
            <Textarea
              id="description"
              rows={4}
              placeholder="Describe the incident in detail (what, where, how)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="witnesses">Witnesses</Label>
            <Input
              id="witnesses"
              placeholder="Names of anyone who saw the incident"
              value={witnesses}
              onChange={(e) => setWitnesses(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="action">Action Taken</Label>
            <Textarea
              id="action"
              rows={3}
              placeholder="First aid, instructor intervention, 911 called, etc."
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="attachment">Attachment (photo or PDF, max 25 MB)</Label>
            <Input
              id="attachment"
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileSelect}
            />
            {file && (
              <p className="text-xs text-muted-foreground mt-1">
                {file.name} • {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <div>
              <Label htmlFor="reporter">Your Name *</Label>
              <Input
                id="reporter"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="signature">Type your full name as signature *</Label>
              <Input
                id="signature"
                placeholder="Full legal name"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                className="font-serif italic"
              />
            </div>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={acknowledged}
                onCheckedChange={(v) => setAcknowledged(!!v)}
                className="mt-0.5"
              />
              <span className="text-muted-foreground">
                I confirm the information above is accurate to the best of my
                knowledge and understand this report becomes a permanent record.
              </span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" /> Submit Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default IncidentReportDialog;

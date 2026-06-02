import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck, Save, Loader2, Calendar, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

type CertKey = "cmsp_expires" | "irc_expires" | "arc_expires" | "cpr_expires";

interface CertRow {
  id: string;
  user_id: string;
  cmsp_expires: string | null;
  irc_expires: string | null;
  arc_expires: string | null;
  cpr_expires: string | null;
  notes: string | null;
  updated_at: string;
}

interface EmployeeLite {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  position: string | null;
  is_active: boolean;
}

const CERT_LABELS: { key: CertKey; label: string; short: string }[] = [
  { key: "cmsp_expires", label: "CMSP Certification", short: "CMSP" },
  { key: "irc_expires", label: "IRC Certification", short: "IRC" },
  { key: "arc_expires", label: "ARC Certification", short: "ARC" },
  { key: "cpr_expires", label: "CPR Certification", short: "CPR" },
];

const daysUntil = (iso: string | null) => {
  if (!iso) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exp = new Date(iso + "T00:00:00");
  return Math.round((exp.getTime() - today.getTime()) / 86400000);
};

const StatusBadge = ({ iso }: { iso: string | null }) => {
  if (!iso) {
    return (
      <Badge variant="outline" className="text-muted-foreground border-border">
        Not set
      </Badge>
    );
  }
  const d = daysUntil(iso)!;
  const formatted = new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
  if (d < 0) {
    return (
      <Badge className="bg-destructive/15 text-destructive border border-destructive/40 hover:bg-destructive/15">
        <XCircle className="w-3 h-3 mr-1" /> Expired {formatted}
      </Badge>
    );
  }
  if (d <= 30) {
    return (
      <Badge className="bg-yellow-500/15 text-yellow-500 border border-yellow-500/40 hover:bg-yellow-500/15">
        <AlertTriangle className="w-3 h-3 mr-1" /> {formatted} ({d}d)
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-500/15 text-green-500 border border-green-500/40 hover:bg-green-500/15">
      <CheckCircle2 className="w-3 h-3 mr-1" /> {formatted}
    </Badge>
  );
};

const blankForm = {
  cmsp_expires: "",
  irc_expires: "",
  arc_expires: "",
  cpr_expires: "",
  notes: "",
};

const SelfEditor = ({ userId, onSaved }: { userId: string; onSaved?: () => void }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [existingId, setExistingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("instructor_certifications")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      toast.error("Failed to load your certifications");
    } else if (data) {
      setExistingId(data.id);
      setForm({
        cmsp_expires: data.cmsp_expires ?? "",
        irc_expires: data.irc_expires ?? "",
        arc_expires: data.arc_expires ?? "",
        cpr_expires: data.cpr_expires ?? "",
        notes: data.notes ?? "",
      });
    } else {
      setExistingId(null);
      setForm(blankForm);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    const payload = {
      user_id: userId,
      cmsp_expires: form.cmsp_expires || null,
      irc_expires: form.irc_expires || null,
      arc_expires: form.arc_expires || null,
      cpr_expires: form.cpr_expires || null,
      notes: form.notes.trim() || null,
    };
    const { error } = existingId
      ? await supabase.from("instructor_certifications").update(payload).eq("id", existingId)
      : await supabase.from("instructor_certifications").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Could not save: " + error.message);
      return;
    }
    toast.success("Certifications saved");
    load();
    onSaved?.();
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">
      <p className="text-sm text-muted-foreground">
        Keep your certification expiration dates current. The office uses this to plan recertification.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        {CERT_LABELS.map(({ key, label }) => (
          <div key={key} className="space-y-2">
            <Label htmlFor={key} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-accent" /> {label}
              </span>
              <StatusBadge iso={form[key] || null} />
            </Label>
            <Input
              id={key}
              type="date"
              value={form[key]}
              onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          rows={3}
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          placeholder="Anything the office should know (e.g. recert scheduled for…)"
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save
        </Button>
      </div>
    </div>
  );
};

const AdminAllView = () => {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [certs, setCerts] = useState<Record<string, CertRow>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [empRes, certRes] = await Promise.all([
      supabase
        .from("employees")
        .select("id, user_id, full_name, email, position, is_active")
        .eq("is_active", true)
        .order("full_name"),
      supabase.from("instructor_certifications").select("*"),
    ]);
    if (empRes.error) toast.error("Failed to load employees");
    if (certRes.error) toast.error("Failed to load certifications");
    setEmployees((empRes.data ?? []) as EmployeeLite[]);
    const map: Record<string, CertRow> = {};
    (certRes.data ?? []).forEach((r: any) => { if (r.user_id) map[r.user_id] = r; });
    setCerts(map);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading instructors…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Instructor</th>
                {CERT_LABELS.map((c) => (
                  <th key={c.key} className="text-left px-4 py-3 font-medium">{c.short}</th>
                ))}
                <th className="text-left px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {employees.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No active employees</td></tr>
              )}
              {employees.map((e) => {
                const c = e.user_id ? certs[e.user_id] : undefined;
                return (
                  <tr key={e.id} className="hover:bg-secondary/20">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{e.full_name}</div>
                      <div className="text-xs text-muted-foreground">{e.position || e.email}</div>
                    </td>
                    {CERT_LABELS.map((col) => (
                      <td key={col.key} className="px-4 py-3">
                        <StatusBadge iso={(c?.[col.key] as string | null) ?? null} />
                      </td>
                    ))}
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {c?.updated_at
                        ? new Date(c.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Instructors maintain their own dates from their <strong>My Certifications</strong> tab. Statuses: green = valid, yellow = expires in 30 days, red = expired.
      </p>
    </div>
  );
};

const InstructorCertifications = () => {
  const { user, effectiveRole } = useAuth();
  const isAdmin = effectiveRole === "owner" || effectiveRole === "admin";
  const [tab, setTab] = useState<"mine" | "all">(isAdmin ? "all" : "mine");

  if (!user) return null;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold text-foreground">Instructor Certifications</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Track CMSP, IRC, ARC, and CPR certification expiration dates.
        </p>
      </div>

      {isAdmin && (
        <div className="flex gap-2 mb-4">
          <Button
            variant={tab === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("all")}
          >
            All Instructors
          </Button>
          <Button
            variant={tab === "mine" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("mine")}
          >
            My Certifications
          </Button>
        </div>
      )}

      {tab === "all" && isAdmin ? <AdminAllView /> : <SelfEditor userId={user.id} />}
    </div>
  );
};

export default InstructorCertifications;

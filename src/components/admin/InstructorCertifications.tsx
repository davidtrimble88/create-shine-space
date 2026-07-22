import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShieldCheck, Save, Loader2, AlertTriangle, CheckCircle2, XCircle, Pencil, BarChart3 } from "lucide-react";
import CertificationStatusReport from "./CertificationStatusReport";
import { formatPSTDate } from "@/lib/formatDate";

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

// ============= Staff (read-only) view of own certifications =============
const SelfView = ({ userId, editable = false }: { userId: string; editable?: boolean }) => {
  const [loading, setLoading] = useState(true);
  const [cert, setCert] = useState<CertRow | null>(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("instructor_certifications")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      const c = data as CertRow | null;
      setCert(c);
      setForm({
        cmsp_expires: c?.cmsp_expires ?? "",
        irc_expires: c?.irc_expires ?? "",
        arc_expires: c?.arc_expires ?? "",
        cpr_expires: c?.cpr_expires ?? "",
        notes: c?.notes ?? "",
      });
      setLoading(false);
    })();
  }, [userId]);

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
    const { error } = cert
      ? await supabase.from("instructor_certifications").update(payload).eq("id", cert.id)
      : await supabase.from("instructor_certifications").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Could not save: " + error.message);
      return;
    }
    toast.success("Saved");
    // refresh
    const { data } = await supabase
      .from("instructor_certifications")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    setCert(data as CertRow | null);
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
        {editable
          ? "Update your own certification expiration dates below."
          : "Your certification expiration dates as recorded by the office. Contact an admin to make changes."}
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        {CERT_LABELS.map(({ key, label }) => (
          <div key={key} className="bg-secondary/30 border border-border rounded-lg p-4 space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
            {editable ? (
              <Input
                type="date"
                value={form[key]}
                onChange={(ev) => setForm((p) => ({ ...p, [key]: ev.target.value }))}
              />
            ) : (
              <StatusBadge iso={(cert?.[key] as string | null) ?? null} />
            )}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="self-notes" className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Notes</Label>
        {editable ? (
          <Textarea
            id="self-notes"
            rows={3}
            value={form.notes}
            onChange={(ev) => setForm((p) => ({ ...p, notes: ev.target.value }))}
          />
        ) : cert?.notes ? (
          <p className="text-sm text-foreground whitespace-pre-wrap">{cert.notes}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No notes.</p>
        )}
      </div>

      {editable && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save
          </Button>
        </div>
      )}

      {!editable && !cert && (
        <p className="text-sm text-muted-foreground italic">
          No certifications recorded yet.
        </p>
      )}
    </div>
  );
};

// ============= Admin: list all + edit dialog =============
const AdminAllView = () => {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [certs, setCerts] = useState<Record<string, CertRow>>({});
  const [editing, setEditing] = useState<EmployeeLite | null>(null);
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const openEdit = (e: EmployeeLite) => {
    if (!e.user_id) {
      toast.error("This employee has no login account yet.");
      return;
    }
    const c = certs[e.user_id];
    setEditing(e);
    setEditingId(c?.id ?? null);
    setForm({
      cmsp_expires: c?.cmsp_expires ?? "",
      irc_expires: c?.irc_expires ?? "",
      arc_expires: c?.arc_expires ?? "",
      cpr_expires: c?.cpr_expires ?? "",
      notes: c?.notes ?? "",
    });
  };

  const save = async () => {
    if (!editing?.user_id) return;
    setSaving(true);
    const payload = {
      user_id: editing.user_id,
      cmsp_expires: form.cmsp_expires || null,
      irc_expires: form.irc_expires || null,
      arc_expires: form.arc_expires || null,
      cpr_expires: form.cpr_expires || null,
      notes: form.notes.trim() || null,
    };
    const { error } = editingId
      ? await supabase.from("instructor_certifications").update(payload).eq("id", editingId)
      : await supabase.from("instructor_certifications").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Could not save: " + error.message);
      return;
    }
    toast.success("Saved");
    setEditing(null);
    load();
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading instructors…
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {employees.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No active employees</td></tr>
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
                        ? formatPSTDate(c.updated_at)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(e)}
                        disabled={!e.user_id}
                        title={e.user_id ? "Edit certifications" : "No login account"}
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Status colors: green = valid, yellow = expires within 30 days, red = expired. Instructors see their own dates read-only.
      </p>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Certifications</DialogTitle>
            <DialogDescription>{editing?.full_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              {CERT_LABELS.map(({ key, label }) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`edit-${key}`}>{label}</Label>
                  <Input
                    id={`edit-${key}`}
                    type="date"
                    value={form[key]}
                    onChange={(ev) => setForm((p) => ({ ...p, [key]: ev.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes (optional)</Label>
              <Textarea
                id="edit-notes"
                rows={3}
                value={form.notes}
                onChange={(ev) => setForm((p) => ({ ...p, notes: ev.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const InstructorCertifications = () => {
  const { user, effectiveRole } = useAuth();
  const isAdmin = effectiveRole === "owner" || effectiveRole === "admin";
  const isManagerOrAbove = isAdmin || effectiveRole === "manager";
  const [tab, setTab] = useState<"mine" | "all" | "report">(isAdmin ? "all" : "mine");

  if (!user) return null;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold text-foreground">Instructor Certifications</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          {isAdmin
            ? "Track CMSP, IRC, ARC, and CPR expiration dates for every instructor. Only admins and owners can edit."
            : "Your CMSP, IRC, ARC, and CPR expiration dates. Contact an admin to make changes."}
        </p>
      </div>

      {isManagerOrAbove && (
        <div className="flex flex-wrap gap-2 mb-4">
          {isAdmin && (
            <Button variant={tab === "all" ? "default" : "outline"} size="sm" onClick={() => setTab("all")}>
              All Instructors
            </Button>
          )}
          <Button variant={tab === "report" ? "default" : "outline"} size="sm" onClick={() => setTab("report")}>
            <BarChart3 className="w-4 h-4 mr-1" /> Status Report
          </Button>
          <Button variant={tab === "mine" ? "default" : "outline"} size="sm" onClick={() => setTab("mine")}>
            My Certifications
          </Button>
        </div>
      )}

      {tab === "all" && isAdmin ? (
        <AdminAllView />
      ) : tab === "report" && isManagerOrAbove ? (
        <CertificationStatusReport />
      ) : (
        <SelfView userId={user.id} editable={isAdmin} />
      )}
    </div>
  );
};

export default InstructorCertifications;

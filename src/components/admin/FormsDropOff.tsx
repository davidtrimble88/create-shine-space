import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, Check, Clock, Copy, FileWarning, Link2, Loader2, Mail, MousePointerClick, RefreshCw, X } from "lucide-react";
import { isClassPast } from "@/lib/classDates";

const courseLabels: Record<string, string> = {
  basic: "Motorcyclist Training Course",
  intermediate: "Intermediate Course",
  advanced: "Advanced Riding Clinic",
};

interface BookingRow {
  id: string;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  course: string;
  location: string;
  location_label: string;
  schedule_id: string | null;
  schedule_date: string | null;
  rider_track: string | null;
  guardian_email: string | null;
  date_of_birth: string | null;
  schedules: { date: string | null; schedule: string | null } | null;
}

interface Row extends BookingRow {
  waiver: boolean;
  regForm: boolean;
  modelRelease: boolean;
  linkSentAt: string | null;
  linkOpenedAt: string | null;
  stage: "not_started" | "opened_stopped" | "partial" | "complete";
}

const stageMeta: Record<Row["stage"], { label: string; className: string }> = {
  not_started: { label: "Never started", className: "bg-muted text-muted-foreground border-border" },
  opened_stopped: { label: "Opened link, stopped", className: "bg-destructive/15 text-destructive border-destructive/30" },
  partial: { label: "Started, incomplete", className: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  complete: { label: "Complete", className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
};

const fmt = (s: string | null) => (s ? new Date(s).toLocaleString() : "—");
const daysSince = (s: string) => Math.floor((Date.now() - new Date(s).getTime()) / 86400000);

const isMinor = (dateOfBirth: string | null) => {
  if (!dateOfBirth) return false;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return false;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
  return age < 18;
};

const Tick = ({ ok }: { ok: boolean }) =>
  ok ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-destructive" />;

const FormsDropOff = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("incomplete");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const currentUserEmail = user?.email?.toLowerCase() || null;

  const load = async () => {
    setLoading(true);
    try {
      const cutoff = new Date(Date.now() - 120 * 86400000).toISOString();
      const [
        { data: bookings, error: bErr },
        { data: waivers },
        { data: tokens },
        { data: employees },
      ] = await Promise.all([
        supabase
          .from("bookings")
          .select(
            "id, created_at, first_name, last_name, email, phone, course, location, location_label, schedule_id, schedule_date, rider_track, guardian_email, date_of_birth, schedules!schedule_id(date, schedule)"
          )
          .eq("archived", false)
          .eq("dropped", false)
          .gte("created_at", cutoff)
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase
          .from("signed_waivers")
          .select("signer_email, document_type, schedule_id, signed_at")
          .gte("signed_at", cutoff)
          .limit(5000),
        supabase
          .from("booking_form_tokens")
          .select("booking_id, created_at, last_opened_at")
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase
          .from("employees")
          .select("full_name")
          .eq("is_active", true)
          .limit(1000),
      ]);
      if (bErr) throw bErr;

      const tokenMap = new Map<string, { created_at: string; last_opened_at: string | null }>();
      for (const t of tokens || []) {
        const prev = tokenMap.get(t.booking_id as string);
        const opened = (t.last_opened_at as string | null) || prev?.last_opened_at || null;
        if (!prev) tokenMap.set(t.booking_id as string, { created_at: t.created_at as string, last_opened_at: opened });
        else tokenMap.set(t.booking_id as string, { ...prev, last_opened_at: opened });
      }

      const normalizeName = (s: string) =>
        s
          .toLowerCase()
          .replace(/[^a-z\s]/g, "")
          .replace(/\s+/g, " ")
          .trim();
      const staffNames = new Set((employees || []).map((e) => normalizeName(e.full_name || "")).filter(Boolean));

      const built: Row[] = (bookings || []).map((b: BookingRow) => {
        const since = new Date(b.created_at).getTime() - 60_000;
        const mine = (waivers || []).filter(
          (w: Record<string, unknown>) =>
            String(w.signer_email || "").toLowerCase() === String(b.email || "").toLowerCase() &&
            w.schedule_id === b.schedule_id &&
            new Date(String(w.signed_at)).getTime() >= since
        );
        const types = new Set(mine.map((w) => String(w.document_type)));
        const waiver = types.has("cmsp_waiver");
        const regForm = types.has("cmsp_registration_form");
        const modelRelease = types.has("cmsp_model_release") || types.has("cmsp_model_release_decline");
        const tok = tokenMap.get(b.id) || null;
        const doneCount = [waiver, regForm, modelRelease].filter(Boolean).length;

        let stage: Row["stage"];
        if (doneCount === 3) stage = "complete";
        else if (doneCount > 0) stage = "partial";
        else if (tok?.last_opened_at) stage = "opened_stopped";
        else stage = "not_started";

        return {
          ...b,
          waiver,
          regForm,
          modelRelease,
          linkSentAt: tok?.created_at ?? null,
          linkOpenedAt: tok?.last_opened_at ?? null,
          stage,
        };
      });

      setRows(
        built.filter((r) => {
          if (String(r.email || "").toLowerCase() === currentUserEmail) return false;
          if (isMinor(r.date_of_birth)) return false;
          const fullName = normalizeName(`${r.first_name || ""} ${r.last_name || ""}`);
          if (staffNames.has(fullName)) return false;
          if (isClassPast(r.schedule_date, r.schedules?.schedule ?? null)) return false;
          return true;
        })
      );
    } catch (e) {
      toast({
        title: "Could not load forms tracker",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (filter === "complete" || filter === "all") setFilter("incomplete");
  }, [filter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "incomplete" && r.stage === "complete") return false;
      if (filter !== "incomplete" && filter !== "all" && r.stage !== filter) return false;
      if (!q) return true;
      return [r.first_name, r.last_name, r.email, r.phone, r.location_label]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, search, filter]);

  const stats = useMemo(
    () => ({
      incomplete: rows.filter((r) => r.stage !== "complete").length,
      openedStopped: rows.filter((r) => r.stage === "opened_stopped").length,
      partial: rows.filter((r) => r.stage === "partial").length,
      notStarted: rows.filter((r) => r.stage === "not_started").length,
    }),
    [rows]
  );

  const createToken = async (b: Row) => {
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
    const { error } = await supabase
      .from("booking_form_tokens")
      .insert({ booking_id: b.id, token, created_by: user?.id ?? null });
    if (error) throw error;
    return `${window.location.origin}/complete-forms?token=${token}`;
  };

  const sendLink = async (b: Row) => {
    setSendingId(b.id);
    try {
      const formsLink = await createToken(b);
      const guardianEmail = (b.guardian_email || "").trim();
      const { error } = await supabase.functions.invoke("send-auto-email", {
        body: {
          trigger_event: "forms_link",
          recipientEmail: b.email,
          location: b.location,
          course: b.rider_track === "1dpc" ? "1dpc" : b.course,
          additionalRecipients:
            guardianEmail && guardianEmail.toLowerCase() !== b.email.toLowerCase() ? [guardianEmail] : [],
          variables: {
            firstName: b.first_name,
            lastName: b.last_name,
            course: courseLabels[b.course] || b.course,
            locationLabel: b.location_label,
            scheduleDate: b.schedule_date || "",
            formsLink,
            email: b.email,
          },
        },
      });
      if (error) throw error;
      toast({ title: "Reminder sent", description: `Forms link emailed to ${b.email}.` });
      load();
    } catch (e) {
      toast({
        title: "Send failed",
        description: e instanceof Error ? e.message : "Could not send forms link.",
        variant: "destructive",
      });
    } finally {
      setSendingId(null);
    }
  };

  const copyLink = async (b: Row) => {
    try {
      const link = await createToken(b);
      await navigator.clipboard.writeText(link);
      toast({ title: "Link copied", description: "Paste it into a text or email." });
    } catch (e) {
      toast({
        title: "Could not create link",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold">Forms Drop-Off</h3>
          <p className="text-sm text-muted-foreground">
            Adults with upcoming classes who haven't finished their CMSP paperwork. Completed registrations, past
            classes, your own test entries, minors, and active staff members are excluded.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Paperwork Missing</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-bold">
            <FileWarning className="h-5 w-5 text-amber-500" />
            {stats.incomplete}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Opened Link, Stopped</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-bold">
            <MousePointerClick className="h-5 w-5 text-destructive" />
            {stats.openedStopped}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Partly Done</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-bold">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {stats.partial}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Never Started</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-bold">
            <Clock className="h-5 w-5 text-muted-foreground" />
            {stats.notStarted}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search name, email, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="incomplete">Missing paperwork only</SelectItem>
            <SelectItem value="opened_stopped">Opened link, stopped</SelectItem>
            <SelectItem value="partial">Started, incomplete</SelectItem>
            <SelectItem value="not_started">Never started</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead>Registered</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Class</TableHead>
              <TableHead className="text-center">Reg. Form</TableHead>
              <TableHead className="text-center">Waiver</TableHead>
              <TableHead className="text-center">Photo Release</TableHead>
              <TableHead>Link Activity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  Everyone's paperwork is on file 🎉
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const meta = stageMeta[r.stage];
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      <div>{new Date(r.created_at).toLocaleDateString()}</div>
                      <div className="text-muted-foreground">{daysSince(r.created_at)}d ago</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium">
                        {r.first_name} {r.last_name}
                      </div>
                      <div className="text-muted-foreground">{r.email}</div>
                      <div className="text-muted-foreground">{r.phone || ""}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{courseLabels[r.course] || r.course}</div>
                      <div className="text-muted-foreground">
                        {[r.location_label, r.schedule_date].filter(Boolean).join(" · ")}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <Tick ok={r.regForm} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <Tick ok={r.waiver} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <Tick ok={r.modelRelease} />
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="text-muted-foreground">Sent: {fmt(r.linkSentAt)}</div>
                      <div className={r.linkOpenedAt ? "text-foreground" : "text-muted-foreground"}>
                        Opened: {fmt(r.linkOpenedAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={meta.className}>
                        {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => sendLink(r)} disabled={sendingId === r.id}>
                        {sendingId === r.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Mail className="h-4 w-4" />
                        )}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => copyLink(r)} title="Copy forms link">
                        <Link2 className="h-4 w-4" />
                        <Copy className="ml-1 h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default FormsDropOff;

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ShieldCheck, Download, Loader2, AlertTriangle, CheckCircle2, XCircle, Clock } from "lucide-react";

type CertKey = "cmsp_expires" | "irc_expires" | "arc_expires" | "cpr_expires";

const CERTS: { key: CertKey; label: string }[] = [
  { key: "cmsp_expires", label: "CMSP" },
  { key: "irc_expires", label: "IRC" },
  { key: "arc_expires", label: "ARC" },
  { key: "cpr_expires", label: "CPR" },
];

type Status = "valid" | "warn30" | "warn10" | "warn1" | "expired" | "missing";

const daysUntil = (iso: string | null) => {
  if (!iso) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const e = new Date(iso + "T00:00:00");
  return Math.round((e.getTime() - t.getTime()) / 86400000);
};

const classify = (iso: string | null): Status => {
  const d = daysUntil(iso);
  if (d === null) return "missing";
  if (d < 0) return "expired";
  if (d <= 1) return "warn1";
  if (d <= 10) return "warn10";
  if (d <= 30) return "warn30";
  return "valid";
};

const StatusCell = ({ iso }: { iso: string | null }) => {
  const s = classify(iso);
  const d = daysUntil(iso);
  const map: Record<Status, { cls: string; text: string }> = {
    valid:   { cls: "bg-green-500/15 text-green-500 border-green-500/40",  text: iso ? `Valid · ${d}d` : "Valid" },
    warn30:  { cls: "bg-yellow-500/15 text-yellow-500 border-yellow-500/40", text: `${d}d left` },
    warn10:  { cls: "bg-orange-500/15 text-orange-500 border-orange-500/40", text: `${d}d left` },
    warn1:   { cls: "bg-red-500/15 text-red-500 border-red-500/40",         text: d === 0 ? "Expires today" : "1d left" },
    expired: { cls: "bg-red-600/20 text-red-500 border-red-600/50",         text: `Expired ${Math.abs(d!)}d ago` },
    missing: { cls: "bg-muted text-muted-foreground border-border",         text: "Not on file" },
  };
  const m = map[s];
  return (
    <div className="flex flex-col gap-1">
      <Badge variant="outline" className={m.cls}>{m.text}</Badge>
      {iso && <span className="text-xs text-muted-foreground">{new Date(iso + "T00:00:00").toLocaleDateString()}</span>}
    </div>
  );
};

interface Row {
  user_id: string;
  full_name: string;
  email: string;
  position: string | null;
  cmsp_expires: string | null;
  irc_expires: string | null;
  arc_expires: string | null;
  cpr_expires: string | null;
}

const CertificationStatusReport = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "attention" | "expired" | "expiring" | "missing" | "valid">("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: emps } = await supabase
        .from("employees")
        .select("user_id, full_name, email, position, is_active")
        .eq("is_active", true)
        .not("user_id", "is", null);
      const ids = (emps ?? []).map((e) => e.user_id!).filter(Boolean);
      const { data: certs } = ids.length
        ? await supabase
            .from("instructor_certifications")
            .select("user_id, cmsp_expires, irc_expires, arc_expires, cpr_expires")
            .in("user_id", ids)
        : { data: [] as any[] };
      const certMap = new Map((certs ?? []).map((c: any) => [c.user_id, c]));
      const merged: Row[] = (emps ?? []).map((e) => {
        const c = certMap.get(e.user_id!) ?? {};
        return {
          user_id: e.user_id!,
          full_name: e.full_name,
          email: e.email,
          position: e.position,
          cmsp_expires: c.cmsp_expires ?? null,
          irc_expires: c.irc_expires ?? null,
          arc_expires: c.arc_expires ?? null,
          cpr_expires: c.cpr_expires ?? null,
        };
      });
      merged.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setRows(merged);
      setLoading(false);
    })();
  }, []);

  const summary = useMemo(() => {
    let expired = 0, warn = 0, valid = 0, missing = 0;
    for (const r of rows) {
      for (const c of CERTS) {
        const s = classify(r[c.key]);
        if (s === "expired") expired++;
        else if (s === "missing") missing++;
        else if (s === "valid") valid++;
        else warn++;
      }
    }
    return { expired, warn, valid, missing, total: rows.length * CERTS.length };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !(`${r.full_name} ${r.email} ${r.position ?? ""}`.toLowerCase().includes(q))) return false;
      if (filter === "all") return true;
      const statuses = CERTS.map((c) => classify(r[c.key]));
      if (filter === "expired")   return statuses.includes("expired");
      if (filter === "expiring")  return statuses.some((s) => s === "warn30" || s === "warn10" || s === "warn1");
      if (filter === "attention") return statuses.some((s) => s === "expired" || s === "warn30" || s === "warn10" || s === "warn1");
      if (filter === "missing")   return statuses.includes("missing");
      if (filter === "valid")     return statuses.every((s) => s === "valid");
      return true;
    });
  }, [rows, search, filter]);

  const exportCsv = () => {
    const header = ["Name", "Email", "Position", ...CERTS.flatMap((c) => [`${c.label} Expires`, `${c.label} Status`])];
    const lines = [header.join(",")];
    for (const r of filtered) {
      const cells = [r.full_name, r.email, r.position ?? ""];
      for (const c of CERTS) {
        const iso = r[c.key];
        const s = classify(iso);
        const d = daysUntil(iso);
        const status =
          s === "missing" ? "Not on file"
          : s === "expired" ? `Expired ${Math.abs(d!)}d ago`
          : s === "valid" ? `Valid (${d}d)`
          : `Expiring in ${d}d`;
        cells.push(iso ?? "", status);
      }
      lines.push(cells.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `certification-status-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card className="border-accent/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-accent" /> Certification Status Report
          </CardTitle>
          <CardDescription>
            Live overview of every instructor's CMSP, IRC, ARC, and CPR certifications with expiration status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Valid
              </div>
              <div className="text-2xl font-bold mt-1">{summary.valid}</div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4 text-yellow-500" /> Expiring soon
              </div>
              <div className="text-2xl font-bold mt-1">{summary.warn}</div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <XCircle className="w-4 h-4 text-red-500" /> Expired
              </div>
              <div className="text-2xl font-bold mt-1">{summary.expired}</div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="w-4 h-4 text-muted-foreground" /> Not on file
              </div>
              <div className="text-2xl font-bold mt-1">{summary.missing}</div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <Input
              placeholder="Search name, email, or position…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="md:max-w-xs"
            />
            <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
              <SelectTrigger className="md:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All instructors</SelectItem>
                <SelectItem value="attention">Needs attention</SelectItem>
                <SelectItem value="expired">Has expired cert</SelectItem>
                <SelectItem value="expiring">Expiring within 30 days</SelectItem>
                <SelectItem value="missing">Missing a cert</SelectItem>
                <SelectItem value="valid">All valid</SelectItem>
              </SelectContent>
            </Select>
            <div className="md:ml-auto">
              <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading certifications…
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">No instructors match this filter.</p>
          ) : (
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instructor</TableHead>
                    {CERTS.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.user_id}>
                      <TableCell>
                        <div className="font-medium">{r.full_name}</div>
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                        {r.position && <div className="text-xs text-muted-foreground">{r.position}</div>}
                      </TableCell>
                      {CERTS.map((c) => (
                        <TableCell key={c.key}><StatusCell iso={r[c.key]} /></TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CertificationStatusReport;

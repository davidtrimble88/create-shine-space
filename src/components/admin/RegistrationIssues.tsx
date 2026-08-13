import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FormsDropOff from "./FormsDropOff";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, CreditCard, Loader2, RefreshCw, Trash2, XCircle } from "lucide-react";


interface Attempt {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  stage: string | null;
  error_message: string | null;
  course: string | null;
  location_label: string | null;
  schedule_date: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  amount_cents: number | null;
  booking_id: string | null;
  resolved: boolean;
  staff_notes: string | null;
}

const statusMeta: Record<string, { label: string; className: string }> = {
  in_progress: { label: "Abandoned / Incomplete", className: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  abandoned: { label: "Cancelled at Payment", className: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  payment_failed: { label: "Payment Failed", className: "bg-destructive/15 text-destructive border-destructive/30" },
  payment_setup_failed: { label: "Payment Form Error", className: "bg-destructive/15 text-destructive border-destructive/30" },
  form_error: { label: "Registration Error", className: "bg-destructive/15 text-destructive border-destructive/30" },
  completed: { label: "Completed", className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
};

const fmtMoney = (c: number | null) => (c == null ? "—" : `$${(c / 100).toFixed(2)}`);
const fmtDate = (s: string) => new Date(s).toLocaleString();

const RegistrationIssues = () => {
  const [rows, setRows] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("issues");
  const [search, setSearch] = useState("");
  const [noteRow, setNoteRow] = useState<Attempt | null>(null);
  const [noteText, setNoteText] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: bookings }] = await Promise.all([
      supabase
        .from("registration_attempts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase
        .from("bookings")
        .select("email")
        .eq("archived", false)
        .eq("dropped", false)
        .limit(5000),
    ]);
    if (error) {
      toast({ title: "Could not load registration issues", description: error.message, variant: "destructive" });
    }
    // Anyone who ended up with a real booking isn't a lost registration — hide them.
    const bookedEmails = new Set(
      (bookings || []).map((b) => String(b.email || "").trim().toLowerCase()).filter(Boolean)
    );
    const attempts = ((data as Attempt[]) || []).filter(
      (r) => !r.booking_id && !bookedEmails.has(String(r.email || "").trim().toLowerCase())
    );
    setRows(attempts);
    setLoading(false);
  };


  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter === "issues" && (r.status === "completed" || r.resolved)) return false;
      if (statusFilter !== "issues" && statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.first_name, r.last_name, r.email, r.phone, r.course, r.error_message]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, statusFilter, search]);

  const stats = useMemo(() => {
    const open = rows.filter((r) => r.status !== "completed" && !r.resolved);
    return {
      open: open.length,
      paymentFailed: open.filter((r) => r.status === "payment_failed" || r.status === "payment_setup_failed").length,
      abandoned: open.filter((r) => r.status === "abandoned" || r.status === "in_progress").length,
      completed: rows.filter((r) => r.status === "completed").length,
    };
  }, [rows]);

  const toggleResolved = async (row: Attempt) => {
    const { error } = await supabase
      .from("registration_attempts")
      .update({ resolved: !row.resolved })
      .eq("id", row.id);
    if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, resolved: !row.resolved } : r)));
  };

  const remove = async (row: Attempt) => {
    const { error } = await supabase.from("registration_attempts").delete().eq("id", row.id);
    if (error) return toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  };

  const saveNote = async () => {
    if (!noteRow) return;
    const { error } = await supabase
      .from("registration_attempts")
      .update({ staff_notes: noteText })
      .eq("id", noteRow.id);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    setRows((prev) => prev.map((r) => (r.id === noteRow.id ? { ...r, staff_notes: noteText } : r)));
    setNoteRow(null);
  };

  const issuesView = (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold">Registration Drop-Offs</h3>
          <p className="text-sm text-muted-foreground">
            People who started registering but didn't make it through — payment failures, errors, and drop-offs.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>


      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Open Issues</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-bold"><AlertTriangle className="h-5 w-5 text-amber-500" />{stats.open}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Payment Problems</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-bold"><CreditCard className="h-5 w-5 text-destructive" />{stats.paymentFailed}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Abandoned</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-bold"><XCircle className="h-5 w-5 text-amber-500" />{stats.abandoned}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-bold"><CheckCircle2 className="h-5 w-5 text-emerald-500" />{stats.completed}</CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search name, email, phone, error…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="issues">Open issues only</SelectItem>
            <SelectItem value="all">All attempts</SelectItem>
            <SelectItem value="payment_failed">Payment failed</SelectItem>
            <SelectItem value="payment_setup_failed">Payment form error</SelectItem>
            <SelectItem value="abandoned">Cancelled at payment</SelectItem>
            <SelectItem value="in_progress">Abandoned / incomplete</SelectItem>
            <SelectItem value="form_error">Registration error</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Person</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Details</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No registration issues 🎉</TableCell></TableRow>
            ) : filtered.map((r) => {
              const meta = statusMeta[r.status] || { label: r.status, className: "" };
              return (
                <TableRow key={r.id} className={r.resolved ? "opacity-60" : ""}>
                  <TableCell className="whitespace-nowrap text-xs">{fmtDate(r.created_at)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>{r.email || "—"}</div>
                    <div className="text-muted-foreground">{r.phone || ""}</div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>{r.course || "—"}</div>
                    <div className="text-muted-foreground">
                      {[r.location_label, r.schedule_date].filter(Boolean).join(" · ")}
                    </div>
                    <div className="text-muted-foreground">{fmtMoney(r.amount_cents)}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                    {r.resolved && <div className="mt-1 text-[10px] text-emerald-500">Resolved</div>}
                  </TableCell>
                  <TableCell className="max-w-[280px] text-xs">
                    <div className="text-destructive">{r.error_message || ""}</div>
                    <div className="text-muted-foreground">{r.stage ? `Stage: ${r.stage}` : ""}</div>
                    {r.staff_notes && <div className="mt-1 italic">{r.staff_notes}</div>}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => { setNoteRow(r); setNoteText(r.staff_notes || ""); }}>
                      Note
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleResolved(r)}>
                      {r.resolved ? "Reopen" : "Resolve"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!noteRow} onOpenChange={(o) => !o && setNoteRow(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Staff note</DialogTitle></DialogHeader>
          <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={4}
            placeholder="e.g. Called student, re-registered by phone." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteRow(null)}>Cancel</Button>
            <Button onClick={saveNote}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Registration Issues</h2>
        <p className="text-sm text-muted-foreground">
          Everywhere a student can get stuck — from the registration form through their online paperwork.
        </p>
      </div>
      <Tabs defaultValue="registration">
        <TabsList>
          <TabsTrigger value="registration">Registration Drop-Offs</TabsTrigger>
          <TabsTrigger value="forms">Forms Drop-Off</TabsTrigger>
        </TabsList>
        <TabsContent value="registration" className="mt-6">{issuesView}</TabsContent>
        <TabsContent value="forms" className="mt-6"><FormsDropOff /></TabsContent>
      </Tabs>
    </div>
  );
};


export default RegistrationIssues;

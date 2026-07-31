import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Clock, Plus, Check, X, Archive, Trash2 } from "lucide-react";
import { formatPSTDate } from "@/lib/formatDate";

interface Row {
  id: string;
  employee_id: string;
  requested_by: string;
  hours: number;
  justification: string;
  status: "pending" | "approved" | "denied" | "cancelled";
  decision_notes: string | null;
  decided_at: string | null;
  work_date: string | null;
  created_at: string;
  employees?: { full_name: string } | null;
}

const statusColor: Record<Row["status"], string> = {
  pending: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
  approved: "bg-green-500/20 text-green-700 dark:text-green-300",
  denied: "bg-red-500/20 text-red-700 dark:text-red-300",
  cancelled: "bg-muted text-muted-foreground",
};

const ExtraHoursRequests = ({ onDecision }: { onDecision?: () => void } = {}) => {
  const { user, effectiveRole } = useAuth();
  const isOwner = effectiveRole === "owner";
  const isAdmin = effectiveRole === "admin";
  const isManager = effectiveRole === "manager";

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [myEmployeeId, setMyEmployeeId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([]);
  const [targetEmployeeId, setTargetEmployeeId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState("");
  const [workDate, setWorkDate] = useState("");
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [approveTarget, setApproveTarget] = useState<Row | null>(null);
  const [approveHours, setApproveHours] = useState("");
  const [approveNotes, setApproveNotes] = useState("");
  const [approveSubmitting, setApproveSubmitting] = useState(false);
  // Admins/managers default to (and are locked into) the archived view.
  const [showArchive, setShowArchive] = useState(effectiveRole !== "owner");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("extra_hours_requests")
      .select("*, employees(full_name)")
      .order("created_at", { ascending: false });
    setRows((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (user) {
      supabase
        .from("employees")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => setMyEmployeeId(data?.id ?? null));
    }
  }, [user]);

  useEffect(() => {
    if (!isOwner) return;
    supabase
      .from("employees")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name")
      .then(({ data }) => setEmployees((data ?? []) as any));
  }, [isOwner]);

  const submit = async () => {
    if (!isOwner) {
      toast({ title: "Only the owner can add extra hours", variant: "destructive" });
      return;
    }
    const employeeId = targetEmployeeId || myEmployeeId;
    if (!employeeId || !user) {
      toast({ title: "Select an employee", variant: "destructive" });
      return;
    }
    const h = parseFloat(hours);
    if (!h || h <= 0) {
      toast({ title: "Enter a valid hours amount", variant: "destructive" });
      return;
    }
    if (justification.trim().length < 3) {
      toast({ title: "Please add justification", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("extra_hours_requests").insert({
      employee_id: employeeId,
      requested_by: user.id,
      hours: h,
      justification: justification.trim(),
      work_date: workDate || null,
      status: "approved",
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Could not add hours", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Extra hours added" });
    setOpen(false);
    setHours("");
    setWorkDate("");
    setJustification("");
    setTargetEmployeeId("");
    load();
    onDecision?.();
  };

  const remove = async (r: Row) => {
    if (!isOwner) return;
    if (!window.confirm(`Remove ${r.hours} extra hours for ${r.employees?.full_name ?? "this employee"}? This cannot be undone.`)) return;
    const { error } = await supabase.from("extra_hours_requests").delete().eq("id", r.id);
    if (error) {
      toast({ title: "Could not remove", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Extra hours removed" });
    load();
    onDecision?.();
  };


  const decide = async (id: string, status: "approved" | "denied") => {
    const notes = window.prompt(`Optional notes for ${status}:`, "") ?? "";
    const { error } = await supabase
      .from("extra_hours_requests")
      .update({
        status,
        decision_notes: notes || null,
        decided_by: user?.id,
        decided_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Request ${status}` });
    load();
    onDecision?.();
  };

  const openApprove = (r: Row) => {
    setApproveTarget(r);
    setApproveHours(String(r.hours));
    setApproveNotes(r.decision_notes ?? "");
  };

  const confirmApprove = async () => {
    if (!approveTarget) return;
    const h = parseFloat(approveHours);
    if (!h || h <= 0) {
      toast({ title: "Enter a valid hours amount", variant: "destructive" });
      return;
    }
    setApproveSubmitting(true);
    const { error } = await supabase
      .from("extra_hours_requests")
      .update({
        status: "approved",
        hours: h,
        decision_notes: approveNotes.trim() || null,
        decided_by: user?.id,
        decided_at: new Date().toISOString(),
      })
      .eq("id", approveTarget.id);
    setApproveSubmitting(false);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Request approved" });
    setApproveTarget(null);
    load();
    onDecision?.();
  };


  const pendingCount = useMemo(() => rows.filter((r) => r.status === "pending").length, [rows]);
  const archivedRows = useMemo(() => {
    const base = rows.filter((r) => r.status === "approved" || r.status === "denied");
    // Owners and admins see everyone; managers/instructors only their own.
    if (isOwner || isAdmin) return base;
    return base.filter((r) => myEmployeeId && r.employee_id === myEmployeeId);
  }, [rows, isOwner, isAdmin, myEmployeeId]);
  const visibleRows = useMemo(() => {
    if (isOwner) {
      // Active view = pending + approved (manageable). History = denied.
      return showArchive
        ? rows.filter((r) => r.status === "denied" || r.status === "cancelled")
        : rows.filter((r) => r.status === "pending" || r.status === "approved");
    }
    if (showArchive) return archivedRows;
    return [];
  }, [rows, showArchive, archivedRows, isOwner]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="w-6 h-6" /> Extra Hours Requests
            {isOwner && pendingCount > 0 && (
              <Badge className="ml-2 bg-yellow-500/20 text-yellow-700 dark:text-yellow-300">
                {pendingCount} pending
              </Badge>
            )}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {isOwner
              ? "Add, review, approve, or remove requests. Approved hours appear on the Work Log."
              : "Only the owner can add or remove extra hours. Approved hours are visible here and on the Work Log."}
          </p>
        </div>
        {isOwner && (
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setShowArchive((v) => !v)}>
              <Archive className="w-4 h-4 mr-2" />
              {showArchive
                ? "Back to Active Hours"
                : `History (${rows.filter((r) => r.status === "denied" || r.status === "cancelled").length})`}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" /> Add Extra Hours
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Extra Hours</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Employee</label>
                    <select
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={targetEmployeeId}
                      onChange={(e) => setTargetEmployeeId(e.target.value)}
                    >
                      <option value="">Select employee…</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>{e.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>

                    <label className="text-sm font-medium">Hours</label>
                    <Input
                      type="number"
                      step="0.25"
                      min="0"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      placeholder="e.g. 2.5"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Date worked (optional)</label>
                    <Input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Justification</label>
                    <Textarea
                      value={justification}
                      onChange={(e) => setJustification(e.target.value)}
                      placeholder="Explain what work was performed and why extra hours are needed…"
                      rows={4}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={submit} disabled={submitting}>
                    {submitting ? "Adding…" : "Add Hours"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isOwner
              ? showArchive
                ? "History (denied & cancelled)"
                : "Active Extra Hours (pending & approved)"
              : isAdmin
                ? "Archived Requests (approved & denied)"
                : "My Archived Requests"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : visibleRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No requests to show.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Submitted</TableHead>
                    {(isOwner || isAdmin) && <TableHead>Employee</TableHead>}
                    <TableHead>Work Date</TableHead>
                    <TableHead className="text-center">Hours</TableHead>
                    <TableHead>Justification</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((r) => {
                    const isMine = r.requested_by === user?.id;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatPSTDate(r.created_at)}
                        </TableCell>
                        {(isOwner || isAdmin) && (
                          <TableCell className="whitespace-nowrap">
                            {r.employees?.full_name ?? "—"}
                          </TableCell>
                        )}
                        <TableCell className="whitespace-nowrap text-xs">
                          {r.work_date ? formatPSTDate(r.work_date) : "—"}
                        </TableCell>
                        <TableCell className="text-center font-semibold">{r.hours}</TableCell>
                        <TableCell className="max-w-xs">
                          <div className="text-sm whitespace-pre-wrap">{r.justification}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColor[r.status]}>{r.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                          {r.decision_notes ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end flex-wrap">
                            {isOwner && r.status === "pending" && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => openApprove(r)}>
                                  <Check className="w-3 h-3 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => decide(r.id, "denied")}>
                                  <X className="w-3 h-3 mr-1" /> Deny
                                </Button>
                              </>
                            )}
                            {isOwner && r.status === "approved" && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => openApprove(r)}>
                                  <Check className="w-3 h-3 mr-1" /> Adjust Hours
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => decide(r.id, "denied")}>
                                  <X className="w-3 h-3 mr-1" /> Change to Denied
                                </Button>
                              </>
                            )}
                            {isOwner && r.status === "denied" && (
                              <Button size="sm" variant="outline" onClick={() => openApprove(r)}>
                                <Check className="w-3 h-3 mr-1" /> Change to Approved
                              </Button>
                            )}
                            {isOwner && (
                              <Button size="sm" variant="destructive" onClick={() => remove(r)}>
                                <Trash2 className="w-3 h-3 mr-1" /> Remove
                              </Button>
                            )}
                          </div>

                        </TableCell>

                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Extra Hours</DialogTitle>
          </DialogHeader>
          {approveTarget && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <div><span className="font-medium text-foreground">Employee:</span> {approveTarget.employees?.full_name ?? "—"}</div>
                <div><span className="font-medium text-foreground">Requested:</span> {approveTarget.hours} hours</div>
                <div className="mt-1 whitespace-pre-wrap"><span className="font-medium text-foreground">Justification:</span> {approveTarget.justification}</div>
              </div>
              <div>
                <label className="text-sm font-medium">Hours to approve</label>
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  value={approveHours}
                  onChange={(e) => setApproveHours(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  Comment {parseFloat(approveHours) !== Number(approveTarget.hours) && (
                    <span className="text-xs text-yellow-600 dark:text-yellow-400">
                      (recommended — instructor will see this)
                    </span>
                  )}
                </label>
                <Textarea
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  placeholder="Optional note explaining any adjustment…"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">Optional. Visible to the instructor.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)}>Cancel</Button>
            <Button onClick={confirmApprove} disabled={approveSubmitting}>
              {approveSubmitting ? "Saving…" : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExtraHoursRequests;

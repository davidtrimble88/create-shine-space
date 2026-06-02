import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2 } from "lucide-react";

type Ticket = {
  id: string;
  user_id: string;
  submitter_email: string;
  submitter_name: string | null;
  title: string;
  description: string;
  priority: string;
  status: string;
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-500/15 text-blue-500",
  high: "bg-orange-500/15 text-orange-500",
  urgent: "bg-red-500/15 text-red-500",
};

const statusColors: Record<string, string> = {
  open: "bg-yellow-500/15 text-yellow-500",
  in_progress: "bg-blue-500/15 text-blue-500",
  resolved: "bg-green-500/15 text-green-500",
  closed: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

export default function ITTickets() {
  const { user, effectiveRole } = useAuth();
  const { toast } = useToast();
  const isAdmin = effectiveRole === "admin" || effectiveRole === "owner";
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium" });
  const [filter, setFilter] = useState<"all" | "mine">(isAdmin ? "all" : "mine");

  const load = async () => {
    setLoading(true);
    let query = supabase.from("it_tickets").select("*").order("created_at", { ascending: false });
    if (filter === "mine" && user) query = query.eq("user_id", user.id);
    const { data, error } = await query;
    if (error) toast({ title: "Failed to load tickets", description: error.message, variant: "destructive" });
    else setTickets((data || []) as Ticket[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [filter]);

  const handleSubmit = async () => {
    if (!user || !form.title.trim() || !form.description.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("it_tickets").insert({
      user_id: user.id,
      submitter_email: user.email ?? "",
      submitter_name: (user.user_metadata?.full_name as string) ?? null,
      title: form.title.trim(),
      description: form.description.trim(),
      priority: form.priority,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Could not submit", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Ticket submitted", description: "IT has been notified." });
    setForm({ title: "", description: "", priority: "medium" });
    setOpen(false);
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    const updates: any = { status };
    if (status === "resolved" || status === "closed") updates.resolved_at = new Date().toISOString();
    const { error } = await supabase.from("it_tickets").update(updates).eq("id", id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    else load();
  };

  const saveNotes = async (id: string, notes: string) => {
    const { error } = await supabase.from("it_tickets").update({ admin_notes: notes }).eq("id", id);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Notes saved" });
  };

  const deleteTicket = async (id: string) => {
    if (!confirm("Delete this ticket?")) return;
    const { error } = await supabase.from("it_tickets").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">IT Tickets</h1>
          <p className="text-sm text-muted-foreground">Report a problem or request IT help.</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tickets</SelectItem>
                <SelectItem value="mine">My Tickets</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> New Ticket</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Submit IT Ticket</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Brief summary" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the issue or request in detail" />
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={submitting || !form.title.trim() || !form.description.trim()}>
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Submit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : tickets.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No tickets yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{t.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t.submitter_name || t.submitter_email} · {new Date(t.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={priorityColors[t.priority]}>{t.priority}</Badge>
                    <Badge className={statusColors[t.status]}>{statusLabels[t.status] || t.status}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm whitespace-pre-wrap">{t.description}</p>
                {isAdmin && (
                  <div className="space-y-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Label className="text-xs">Status:</Label>
                      <Select value={t.status} onValueChange={(v) => updateStatus(t.id, v)}>
                        <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" onClick={() => deleteTicket(t.id)} className="ml-auto text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs">Admin notes</Label>
                      <Textarea
                        rows={2}
                        defaultValue={t.admin_notes || ""}
                        onBlur={(e) => {
                          if ((e.target.value || "") !== (t.admin_notes || "")) saveNotes(t.id, e.target.value);
                        }}
                        placeholder="Internal notes (saved on blur)"
                      />
                    </div>
                  </div>
                )}
                {!isAdmin && t.admin_notes && (
                  <div className="pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-1">IT response:</p>
                    <p className="text-sm whitespace-pre-wrap">{t.admin_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

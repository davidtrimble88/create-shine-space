import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CreditCard, Mail, CheckCircle2, Clock, AlertTriangle, Wallet, Pencil } from "lucide-react";
import { PaymentDialog } from "@/components/PaymentDialog";
import type { SquareRegion } from "@/components/SquarePaymentDialog";
import { useAuth } from "@/contexts/AuthContext";

type DepositRow = {
  id: string;
  booking_id: string;
  total_amount_cents: number;
  deposit_amount_cents: number;
  balance_cents: number;
  deposit_paid_at: string | null;
  balance_paid_at: string | null;
  balance_method: string | null;
  due_date: string;
  status: string;
  created_at: string;
  bookings: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    guardian_email: string | null;
    course: string;
    location: string;
    location_label: string;
    schedule_date: string | null;
  } | null;
};

const courseLabels: Record<string, string> = {
  basic: "Motorcyclist Training Course",
  intermediate: "Intermediate Course",
  advanced: "Advanced Riding Clinic",
};

const money = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

const regionFor = (location: string): SquareRegion =>
  location.startsWith("high-desert") ? "high_desert" : "ventura";

const daysUntil = (date: string) => {
  const due = new Date(`${date}T23:59:59`);
  return Math.ceil((due.getTime() - Date.now()) / 86400000);
};

interface Props {
  onBack: () => void;
}

const DepositPayments = ({ onBack }: Props) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [rows, setRows] = useState<DepositRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"active" | "paid" | "forfeited" | "all">("active");

  const [chargeRow, setChargeRow] = useState<DepositRow | null>(null);
  const [chargeToken, setChargeToken] = useState<string | undefined>();
  const [chargeOpen, setChargeOpen] = useState(false);

  const [manualRow, setManualRow] = useState<DepositRow | null>(null);
  const [manualMethod, setManualMethod] = useState("cash");
  const [sendingId, setSendingId] = useState<string | null>(null);

  const [editRow, setEditRow] = useState<DepositRow | null>(null);
  const [editTotal, setEditTotal] = useState("");
  const [editPaid, setEditPaid] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const toCents = (v: string) => Math.round(Number(v.replace(/[^0-9.]/g, "")) * 100);

  const openEdit = (row: DepositRow) => {
    setEditRow(row);
    setEditTotal((row.total_amount_cents / 100).toFixed(2));
    setEditPaid((row.deposit_amount_cents / 100).toFixed(2));
  };

  const saveEdit = async () => {
    if (!editRow) return;
    const total = toCents(editTotal);
    const paid = toCents(editPaid);
    if (!total || total <= 0) {
      toast({ title: "Enter a valid course total", variant: "destructive" });
      return;
    }
    if (!paid || paid <= 0 || paid > total) {
      toast({ title: "Enter a valid amount already paid", description: "It must be more than $0 and no more than the course total.", variant: "destructive" });
      return;
    }
    const balance = total - paid;
    setSavingEdit(true);
    const { error } = await (supabase as any)
      .from("booking_deposits")
      .update({
        total_amount_cents: total,
        deposit_amount_cents: paid,
        balance_cents: balance,
        deposit_paid_at: editRow.deposit_paid_at ?? new Date().toISOString(),
        status: balance === 0 ? "paid" : "open",
        balance_paid_at: balance === 0 ? new Date().toISOString() : null,
      })
      .eq("id", editRow.id);
    setSavingEdit(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    if (balance === 0) {
      await (supabase as any).from("bookings").update({ payment_status: "paid", pending_payment: false }).eq("id", editRow.booking_id);
    }
    toast({ title: "Deposit updated", description: `Remaining balance is ${money(balance)}.` });
    setEditRow(null);
    fetchRows();
  };


  const fetchRows = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("booking_deposits")
      .select("*, bookings(id, first_name, last_name, email, phone, guardian_email, course, location, location_label, schedule_date)")
      .order("due_date", { ascending: true });
    setRows((data as DepositRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchRows(); }, []);

  const visible = rows.filter(r => {
    if (filter === "all") return true;
    if (filter === "active") return r.status === "open" || r.status === "awaiting_deposit";
    if (filter === "paid") return r.status === "paid";
    return r.status === "forfeited";
  });

  const totals = {
    active: rows.filter(r => r.status === "open" || r.status === "awaiting_deposit").length,
    outstanding: rows.filter(r => r.status === "open").reduce((s, r) => s + r.balance_cents, 0),
    collected: rows.filter(r => r.deposit_paid_at).reduce((s, r) => s + r.deposit_amount_cents, 0),
    overdue: rows.filter(r => r.status === "open" && daysUntil(r.due_date) < 0).length,
  };

  const startBalanceCharge = async (row: DepositRow) => {
    if (!row.bookings) return;
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
    const { error } = await (supabase as any).from("fee_payment_requests").insert({
      booking_id: row.booking_id,
      token,
      fee_type: "balance",
      amount_cents: row.balance_cents,
      note: "Remaining course balance",
      created_by: user?.id ?? null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setChargeRow(row);
    setChargeToken(token);
    setChargeOpen(true);
  };

  const markPaid = async (row: DepositRow, method: string, paymentId?: string) => {
    const now = new Date().toISOString();
    const { error } = await (supabase as any)
      .from("booking_deposits")
      .update({ status: "paid", balance_paid_at: now, balance_method: method, balance_payment_id: paymentId ?? null })
      .eq("id", row.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    await (supabase as any)
      .from("bookings")
      .update({ payment_status: "paid", pending_payment: false })
      .eq("id", row.booking_id);
    toast({ title: "Paid in full", description: `${row.bookings?.first_name} ${row.bookings?.last_name} moved to the main booking list.` });
    setManualRow(null);
    fetchRows();
  };

  const emailBalanceLink = async (row: DepositRow) => {
    const b = row.bookings;
    if (!b) return;
    setSendingId(row.id);
    try {
      const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
      const { error: insErr } = await (supabase as any).from("fee_payment_requests").insert({
        booking_id: row.booking_id,
        token,
        fee_type: "balance",
        amount_cents: row.balance_cents,
        note: "Remaining course balance",
        created_by: user?.id ?? null,
      });
      if (insErr) throw insErr;
      const payLink = `${window.location.origin}/pay-fee?token=${token}`;
      const guardianEmail = (b.guardian_email || "").trim();
      const { error } = await supabase.functions.invoke("send-auto-email", {
        body: {
          trigger_event: "fee_payment_link",
          recipientEmail: b.email,
          location: b.location,
          course: b.course,
          additionalRecipients:
            guardianEmail && guardianEmail.toLowerCase() !== b.email.toLowerCase() ? [guardianEmail] : [],
          variables: {
            firstName: b.first_name,
            lastName: b.last_name,
            course: courseLabels[b.course] || b.course,
            locationLabel: b.location_label,
            scheduleDate: b.schedule_date ? ` — ${b.schedule_date}` : "",
            amount: money(row.balance_cents),
            feeLabel: "remaining course balance",
            note: `Your balance must be paid by ${row.due_date} (7 days before class). If it is not paid by then, your seat will be released and you will be moved to pending reschedule.`,
            payLink,
            email: b.email,
          },
        },
      });
      if (error) throw error;
      toast({ title: "Link sent", description: `Balance payment link sent to ${b.email}.` });
    } catch (e) {
      toast({ title: "Send failed", description: e instanceof Error ? e.message : "Could not send the link", variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  const statusBadge = (row: DepositRow) => {
    if (row.status === "paid") return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400"><CheckCircle2 className="w-3 h-3" /> Paid in full</span>;
    if (row.status === "forfeited") return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive"><AlertTriangle className="w-3 h-3" /> Balance missed</span>;
    if (row.status === "awaiting_deposit") return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400"><Clock className="w-3 h-3" /> Deposit not captured</span>;
    const d = daysUntil(row.due_date);
    return (
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${d < 0 ? "bg-destructive/20 text-destructive" : d <= 3 ? "bg-yellow-500/20 text-yellow-400" : "bg-accent/20 text-accent"}`}>
        <Clock className="w-3 h-3" /> {d < 0 ? `${Math.abs(d)}d overdue` : `${d}d left`}
      </span>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" /> Back to Bookings</Button>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Wallet className="w-6 h-6 text-accent" /> Deposits</h1>
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Balance outstanding</SelectItem>
            <SelectItem value="paid">Paid in full</SelectItem>
            <SelectItem value="forfeited">Missed balance</SelectItem>
            <SelectItem value="all">All deposits</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Open deposits", value: String(totals.active) },
          { label: "Balance outstanding", value: money(totals.outstanding) },
          { label: "Deposits collected", value: money(totals.collected) },
          { label: "Overdue balances", value: String(totals.overdue) },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left p-3 font-medium">Student</th>
              <th className="text-left p-3 font-medium">Class</th>
              <th className="text-right p-3 font-medium">Total</th>
              <th className="text-right p-3 font-medium">Deposit</th>
              <th className="text-right p-3 font-medium">Balance</th>
              <th className="text-left p-3 font-medium">Due</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Loading…</td></tr>}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No deposits in this view.</td></tr>
            )}
            {visible.map(row => (
              <tr key={row.id} className="border-t border-border">
                <td className="p-3">
                  <p className="font-medium text-foreground">{row.bookings?.first_name} {row.bookings?.last_name}</p>
                  <p className="text-xs text-muted-foreground">{row.bookings?.email}</p>
                  <p className="text-xs text-muted-foreground">{row.bookings?.phone}</p>
                </td>
                <td className="p-3">
                  <p className="text-foreground">{courseLabels[row.bookings?.course ?? ""] || row.bookings?.course}</p>
                  <p className="text-xs text-muted-foreground">{row.bookings?.location_label} — {row.bookings?.schedule_date}</p>
                </td>
                <td className="p-3 text-right text-foreground">{money(row.total_amount_cents)}</td>
                <td className="p-3 text-right text-foreground">{money(row.deposit_amount_cents)}</td>
                <td className="p-3 text-right font-semibold text-accent">{money(row.balance_cents)}</td>
                <td className="p-3 text-muted-foreground">{row.due_date}</td>
                <td className="p-3">{statusBadge(row)}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-2 flex-wrap">
                    {row.status !== "paid" && (
                      <>
                        <Button size="sm" onClick={() => startBalanceCharge(row)}>
                          <CreditCard className="w-4 h-4 mr-1" /> Take balance
                        </Button>
                        <Button size="sm" variant="outline" disabled={sendingId === row.id} onClick={() => emailBalanceLink(row)}>
                          <Mail className="w-4 h-4 mr-1" /> {sendingId === row.id ? "Sending…" : "Email link"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setManualRow(row); setManualMethod("cash"); }}>
                          Mark paid
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
                          <Pencil className="w-4 h-4 mr-1" /> Edit amounts
                        </Button>
                      </>
                    )}

                    {row.status === "paid" && (
                      <span className="text-xs text-muted-foreground">Paid {row.balance_paid_at?.split("T")[0]} ({row.balance_method || "card"})</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Balances are due 7 days before the class start date. Any balance still unpaid after that day is automatically
        moved to pending reschedule and the seat is released for another student.
      </p>

      {/* Manual (cash/check) balance payment */}
      <Dialog open={!!manualRow} onOpenChange={(o) => { if (!o) setManualRow(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Record balance payment</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Recording {manualRow ? money(manualRow.balance_cents) : ""} for {manualRow?.bookings?.first_name} {manualRow?.bookings?.last_name}.
            </p>
            <div>
              <Label className="text-xs">Method</Label>
              <Select value={manualMethod} onValueChange={setManualMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="card">Card (recorded only)</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={() => manualRow && markPaid(manualRow, manualMethod)}>Mark paid in full</Button>
          </div>
        </DialogContent>
      </Dialog>

      {chargeRow?.bookings && (
        <PaymentDialog
          open={chargeOpen}
          onOpenChange={(o) => { if (!o) { setChargeOpen(false); setChargeRow(null); setChargeToken(undefined); } }}
          region={regionFor(chargeRow.bookings.location)}
          amountCents={chargeRow.balance_cents}
          amountLabel={money(chargeRow.balance_cents)}
          bookingPayload={chargeRow.bookings as unknown as Record<string, unknown>}
          feeToken={chargeToken}
          phoneAuthorization
          onSuccess={(paymentId) => {
            const row = chargeRow;
            setChargeOpen(false);
            setChargeRow(null);
            setChargeToken(undefined);
            if (row) void markPaid(row, "square", paymentId);
          }}
        />
      )}
    </div>
  );
};

export default DepositPayments;

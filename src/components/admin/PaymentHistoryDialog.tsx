import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatPST } from "@/lib/formatDate";
import { CreditCard, RotateCcw, Loader2 } from "lucide-react";

interface Refund {
  id: string;
  amount_cents: number;
  comment: string;
  created_at: string;
}

interface Transaction {
  id: string;
  amount_cents: number;
  refunded_cents: number;
  card_brand: string | null;
  card_last4: string | null;
  description: string | null;
  status: string;
  created_at: string;
  student_name: string | null;
  student_email: string | null;
  provider_payment_id: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId?: string | null;
  email?: string | null;
  studentName?: string | null;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

interface BookingInfo {
  payment_status: string | null;
  payment_provider: string | null;
  manually_added: boolean | null;
  pending_payment: boolean | null;
  fee: string | null;
  discount_amount_cents: number | null;
  discount_reason: string | null;
  marked_paid_at: string | null;
  created_at: string;
}

const PaymentHistoryDialog = ({ open, onOpenChange, bookingId, email, studentName }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [refunds, setRefunds] = useState<Record<string, Refund[]>>({});
  const [refundTx, setRefundTx] = useState<Transaction | null>(null);
  const [refundMode, setRefundMode] = useState<"full" | "custom">("full");
  const [customAmount, setCustomAmount] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    if (bookingId) {
      const { data: b } = await supabase
        .from("bookings")
        .select("payment_status, payment_provider, manually_added, pending_payment, fee, discount_amount_cents, discount_reason, marked_paid_at, created_at")
        .eq("id", bookingId)
        .maybeSingle();
      setBooking((b as BookingInfo) || null);
    } else {
      setBooking(null);
    }

    let query = supabase.from("payment_transactions").select("*").order("created_at", { ascending: false });
    if (bookingId) query = query.eq("booking_id", bookingId);
    else if (email) query = query.ilike("student_email", email);
    else { setTxns([]); setLoading(false); return; }

    const { data } = await query;
    const list = (data as Transaction[]) || [];
    setTxns(list);


    if (list.length) {
      const { data: refundRows } = await supabase
        .from("payment_refunds")
        .select("id, transaction_id, amount_cents, comment, created_at")
        .in("transaction_id", list.map((t) => t.id))
        .order("created_at", { ascending: false });
      const grouped: Record<string, Refund[]> = {};
      (refundRows || []).forEach((r: any) => {
        (grouped[r.transaction_id] ||= []).push(r);
      });
      setRefunds(grouped);
    } else {
      setRefunds({});
    }
    setLoading(false);
  }, [bookingId, email]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const remaining = (t: Transaction) => t.amount_cents - (t.refunded_cents || 0);

  const openRefund = (t: Transaction) => {
    setRefundTx(t);
    setRefundMode("full");
    setCustomAmount((remaining(t) / 100).toFixed(2));
    setComment("");
  };

  const submitRefund = async () => {
    if (!refundTx) return;
    const amountCents =
      refundMode === "full"
        ? remaining(refundTx)
        : Math.round(Number(customAmount.replace(/[^0-9.]/g, "")) * 100);

    if (!amountCents || amountCents <= 0) {
      toast({ title: "Enter a valid refund amount", variant: "destructive" });
      return;
    }
    if (amountCents > remaining(refundTx)) {
      toast({ title: `Refund cannot exceed ${money(remaining(refundTx))}`, variant: "destructive" });
      return;
    }
    if (comment.trim().length < 3) {
      toast({ title: "A comment is required", description: "Please explain the reason for this refund.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("square-refund", {
      body: { transactionId: refundTx.id, amountCents, comment: comment.trim() },
    });

    // functions.invoke hides the response body on non-2xx — read it from the context.
    let serverError: string | null = (data as any)?.error ?? null;
    if (error && !serverError) {
      try {
        const res = (error as any)?.context as Response | undefined;
        if (res && typeof res.json === "function") {
          const body = await res.clone().json();
          serverError = body?.error || (body?.details ? JSON.stringify(body.details) : null);
        }
      } catch {
        /* ignore parse failures */
      }
    }
    setSubmitting(false);

    if (error || serverError) {
      toast({
        title: "Refund failed",
        description: serverError || error?.message || "Please try again.",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Refund issued", description: `${money(amountCents)} refunded.` });
    setRefundTx(null);
    load();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Financial History{studentName ? ` — ${studentName}` : ""}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="py-10 text-center text-muted-foreground">Loading…</div>
          ) : txns.length === 0 ? (
            <div className="py-6">
              {booking?.pending_payment ? (
                <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm space-y-1">
                  <p className="font-semibold text-foreground">Payment on hold — nothing collected yet</p>
                  <p className="text-muted-foreground">
                    This registration is a cash hold. No card has been processed, so there is no payment history.
                  </p>
                </div>
              ) : booking?.payment_status === "paid" ? (
                <div className="rounded-lg border border-border bg-secondary/30 p-4 text-sm space-y-2">
                  <p className="font-semibold text-foreground">Recorded as paid offline — no card processed on the site</p>
                  <p className="text-muted-foreground leading-relaxed">
                    This booking was {booking.manually_added ? "manually added by staff" : "marked paid by staff"} with the
                    payment method set to <span className="font-medium text-foreground">{booking.payment_provider || "offline"}</span>
                    {booking.fee ? <> for <span className="font-medium text-foreground">{booking.fee}</span></> : null}.
                    Because it was never run through the card terminal, there is no transaction or refund history to show here.
                  </p>
                  {!!booking.discount_amount_cents && (
                    <p className="text-xs text-muted-foreground">
                      Discount applied: {money(booking.discount_amount_cents)}{booking.discount_reason ? ` — ${booking.discount_reason}` : ""}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Recorded {formatPST(booking.marked_paid_at || booking.created_at)}. If money was actually taken by card,
                    re-run it through “Take Square Payment” so it appears in reporting.
                  </p>
                </div>
              ) : (
                <div className="py-4 text-center text-muted-foreground text-sm">
                  No recorded card payments for this student.
                </div>
              )}
            </div>

          ) : (
            <div className="space-y-3">
              {txns.map((t) => (
                <div key={t.id} className="border border-border rounded-lg p-4 bg-card">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-semibold text-foreground">{money(t.amount_cents)}</p>
                      <p className="text-xs text-muted-foreground">{formatPST(t.created_at)}</p>
                      <p className="text-sm text-muted-foreground mt-1">{t.description || "Course payment"}</p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5" />
                        {t.card_brand || "Card"} •••• {t.card_last4 || "????"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        t.status === "refunded" ? "bg-red-500/20 text-red-400" :
                        t.status === "partially_refunded" ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-green-500/20 text-green-400"
                      }`}>{t.status.replace("_", " ")}</span>
                      {t.refunded_cents > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">Refunded {money(t.refunded_cents)}</p>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        disabled={remaining(t) <= 0}
                        onClick={() => openRefund(t)}
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Refund
                      </Button>
                    </div>
                  </div>

                  {(refunds[t.id] || []).length > 0 && (
                    <div className="mt-3 border-t border-border pt-3 space-y-2">
                      {(refunds[t.id] || []).map((r) => (
                        <div key={r.id} className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">-{money(r.amount_cents)}</span>{" "}
                          on {formatPST(r.created_at)} — {r.comment}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!refundTx} onOpenChange={(o) => { if (!o) setRefundTx(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Issue Refund</DialogTitle>
          </DialogHeader>
          {refundTx && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Available to refund: <span className="font-medium text-foreground">{money(remaining(refundTx))}</span>
                {" "}on {refundTx.card_brand || "card"} •••• {refundTx.card_last4 || "????"}
              </p>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={refundMode === "full" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRefundMode("full")}
                >
                  Full amount
                </Button>
                <Button
                  type="button"
                  variant={refundMode === "custom" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRefundMode("custom")}
                >
                  Custom amount
                </Button>
              </div>

              {refundMode === "custom" && (
                <div>
                  <Label htmlFor="refund-amount">Refund amount ($)</Label>
                  <Input
                    id="refund-amount"
                    inputMode="decimal"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                  />
                </div>
              )}

              <div>
                <Label htmlFor="refund-comment">Reason / comment (required)</Label>
                <Textarea
                  id="refund-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Why is this refund being issued?"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRefundTx(null)}>Cancel</Button>
                <Button onClick={submitRefund} disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Issue Refund
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PaymentHistoryDialog;

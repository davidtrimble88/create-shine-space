import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface Row {
  transaction_id: string;
  booking_id: string | null;
  student_name: string | null;
  student_email: string | null;
  amount_cents: number;
  provider_payment_id: string | null;
  paid_at: string;
  booking_status: string | null;
  payment_status: string | null;
  pending_payment: boolean | null;
  course: string | null;
  location_label: string | null;
  schedule_date: string | null;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * Watchdog: a payment was captured but the registration behind it is not
 * marked paid/confirmed. This is the failure mode that once left a paying
 * student off the roster with his seat looking open.
 */
const PaidUnconfirmedAlert = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("paid_unconfirmed_bookings");
    if (error) console.error("paid_unconfirmed_bookings failed", error);
    setRows((data as Row[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirmBooking = async (row: Row) => {
    if (!row.booking_id) {
      toast({
        title: "No registration linked",
        description: "This payment has no registration attached. Look it up in the payment provider and add the student manually.",
        variant: "destructive",
      });
      return;
    }
    setFixing(row.transaction_id);
    const { error } = await supabase
      .from("bookings")
      .update({
        payment_status: "paid",
        booking_status: "confirmed",
        pending_payment: false,
        marked_paid_at: new Date().toISOString(),
      })
      .eq("id", row.booking_id);
    setFixing(null);
    if (error) {
      toast({ title: "Could not confirm", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Registration confirmed", description: "The student is now on the roster and their seat is counted." });
    load();
  };

  if (loading || rows.length === 0) return null;

  return (
    <div className="mb-8 rounded-xl border border-destructive/40 bg-destructive/5 p-6">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-foreground">
              {rows.length} payment{rows.length === 1 ? "" : "s"} taken without a confirmed registration
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Money was collected but the student is not marked paid/confirmed — they will not appear on the roster and their
              seat is not counted. Confirm each one below.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-2" /> Recheck
        </Button>
      </div>

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.transaction_id} className="rounded-lg border border-border bg-card p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="font-medium text-foreground">
                {r.student_name || r.student_email || "Unknown student"} · {money(r.amount_cents)}
              </p>
              <p className="text-sm text-muted-foreground">
                {[r.course, r.location_label, r.schedule_date].filter(Boolean).join(" · ") || "No class on file"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Paid {new Date(r.paid_at).toLocaleString()} · Status: {r.booking_status || "no registration"} /{" "}
                {r.payment_status || "—"}
                {r.provider_payment_id ? ` · Ref ${r.provider_payment_id}` : ""}
              </p>
            </div>
            <Button size="sm" disabled={fixing === r.transaction_id} onClick={() => confirmBooking(r)}>
              <Check className="w-4 h-4 mr-2" />
              {fixing === r.transaction_id ? "Confirming…" : "Confirm registration"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PaidUnconfirmedAlert;

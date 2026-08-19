import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, Download, FileSpreadsheet, Printer, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { formatPSTDate } from "@/lib/formatDate";

const TZ = "America/Los_Angeles";
const ptDay = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const ptStart = (dayStr: string) => {
  const guess = new Date(`${dayStr}T08:00:00Z`);
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).format(guess)) % 24;
  return new Date(guess.getTime() - h * 3600000).toISOString();
};
const shiftDay = (dayStr: string, days: number) =>
  new Date(new Date(`${dayStr}T00:00:00Z`).getTime() + days * 86400000).toISOString().split("T")[0];

const parseFee = (fee: string | null) => {
  const v = parseFloat((fee || "0").replace(/[^0-9.]/g, ""));
  return isNaN(v) ? 0 : v;
};
const money = (n: number) => `$${n.toFixed(2)}`;

interface Row {
  id: string;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  course: string;
  location_label: string;
  schedule_date: string | null;
  fee: string | null;
  payment_provider: string | null;
  payment_status: string;
  discount_amount_cents: number | null;
  discount_code: string | null;
  manually_added: boolean;
}

interface RefundRow {
  id: string;
  amount_cents: number;
  comment: string;
  created_at: string;
  transaction_id: string;
  payment_transactions?: { student_name: string | null; student_email: string | null; description: string | null } | null;
}

interface FeeRow {
  id: string;
  amount_cents: number;
  fee_type: string;
  note: string | null;
  paid_at: string | null;
  bookings?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    location_label: string | null;
    course: string | null;
  } | null;
}

const feeTypeLabels: Record<string, string> = {
  late: "Late Arrival Fee",
  retest: "Retest Fee",
  reschedule: "Reschedule Fee",
  no_show: "No-Show Fee",
  other: "Other Fee",
};
const feeLabel = (t: string) => feeTypeLabels[t] || t.replace(/_/g, " ");


const FinancialReport = () => {
  const [from, setFrom] = useState<Date | undefined>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [to, setTo] = useState<Date | undefined>(new Date());
  const [rows, setRows] = useState<Row[]>([]);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [txByBooking, setTxByBooking] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  const load = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    const start = ptStart(ptDay(from));
    const end = ptStart(shiftDay(ptDay(to), 1));
    const [bRes, rRes, fRes] = await Promise.all([
      supabase
        .from("bookings")
        .select("id, created_at, first_name, last_name, email, course, location_label, schedule_date, fee, payment_provider, payment_status, discount_amount_cents, discount_code, manually_added")
        .eq("payment_status", "paid")
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: true }),
      supabase
        .from("payment_refunds")
        .select("id, amount_cents, comment, created_at, transaction_id, payment_transactions(student_name, student_email, description)")
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: true }),
      supabase
        .from("fee_payment_requests")
        .select("id, amount_cents, fee_type, note, paid_at, bookings(first_name, last_name, email, location_label, course)")
        .eq("status", "paid")
        .gte("paid_at", start)
        .lt("paid_at", end)
        .order("paid_at", { ascending: true }),
    ]);
    const bookingRows = (bRes.data as unknown as Row[]) || [];
    setRows(bookingRows);
    setRefunds((rRes.data as unknown as RefundRow[]) || []);
    setFees((fRes.data as unknown as FeeRow[]) || []);

    // Real charges processed through the site, per booking (gross; refunds are reported separately)
    const txMap: Record<string, number> = {};
    const ids = bookingRows.map((r) => r.id);
    for (let i = 0; i < ids.length; i += 100) {
      const { data: txData } = await supabase
        .from("payment_transactions")
        .select("booking_id, amount_cents, status")
        .in("booking_id", ids.slice(i, i + 100));
      ((txData as Array<{ booking_id: string | null; amount_cents: number; status: string }>) || []).forEach((t) => {
        if (!t.booking_id) return;
        if (["failed", "canceled", "refunded"].includes(t.status)) return;
        txMap[t.booking_id] = (txMap[t.booking_id] || 0) + t.amount_cents / 100;
      });
    }
    setTxByBooking(txMap);
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const runBackfill = async () => {
    setBackfilling(true);
    const { data, error } = await supabase.functions.invoke("square-backfill-transactions", {
      body: { since: "2025-01-01T00:00:00Z" },
    });
    setBackfilling(false);
    if (error) {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Square import complete",
      description: `${data?.imported ?? 0} payment(s) imported · ${data?.unmatched ?? 0} site booking(s) had no matching Square payment.`,
    });
    load();
  };

  // Only money actually received: Square charges captured on the site, or cash /
  // in-office card recorded by staff. Skipped, unpaid and pending-payment bookings
  // are excluded by the query; "paid" rows with no payment evidence are excluded here.
  const OFFLINE_PROVIDERS = ["cash", "card", "other"];
  const isProcessed = (r: Row) => txByBooking[r.id] !== undefined;
  const offlineAmount = (r: Row) =>
    isProcessed(r) || !OFFLINE_PROVIDERS.includes((r.payment_provider || "").toLowerCase())
      ? 0
      : Math.max(0, parseFee(r.fee) - (r.discount_amount_cents || 0) / 100);
  const collected = (r: Row) => (isProcessed(r) ? txByBooking[r.id] : offlineAmount(r));

  const paidRows = rows.filter((r) => collected(r) > 0);
  const unverifiedRows = rows.filter((r) => collected(r) <= 0);
  const processedTotal = rows.reduce((s, r) => s + (isProcessed(r) ? txByBooking[r.id] : 0), 0);
  const offlineTotal = rows.reduce((s, r) => s + offlineAmount(r), 0);
  const gross = processedTotal + offlineTotal;
  const discounts = rows.reduce((s, r) => s + (r.discount_amount_cents || 0), 0) / 100;
  const refundTotal = refunds.reduce((s, r) => s + r.amount_cents, 0) / 100;
  const feeTotal = fees.reduce((s, f) => s + f.amount_cents, 0) / 100;
  const net = gross + feeTotal - refundTotal;

  const group = (key: (r: Row) => string) => {
    const m: Record<string, { total: number; count: number }> = {};
    paidRows.forEach((r) => {
      const k = key(r) || "Unknown";
      if (!m[k]) m[k] = { total: 0, count: 0 };
      m[k].total += collected(r);
      m[k].count += 1;
    });
    return Object.entries(m).sort((a, b) => b[1].total - a[1].total);
  };

  const byLocation = group((r) => r.location_label);
  const byCourse = group((r) => r.course);
  const byMethod = group((r) => (isProcessed(r) ? "square (site)" : `${r.payment_provider} (offline)`));

  const groupFees = (key: (f: FeeRow) => string) => {
    const m: Record<string, { total: number; count: number }> = {};
    fees.forEach((f) => {
      const k = key(f) || "Unknown";
      if (!m[k]) m[k] = { total: 0, count: 0 };
      m[k].total += f.amount_cents / 100;
      m[k].count += 1;
    });
    return Object.entries(m).sort((a, b) => b[1].total - a[1].total);
  };

  const feesByLocation = groupFees((f) => f.bookings?.location_label || "Unknown");
  const feesByType = groupFees((f) => feeLabel(f.fee_type));

  // Combined per-site: registrations + fees
  const combinedBySite = (() => {
    const m: Record<string, { reg: number; regCount: number; fee: number; feeCount: number }> = {};
    byLocation.forEach(([k, v]) => {
      m[k] = { reg: v.total, regCount: v.count, fee: 0, feeCount: 0 };
    });
    feesByLocation.forEach(([k, v]) => {
      if (!m[k]) m[k] = { reg: 0, regCount: 0, fee: 0, feeCount: 0 };
      m[k].fee += v.total;
      m[k].feeCount += v.count;
    });
    return Object.entries(m).sort((a, b) => (b[1].reg + b[1].fee) - (a[1].reg + a[1].fee));
  })();

  const byMonth = Object.entries(
    paidRows.reduce((m: Record<string, number>, r) => {
      const k = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).format(new Date(r.created_at));
      m[k] = (m[k] || 0) + collected(r);
      return m;
    }, {})
  ).sort((a, b) => a[0].localeCompare(b[0]));


  const downloadCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines: string[] = [];
    lines.push(`Financial Report,${formatPSTDate(from)} to ${formatPSTDate(to)}`);
    lines.push("");
    lines.push("SUMMARY");
    lines.push(`Registration money received,${gross.toFixed(2)}`);
    lines.push(`  Processed on site (Square),${processedTotal.toFixed(2)}`);
    lines.push(`  Recorded offline (cash/office card),${offlineTotal.toFixed(2)}`);
    lines.push(`Fees collected,${feeTotal.toFixed(2)}`);
    lines.push(`Discounts applied,${discounts.toFixed(2)}`);
    lines.push(`Refunds,${refundTotal.toFixed(2)}`);
    lines.push(`Net revenue (registrations + fees - refunds),${net.toFixed(2)}`);
    lines.push(`Paid registrations,${paidRows.length}`);
    lines.push(`Marked paid with no payment record (excluded),${unverifiedRows.length}`);
    lines.push(`Paid fees,${fees.length}`);
    lines.push("");
    lines.push("BY SITE — REGISTRATIONS + FEES");
    lines.push(["Site", "Registrations", "Registration Revenue", "Fees Paid", "Fee Revenue", "Combined"].join(","));
    combinedBySite.forEach(([site, v]) => {
      lines.push([site, v.regCount, v.reg.toFixed(2), v.feeCount, v.fee.toFixed(2), (v.reg + v.fee).toFixed(2)].map(esc).join(","));
    });
    lines.push(["ALL SITES", paidRows.length, gross.toFixed(2), fees.length, feeTotal.toFixed(2), (gross + feeTotal).toFixed(2)].map(esc).join(","));
    lines.push("");
    lines.push("FEES COLLECTED");
    lines.push(["Date (PT)", "Student", "Site", "Fee Type", "Note", "Amount"].join(","));
    fees.forEach((f) => {
      lines.push([
        formatPSTDate(f.paid_at),
        `${f.bookings?.first_name ?? ""} ${f.bookings?.last_name ?? ""}`.trim(),
        f.bookings?.location_label ?? "",
        feeLabel(f.fee_type),
        f.note ?? "",
        (f.amount_cents / 100).toFixed(2),
      ].map(esc).join(","));
    });
    lines.push("");

    lines.push("TRANSACTIONS (money received)");
    lines.push(["Date (PT)", "Student", "Email", "Course", "Location", "Class Date", "Payment Method", "Verified", "Source", "Discount", "Amount Received"].join(","));
    paidRows.forEach((r) => {
      lines.push([
        formatPSTDate(r.created_at),
        `${r.first_name} ${r.last_name}`,
        r.email,
        r.course,
        r.location_label,
        r.schedule_date ?? "",
        r.payment_provider ?? "unrecorded",
        isProcessed(r) ? "Square transaction" : "Staff recorded",
        r.manually_added ? "Office" : "Website",
        ((r.discount_amount_cents || 0) / 100).toFixed(2),
        collected(r).toFixed(2),
      ].map(esc).join(","));
    });
    lines.push("");
    if (unverifiedRows.length > 0) {
      lines.push("MARKED PAID — NO PAYMENT RECORD (excluded from totals)");
      lines.push(["Date (PT)", "Student", "Email", "Location", "List Price"].join(","));
      unverifiedRows.forEach((r) => {
        lines.push([formatPSTDate(r.created_at), `${r.first_name} ${r.last_name}`, r.email, r.location_label, parseFee(r.fee).toFixed(2)].map(esc).join(","));
      });
      lines.push("");
    }
    lines.push("REFUNDS");
    lines.push(["Date (PT)", "Student", "Description", "Comment", "Amount"].join(","));
    refunds.forEach((r) => {
      lines.push([
        formatPSTDate(r.created_at),
        r.payment_transactions?.student_name ?? "",
        r.payment_transactions?.description ?? "",
        r.comment,
        (r.amount_cents / 100).toFixed(2),
      ].map(esc).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financial-report-${ptDay(from || new Date())}_to_${ptDay(to || new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const Section = ({ title, data }: { title: string; data: [string, { total: number; count: number }][] }) => (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="font-semibold text-foreground mb-3">{title}</h3>
      <div className="space-y-2">
        {data.length === 0 && <p className="text-sm text-muted-foreground">No revenue in this period.</p>}
        {data.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground capitalize">{k} <span className="text-xs">({v.count})</span></span>
            <span className="font-medium text-foreground">{money(v.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="mt-10 print:mt-0">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-accent" /> CPA Financial Report
          </h2>
          <p className="text-sm text-muted-foreground">Accountant-ready revenue, discount and refund summary for any date range.</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button size="sm" variant="outline" onClick={runBackfill} disabled={backfilling}>
            <RefreshCw className={cn("w-4 h-4 mr-1", backfilling && "animate-spin")} />
            {backfilling ? "Importing…" : "Import Past Square Payments"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          <Button size="sm" onClick={downloadCsv}>
            <Download className="w-4 h-4 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="flex gap-3 mb-5 items-center flex-wrap print:hidden">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn(!from && "text-muted-foreground")}>
              <CalendarDays className="w-4 h-4 mr-1" />
              {from ? format(from, "MMM d, yyyy") : "From date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={from} onSelect={setFrom} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <span className="text-muted-foreground">→</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn(!to && "text-muted-foreground")}>
              <CalendarDays className="w-4 h-4 mr-1" />
              {to ? format(to, "MMM d, yyyy") : "To date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={to} onSelect={setTo} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        {loading && <span className="text-sm text-muted-foreground">Loading…</span>}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: "Registration Revenue", value: money(gross) },
          { label: "Fees Collected", value: money(feeTotal) },
          { label: "Discounts Applied", value: money(discounts) },
          { label: "Refunds Issued", value: money(refundTotal) },
          { label: "Net Revenue", value: money(net) },
        ].map((c) => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-5">
            <p className="text-2xl font-bold text-foreground">{c.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h3 className="font-semibold text-foreground mb-3">Registrations &amp; Fees by Site</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 pr-3">Site</th>
                <th className="py-2 pr-3 text-right">Registrations</th>
                <th className="py-2 pr-3 text-right">Registration $</th>
                <th className="py-2 pr-3 text-right">Fees Paid</th>
                <th className="py-2 pr-3 text-right">Fee $</th>
                <th className="py-2 text-right">Combined</th>
              </tr>
            </thead>
            <tbody>
              {combinedBySite.length === 0 && (
                <tr><td colSpan={6} className="py-3 text-muted-foreground">No revenue in this period.</td></tr>
              )}
              {combinedBySite.map(([site, v]) => (
                <tr key={site} className="border-b border-border/50">
                  <td className="py-2 pr-3">{site}</td>
                  <td className="py-2 pr-3 text-right text-muted-foreground">{v.regCount}</td>
                  <td className="py-2 pr-3 text-right">{money(v.reg)}</td>
                  <td className="py-2 pr-3 text-right text-muted-foreground">{v.feeCount}</td>
                  <td className="py-2 pr-3 text-right">{money(v.fee)}</td>
                  <td className="py-2 text-right font-semibold">{money(v.reg + v.fee)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border font-semibold">
                <td className="py-2 pr-3">All Sites</td>
                <td className="py-2 pr-3 text-right">{rows.length}</td>
                <td className="py-2 pr-3 text-right">{money(gross)}</td>
                <td className="py-2 pr-3 text-right">{fees.length}</td>
                <td className="py-2 pr-3 text-right">{money(feeTotal)}</td>
                <td className="py-2 text-right text-accent">{money(gross + feeTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Section title="Registration Revenue by Location" data={byLocation} />
        <Section title="Fees by Location" data={feesByLocation} />
        <Section title="Fees by Type" data={feesByType} />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Section title="Revenue by Course" data={byCourse} />
        <Section title="Revenue by Payment Method" data={byMethod} />
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h3 className="font-semibold text-foreground mb-3">Fees Collected ({fees.length})</h3>
        {fees.length === 0 ? (
          <p className="text-sm text-muted-foreground">No fees paid in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Student</th>
                  <th className="py-2 pr-3">Site</th>
                  <th className="py-2 pr-3">Fee Type</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {fees.map((f) => (
                  <tr key={f.id} className="border-b border-border/50">
                    <td className="py-2 pr-3">{formatPSTDate(f.paid_at)}</td>
                    <td className="py-2 pr-3">{`${f.bookings?.first_name ?? ""} ${f.bookings?.last_name ?? ""}`.trim() || "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{f.bookings?.location_label ?? "—"}</td>
                    <td className="py-2 pr-3 capitalize">{feeLabel(f.fee_type)}</td>
                    <td className="py-2 text-right font-medium">{money(f.amount_cents / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {byMonth.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-foreground mb-3">Revenue by Month</h3>
          <div className="space-y-2">
            {byMonth.map(([m, total]) => (
              <div key={m} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{m}</span>
                <span className="font-medium text-foreground">{money(total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-3">Refunds ({refunds.length})</h3>
        {refunds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No refunds in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Student</th>
                  <th className="py-2 pr-3">Reason</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-2 pr-3">{formatPSTDate(r.created_at)}</td>
                    <td className="py-2 pr-3">{r.payment_transactions?.student_name ?? "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.comment}</td>
                    <td className="py-2 text-right font-medium">{money(r.amount_cents / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialReport;

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, MapPin, CalendarDays, TrendingUp, Ban, UserX, CalendarX, CheckCircle2, XCircle, RefreshCcw, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import DepositAnalytics from "./DepositAnalytics";
import { format } from "date-fns";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useAuth } from "@/contexts/AuthContext";
import PaymentHistoryDialog from "./PaymentHistoryDialog";
import FinancialReport from "./FinancialReport";

interface StudentHit {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

type ViewMode = "all" | "by-site" | "by-date";
type DateRange = "all-time" | "today" | "yesterday" | "7days" | "30days" | "this-month" | "this-year" | "last-year" | "custom";

interface EarningRow {
  id: string;
  fee: string | null;
  location_label: string;
  created_at: string;
  first_name?: string | null;
  last_name?: string | null;
  discount_amount_cents?: number | null;
  payment_provider?: string | null;
}

interface TxRow {
  booking_id: string | null;
  amount_cents: number;
  refunded_cents: number;
  status: string;
}

interface OpsStats {
  cancellations: number;
  fullCancellations: number;
  partialCancellations: number;
  drops: number;
  dropsRescheduleable: number;
  dropsFinal: number;
  noShows: number;
  needsReschedule: number;
  passed: number;
  failed: number;
  resultsTotal: number;
}

interface FeeRow {
  id: string;
  amount_cents: number;
  fee_type: string;
  note: string | null;
  paid_at: string | null;
  bookings: { first_name: string; last_name: string; location_label: string | null } | null;
}

const parseFee = (fee: string | null) => {
  const val = parseFloat((fee || "0").replace(/[^0-9.]/g, ""));
  return isNaN(val) ? 0 : val;
};

const feeLabel = (t: string) =>
  ({ late: "Late Arrival Fee", retest: "Retest Fee", reschedule: "Reschedule Fee", replacement: "Replacement Fee", other: "Other Fee" } as Record<string, string>)[t] ||
  t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const siteRegion = (label: string | null | undefined) => (label || "").split(" — ")[0];

const EarningsAnalytics = () => {
  const [rows, setRows] = useState<EarningRow[]>([]);
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [txByBooking, setTxByBooking] = useState<Record<string, number>>({});
  const [ops, setOps] = useState<OpsStats>({
    cancellations: 0, fullCancellations: 0, partialCancellations: 0,
    drops: 0, dropsRescheduleable: 0, dropsFinal: 0,
    noShows: 0, needsReschedule: 0,
    passed: 0, failed: 0, resultsTotal: 0,
  });
  const [loading, setLoading] = useState(true);
  const [rangeBounds, setRangeBounds] = useState<{ from: string; to: string } | null>(null);
  const { effectiveRole } = useAuth();
  const isOwner = effectiveRole === "owner";
  const [financeSearchOpen, setFinanceSearchOpen] = useState(false);
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<StudentHit[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentHit | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const searchStudents = async (q: string) => {
    const term = q.trim();
    if (term.length < 2) { setStudentResults([]); return; }
    const like = `%${term}%`;
    const { data } = await supabase
      .from("bookings")
      .select("id, first_name, last_name, email")
      .or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(50);
    const seen = new Set<string>();
    const unique: StudentHit[] = [];
    (data || []).forEach((r: any) => {
      const key = (r.email || `${r.first_name} ${r.last_name}`).toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(r as StudentHit);
    });
    setStudentResults(unique);
  };

  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [dateRange, setDateRange] = useState<DateRange>("30days");
  const [siteFilter, setSiteFilter] = useState<"all" | "High Desert" | "Ventura County">("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  // All ranges are computed in Pacific Time (business timezone), not UTC.
  const TZ = "America/Los_Angeles";
  const ptDay = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  // UTC instant corresponding to 00:00 Pacific on the given YYYY-MM-DD
  const ptStart = (dayStr: string) => {
    const guess = new Date(`${dayStr}T08:00:00Z`);
    const h = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).format(guess)
    ) % 24;
    return new Date(guess.getTime() - h * 3600000).toISOString();
  };
  const shiftDay = (dayStr: string, days: number) =>
    new Date(new Date(`${dayStr}T00:00:00Z`).getTime() + days * 86400000).toISOString().split("T")[0];

  const getDateBounds = (): { from: string; to: string } => {
    const now = new Date();
    const todayStr = ptDay(now);
    const tomorrowStr = shiftDay(todayStr, 1);

    switch (dateRange) {
      case "all-time":
        return { from: "2000-01-01T00:00:00Z", to: ptStart(tomorrowStr) };
      case "today":
        return { from: ptStart(todayStr), to: ptStart(tomorrowStr) };
      case "yesterday":
        return { from: ptStart(shiftDay(todayStr, -1)), to: ptStart(todayStr) };
      case "7days":
        return { from: ptStart(shiftDay(todayStr, -7)), to: ptStart(tomorrowStr) };
      case "30days":
        return { from: ptStart(shiftDay(todayStr, -30)), to: ptStart(tomorrowStr) };
      case "this-month":
        return { from: ptStart(`${todayStr.slice(0, 7)}-01`), to: ptStart(tomorrowStr) };
      case "this-year":
        return { from: ptStart(`${todayStr.slice(0, 4)}-01-01`), to: ptStart(tomorrowStr) };
      case "last-year": {
        const y = Number(todayStr.slice(0, 4)) - 1;
        return { from: ptStart(`${y}-01-01`), to: ptStart(`${y + 1}-01-01`) };
      }
      case "custom": {
        const f = customFrom ? ptDay(customFrom) : todayStr;
        const t = customTo ? shiftDay(ptDay(customTo), 1) : tomorrowStr;
        return { from: ptStart(f), to: ptStart(t) };
      }
      default:
        return { from: ptStart(todayStr), to: ptStart(tomorrowStr) };
    }
  };


  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const { from, to } = getDateBounds();
      setRangeBounds({ from, to });

      const [earningsRes, dropsRes, noShowRes, rescheduleRes, resultsRes, cancelRes, feesRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, fee, location_label, created_at, first_name, last_name, discount_amount_cents, payment_provider")
          .eq("payment_status", "paid")
          .gte("created_at", from)
          .lt("created_at", to)
          .order("created_at", { ascending: false }),
        supabase
          .from("bookings")
          .select("id, needs_reschedule, dropped_at")
          .eq("dropped", true)
          .gte("dropped_at", from)
          .lt("dropped_at", to),
        supabase
          .from("bookings")
          .select("id, reschedule_reason")
          .eq("needs_reschedule", true)
          .ilike("reschedule_reason", "No-show%")
          .gte("updated_at", from)
          .lt("updated_at", to),
        supabase
          .from("bookings")
          .select("id")
          .eq("needs_reschedule", true)
          .gte("updated_at", from)
          .lt("updated_at", to),
        supabase
          .from("bookings")
          .select("id, result")
          .not("result", "is", null)
          .gte("updated_at", from)
          .lt("updated_at", to),
        supabase
          .from("schedule_cancellations")
          .select("id, cancelled_part, cancelled_at")
          .gte("cancelled_at", from)
          .lt("cancelled_at", to),
        supabase
          .from("fee_payment_requests")
          .select("id, amount_cents, fee_type, note, paid_at, bookings(first_name, last_name, location_label)")
          .eq("status", "paid")
          .gte("paid_at", from)
          .lt("paid_at", to)
          .order("paid_at", { ascending: false }),
      ]);

      const bookingRows = (earningsRes.data as EarningRow[]) || [];
      setRows(bookingRows);
      setFees((feesRes.data as unknown as FeeRow[]) || []);

      // Actual money processed through the site, net of refunds, per booking
      const txMap: Record<string, number> = {};
      const ids = bookingRows.map((r) => r.id).filter(Boolean);
      for (let i = 0; i < ids.length; i += 100) {
        const { data: txData } = await supabase
          .from("payment_transactions")
          .select("booking_id, amount_cents, refunded_cents, status")
          .in("booking_id", ids.slice(i, i + 100));
        ((txData as TxRow[]) || []).forEach((t) => {
          if (!t.booking_id) return;
          if (t.status === "failed" || t.status === "canceled" || t.status === "refunded") {
            txMap[t.booking_id] = txMap[t.booking_id] || 0;
            if (t.status === "refunded") return;
            return;
          }
          txMap[t.booking_id] = (txMap[t.booking_id] || 0) + (t.amount_cents - (t.refunded_cents || 0)) / 100;
        });
      }
      setTxByBooking(txMap);

      const dropsArr = (dropsRes.data as Array<{ needs_reschedule: boolean }>) || [];
      const noShowArr = noShowRes.data || [];
      const rescheduleArr = rescheduleRes.data || [];
      const resultsArr = (resultsRes.data as Array<{ result: string | null }>) || [];
      const cancelArr = (cancelRes.data as Array<{ cancelled_part: string }>) || [];

      const passed = resultsArr.filter(r => (r.result || "").toLowerCase() === "pass").length;
      const failed = resultsArr.filter(r => (r.result || "").toLowerCase() === "fail").length;
      const fullCancel = cancelArr.filter(c => c.cancelled_part === "full").length;

      setOps({
        cancellations: cancelArr.length,
        fullCancellations: fullCancel,
        partialCancellations: cancelArr.length - fullCancel,
        drops: dropsArr.length,
        dropsRescheduleable: dropsArr.filter(d => d.needs_reschedule).length,
        dropsFinal: dropsArr.filter(d => !d.needs_reschedule).length,
        noShows: noShowArr.length,
        needsReschedule: rescheduleArr.length,
        passed,
        failed,
        resultsTotal: resultsArr.length,
      });

      setLoading(false);
    };
    run();
  }, [dateRange, customFrom, customTo]);

  // Money actually collected for a booking:
  // - Processed through the site (Square) -> the real charge, net of refunds
  // - Otherwise recorded offline by staff (cash / card taken in office) -> price after discount
  // Skipped / unpaid / pending-payment bookings are never included (query filters payment_status = 'paid').
  const OFFLINE_PROVIDERS = ["cash", "card", "other"];
  const processedAmount = (r: EarningRow) => txByBooking[r.id] ?? 0;
  const isProcessed = (r: EarningRow) => txByBooking[r.id] !== undefined;
  const offlineAmount = (r: EarningRow) =>
    isProcessed(r) || !OFFLINE_PROVIDERS.includes((r.payment_provider || "").toLowerCase())
      ? 0
      : Math.max(0, parseFee(r.fee) - (r.discount_amount_cents || 0) / 100);
  const collected = (r: EarningRow) => (isProcessed(r) ? processedAmount(r) : offlineAmount(r));

  const processedTotal = rows.reduce((s, r) => s + processedAmount(r), 0);
  const offlineTotal = rows.reduce((s, r) => s + offlineAmount(r), 0);
  const processedCount = rows.filter((r) => isProcessed(r)).length;
  const offlineCount = rows.filter((r) => offlineAmount(r) > 0).length;
  const unverifiedRows = rows.filter((r) => !isProcessed(r) && offlineAmount(r) === 0);
  const totalEarnings = processedTotal + offlineTotal;
  const transactionCount = processedCount + offlineCount;

  // Group by site
  const bySite: Record<string, { total: number; count: number }> = {};
  rows.forEach((r) => {
    const amt = collected(r);
    if (amt <= 0) return;
    const loc = r.location_label || "Unknown";
    if (!bySite[loc]) bySite[loc] = { total: 0, count: 0 };
    bySite[loc].total += amt;
    bySite[loc].count += 1;
  });

  // Fees
  const feeTotal = fees.reduce((s, f) => s + f.amount_cents, 0) / 100;
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

  const combinedBySite = (() => {
    const m: Record<string, { reg: number; regCount: number; fee: number; feeCount: number }> = {};
    Object.entries(bySite).forEach(([k, v]) => { m[k] = { reg: v.total, regCount: v.count, fee: 0, feeCount: 0 }; });
    feesByLocation.forEach(([k, v]) => {
      if (!m[k]) m[k] = { reg: 0, regCount: 0, fee: 0, feeCount: 0 };
      m[k].fee += v.total;
      m[k].feeCount += v.count;
    });
    return Object.entries(m).sort((a, b) => (b[1].reg + b[1].fee) - (a[1].reg + a[1].fee));
  })();

  // Group by date
  const byDate: Record<string, { total: number; count: number }> = {};
  rows.forEach((r) => {
    const amt = collected(r);
    if (amt <= 0) return;
    const d = r.created_at.split("T")[0];
    if (!byDate[d]) byDate[d] = { total: 0, count: 0 };
    byDate[d].total += amt;
    byDate[d].count += 1;
  });
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  // ---- Trend over time (follows the selected date range) ----
  const bounds = getDateBounds();
  const rangeDays = Math.max(
    1,
    Math.round((new Date(bounds.to).getTime() - new Date(bounds.from).getTime()) / 86400000)
  );
  const granularity: "hour" | "day" | "month" =
    dateRange === "today" || dateRange === "yesterday" || rangeDays <= 2
      ? "hour"
      : rangeDays <= 92
      ? "day"
      : "month";

  const bucketKey = (iso: string) => {
    const d = new Date(iso);
    const day = ptDay(d);
    if (granularity === "hour") {
      const h = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", hour12: false }).format(d);
      return `${day}T${h.padStart(2, "0")}`;
    }
    if (granularity === "month") return day.slice(0, 7);
    return day;
  };
  const bucketLabel = (k: string) => {
    if (granularity === "hour") {
      const h = Number(k.split("T")[1]);
      const ampm = h < 12 ? "AM" : "PM";
      const day = format(new Date(`${k.slice(0, 10)}T12:00:00`), "EEE");
      return `${h % 12 === 0 ? 12 : h % 12}${ampm}\n${day}`;
    }
    if (granularity === "month") return format(new Date(`${k}-01T12:00:00`), "MMM yy");
    return `${format(new Date(`${k}T12:00:00`), "MMM d")}\n${format(new Date(`${k}T12:00:00`), "EEE")}`;
  };

  const trendData = (() => {
    const m: Record<string, { registrations: number; fees: number }> = {};
    const touch = (k: string) => (m[k] ||= { registrations: 0, fees: 0 });
    rows.forEach((r) => {
      if (siteFilter !== "all" && siteRegion(r.location_label) !== siteFilter) return;
      const amt = collected(r);
      if (amt <= 0) return;
      touch(bucketKey(r.created_at)).registrations += amt;
    });
    fees.forEach((f) => {
      if (!f.paid_at) return;
      if (siteFilter !== "all" && siteRegion(f.bookings?.location_label) !== siteFilter) return;
      touch(bucketKey(f.paid_at)).fees += f.amount_cents / 100;
    });

    // fill gaps so the line reads as a continuous trend
    const keys = Object.keys(m);
    if (keys.length) {
      const start = keys.sort()[0];
      if (granularity === "day") {
        let cur = start;
        const last = keys[keys.length - 1];
        let guard = 0;
        while (cur <= last && guard++ < 400) {
          touch(cur);
          cur = shiftDay(cur, 1);
        }
      } else if (granularity === "month") {
        let [y, mo] = start.split("-").map(Number);
        const last = keys[keys.length - 1];
        let guard = 0;
        let cur = start;
        while (cur <= last && guard++ < 240) {
          touch(cur);
          mo += 1;
          if (mo > 12) { mo = 1; y += 1; }
          cur = `${y}-${String(mo).padStart(2, "0")}`;
        }
      }
    }

    return Object.entries(m)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({
        key: k,
        label: bucketLabel(k),
        registrations: Number(v.registrations.toFixed(2)),
        fees: Number(v.fees.toFixed(2)),
        total: Number((v.registrations + v.fees).toFixed(2)),
      }));
  })();



  const dateRangeOptions: { value: DateRange; label: string }[] = [
    { value: "all-time", label: "All Time" },
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "7days", label: "Last 7 Days" },
    { value: "30days", label: "Last 30 Days" },
    { value: "this-month", label: "This Month" },
    { value: "this-year", label: "This Year" },
    { value: "last-year", label: "Last Year" },
    { value: "custom", label: "Custom Range" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <h1 className="text-2xl font-bold text-foreground">Financial</h1>
        {isOwner && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setReportOpen(true); }}>
              <FileSpreadsheet className="w-4 h-4 mr-1" /> CPA Report
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setFinanceSearchOpen(true); setStudentQuery(""); setStudentResults([]); }}>
              <DollarSign className="w-4 h-4 mr-1" /> Student Financial History
            </Button>
          </div>
        )}
      </div>

      {isOwner && (
        <>
          <Dialog open={financeSearchOpen} onOpenChange={setFinanceSearchOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Find Student</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  autoFocus
                  placeholder="Search by student name or email…"
                  value={studentQuery}
                  onChange={(e) => { setStudentQuery(e.target.value); searchStudents(e.target.value); }}
                />
                <div className="max-h-72 overflow-y-auto divide-y divide-border">
                  {studentResults.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="w-full text-left py-2 px-1 hover:bg-secondary/40 rounded"
                      onClick={() => { setSelectedStudent(s); setFinanceSearchOpen(false); }}
                    >
                      <p className="text-sm font-medium text-foreground">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-muted-foreground">{s.email}</p>
                    </button>
                  ))}
                  {studentQuery.trim().length > 1 && studentResults.length === 0 && (
                    <p className="text-sm text-muted-foreground py-3">No students found.</p>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <PaymentHistoryDialog
            open={!!selectedStudent}
            onOpenChange={(o) => { if (!o) setSelectedStudent(null); }}
            email={selectedStudent?.email}
            studentName={selectedStudent ? `${selectedStudent.first_name} ${selectedStudent.last_name}` : null}
          />

          <Dialog open={reportOpen} onOpenChange={setReportOpen}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>CPA Financial Report</DialogTitle>
              </DialogHeader>
              <FinancialReport />
            </DialogContent>
          </Dialog>
        </>
      )}


      {/* Date Range Selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {dateRangeOptions.map((opt) => (
          <Button
            key={opt.value}
            size="sm"
            variant={dateRange === opt.value ? "default" : "outline"}
            onClick={() => setDateRange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {dateRange === "custom" && (
        <div className="flex gap-3 mb-4 items-center flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(!customFrom && "text-muted-foreground")}>
                <CalendarDays className="w-4 h-4 mr-1" />
                {customFrom ? format(customFrom, "MMM d, yyyy") : "From date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground">→</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(!customTo && "text-muted-foreground")}>
                <CalendarDays className="w-4 h-4 mr-1" />
                {customTo ? format(customTo, "MMM d, yyyy") : "To date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customTo} onSelect={setCustomTo} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <DollarSign className="w-8 h-8 text-green-400" />
            <span className="text-xs text-muted-foreground font-medium bg-green-400/10 px-2 py-1 rounded-full">Total</span>
          </div>
          <p className="text-3xl font-bold text-foreground">${totalEarnings.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground mt-1">Money Received ({transactionCount})</p>
          <p className="text-[11px] text-muted-foreground mt-1">Net of refunds · excludes skipped &amp; unpaid</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8 text-accent" />
          </div>
          <p className="text-3xl font-bold text-foreground">${processedTotal.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground mt-1">Processed on Site ({processedCount})</p>
          <p className="text-[11px] text-muted-foreground mt-1">Card payments captured by Square</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <MapPin className="w-8 h-8 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-foreground">${offlineTotal.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground mt-1">Recorded Offline ({offlineCount})</p>
          <p className="text-[11px] text-muted-foreground mt-1">Cash / in-office card entered by staff</p>
        </div>
      </div>

      {/* Revenue Trend */}
      <div className="bg-card border border-border rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h3 className="font-semibold text-foreground">Revenue Trend</h3>
          <div className="flex items-center gap-3">
            <Select value={siteFilter} onValueChange={(v) => setSiteFilter(v as any)}>
              <SelectTrigger className="w-[180px] h-9 text-xs">
                <SelectValue placeholder="All sites" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                <SelectItem value="High Desert">High Desert (HD)</SelectItem>
                <SelectItem value="Ventura County">Ventura County (VC)</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {dateRangeOptions.find((o) => o.value === dateRange)?.label} · by {granularity}
            </span>
          </div>
        </div>
        {trendData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">No revenue in this range</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} minTickGap={16} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickFormatter={(v) => `$${v}`}
                  width={62}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                    color: "hsl(var(--foreground))",
                    fontSize: 12,
                  }}
                  formatter={(v: number, n: string) => [`$${Number(v).toFixed(2)}`, n]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="total" name="Combined" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="registrations" name="Registrations" stroke="#22c55e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="fees" name="Fees" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>


      {unverifiedRows.length > 0 && (
        <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-xl p-4 mb-8 text-sm">
          <p className="font-medium text-foreground">
            {unverifiedRows.length} booking{unverifiedRows.length !== 1 ? "s are" : " is"} marked paid with no payment record — excluded from totals
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            No Square transaction and no cash/card method recorded, so no money can be verified. Set the payment method on these bookings to include them.
          </p>
          <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground max-h-40 overflow-y-auto">
            {unverifiedRows.map((r) => (
              <li key={r.id}>
                {format(new Date(r.created_at), "MMM d, yyyy")} · {[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"} · {r.location_label} · list price ${parseFee(r.fee).toFixed(2)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Fees & Combined Revenue */}
      <h2 className="text-lg font-semibold text-foreground mb-3">Fees &amp; Combined Revenue</h2>
      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-3xl font-bold text-foreground">${feeTotal.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground mt-1">Fees Collected ({fees.length})</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-3xl font-bold text-foreground">${totalEarnings.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground mt-1">Registrations ({transactionCount})</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-3xl font-bold text-foreground">${(totalEarnings + feeTotal).toFixed(2)}</p>
          <p className="text-sm text-muted-foreground mt-1">Combined Revenue (all up)</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 mb-6 overflow-x-auto">
        <h3 className="font-semibold text-foreground mb-3">Registrations &amp; Fees by Site</h3>
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-2 pr-3 text-left font-medium">Site</th>
              <th className="py-2 pr-3 text-right font-medium">Regs</th>
              <th className="py-2 pr-3 text-right font-medium">Registration $</th>
              <th className="py-2 pr-3 text-right font-medium">Fees Paid</th>
              <th className="py-2 pr-3 text-right font-medium">Fee $</th>
              <th className="py-2 text-right font-medium">Combined</th>
            </tr>
          </thead>
          <tbody>
            {combinedBySite.length === 0 ? (
              <tr><td colSpan={6} className="py-3 text-center text-muted-foreground">No data for this period</td></tr>
            ) : (
              combinedBySite.map(([site, v]) => (
                <tr key={site} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3 text-foreground">{site}</td>
                  <td className="py-2 pr-3 text-right text-foreground">{v.regCount}</td>
                  <td className="py-2 pr-3 text-right text-foreground">${v.reg.toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right text-foreground">{v.feeCount}</td>
                  <td className="py-2 pr-3 text-right text-foreground">${v.fee.toFixed(2)}</td>
                  <td className="py-2 text-right font-medium text-foreground">${(v.reg + v.fee).toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
          {combinedBySite.length > 0 && (
            <tfoot>
              <tr className="border-t border-border font-semibold text-foreground">
                <td className="py-2 pr-3">All Sites</td>
                <td className="py-2 pr-3 text-right">{transactionCount}</td>
                <td className="py-2 pr-3 text-right">${totalEarnings.toFixed(2)}</td>
                <td className="py-2 pr-3 text-right">{fees.length}</td>
                <td className="py-2 pr-3 text-right">${feeTotal.toFixed(2)}</td>
                <td className="py-2 text-right">${(totalEarnings + feeTotal).toFixed(2)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-3">Fees by Location</h3>
          {feesByLocation.length === 0 ? (
            <p className="text-sm text-muted-foreground">No fees collected in this period</p>
          ) : feesByLocation.map(([k, v]) => (
            <div key={k} className="flex justify-between py-1.5 border-b border-border last:border-0 text-sm">
              <span className="text-foreground">{k} <span className="text-muted-foreground">({v.count})</span></span>
              <span className="font-medium text-foreground">${v.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-3">Fees by Type</h3>
          {feesByType.length === 0 ? (
            <p className="text-sm text-muted-foreground">No fees collected in this period</p>
          ) : feesByType.map(([k, v]) => (
            <div key={k} className="flex justify-between py-1.5 border-b border-border last:border-0 text-sm">
              <span className="text-foreground">{k} <span className="text-muted-foreground">({v.count})</span></span>
              <span className="font-medium text-foreground">${v.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {fees.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6 mb-8 overflow-x-auto">
          <h3 className="font-semibold text-foreground mb-3">Fees Collected ({fees.length})</h3>
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 pr-3 text-left font-medium">Date</th>
                <th className="py-2 pr-3 text-left font-medium">Student</th>
                <th className="py-2 pr-3 text-left font-medium">Site</th>
                <th className="py-2 pr-3 text-left font-medium">Type</th>
                <th className="py-2 pr-3 text-left font-medium">Note</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {fees.map((f) => (
                <tr key={f.id} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3 text-foreground">{f.paid_at ? format(new Date(f.paid_at), "MMM d, yyyy") : "—"}</td>
                  <td className="py-2 pr-3 text-foreground">{f.bookings ? `${f.bookings.first_name} ${f.bookings.last_name}` : "—"}</td>
                  <td className="py-2 pr-3 text-foreground">{f.bookings?.location_label || "—"}</td>
                  <td className="py-2 pr-3 text-foreground">{feeLabel(f.fee_type)}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{f.note || "—"}</td>
                  <td className="py-2 text-right font-medium text-foreground">${(f.amount_cents / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rangeBounds && <DepositAnalytics from={rangeBounds.from} to={rangeBounds.to} />}

      {/* Operations Stats */}
      <h2 className="text-lg font-semibold text-foreground mb-3">Operations</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <Ban className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">{ops.cancellations}</p>
          <p className="text-xs text-muted-foreground mt-1">Class Cancellations</p>
          <p className="text-[11px] text-muted-foreground mt-1">{ops.fullCancellations} full · {ops.partialCancellations} partial</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <UserX className="w-6 h-6 text-orange-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">{ops.drops}</p>
          <p className="text-xs text-muted-foreground mt-1">Students Dropped</p>
          <p className="text-[11px] text-muted-foreground mt-1">{ops.dropsRescheduleable} reschedulable · {ops.dropsFinal} final</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <CalendarX className="w-6 h-6 text-yellow-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">{ops.noShows}</p>
          <p className="text-xs text-muted-foreground mt-1">No-Shows</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <RefreshCcw className="w-6 h-6 text-accent" />
          </div>
          <p className="text-2xl font-bold text-foreground">{ops.needsReschedule}</p>
          <p className="text-xs text-muted-foreground mt-1">Needs Rescheduling</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <CheckCircle2 className="w-6 h-6 text-green-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">{ops.passed}</p>
          <p className="text-xs text-muted-foreground mt-1">Passed</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {ops.resultsTotal > 0 ? `${Math.round((ops.passed / ops.resultsTotal) * 100)}% pass rate` : "—"}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <XCircle className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">{ops.failed}</p>
          <p className="text-xs text-muted-foreground mt-1">Failed</p>
          <p className="text-[11px] text-muted-foreground mt-1">{ops.resultsTotal} total graded</p>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex gap-2 mb-6">
        {([
          { value: "all" as ViewMode, label: "All Transactions" },
          { value: "by-site" as ViewMode, label: "By Site" },
          { value: "by-date" as ViewMode, label: "By Date" },
        ]).map((opt) => (
          <Button
            key={opt.value}
            size="sm"
            variant={viewMode === opt.value ? "default" : "outline"}
            onClick={() => setViewMode(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : (
        <>
          {viewMode === "all" && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-muted-foreground font-medium">Date</th>
                    <th className="text-left p-4 text-muted-foreground font-medium">Paid By</th>
                    <th className="text-left p-4 text-muted-foreground font-medium">Location</th>
                    <th className="text-left p-4 text-muted-foreground font-medium">Source</th>
                    <th className="text-right p-4 text-muted-foreground font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.filter((r) => collected(r) > 0).length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No money received in this period</td></tr>
                  ) : (
                    rows.filter((r) => collected(r) > 0).map((r, i) => (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/50">
                        <td className="p-4 text-foreground">{format(new Date(r.created_at), "MMM d, yyyy h:mm a")}</td>
                        <td className="p-4 text-foreground">{[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}</td>
                        <td className="p-4 text-foreground flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-muted-foreground" />{r.location_label}</td>
                        <td className="p-4 text-muted-foreground text-xs">{isProcessed(r) ? "Square (site)" : `Offline · ${r.payment_provider}`}</td>
                        <td className="p-4 text-right font-medium text-foreground">${collected(r).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {viewMode === "by-site" && (
            <div className="space-y-4">
              {Object.keys(bySite).length === 0 ? (
                <p className="text-muted-foreground text-sm">No data for this period</p>
              ) : (
                Object.entries(bySite).sort((a, b) => b[1].total - a[1].total).map(([loc, data]) => (
                  <div key={loc} className="bg-card border border-border rounded-xl p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-accent" />
                        <span className="font-medium text-foreground">{loc}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-foreground">${data.total.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">{data.count} transaction{data.count !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    {/* Percentage bar */}
                    <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all"
                        style={{ width: `${totalEarnings > 0 ? (data.total / totalEarnings) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {viewMode === "by-date" && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-muted-foreground font-medium">Date</th>
                    <th className="text-center p-4 text-muted-foreground font-medium">Transactions</th>
                    <th className="text-right p-4 text-muted-foreground font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDates.length === 0 ? (
                    <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">No data for this period</td></tr>
                  ) : (
                    sortedDates.map((d) => (
                      <tr key={d} className="border-b border-border last:border-0 hover:bg-muted/50">
                        <td className="p-4 text-foreground">{format(new Date(d + "T12:00:00"), "MMM d, yyyy")}</td>
                        <td className="p-4 text-center text-foreground">{byDate[d].count}</td>
                        <td className="p-4 text-right font-medium text-foreground">${byDate[d].total.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

    </div>
  );
};

export default EarningsAnalytics;

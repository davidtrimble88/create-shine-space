import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, TrendingUp, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

type Row = {
  id: string;
  total_amount_cents: number;
  deposit_amount_cents: number;
  balance_cents: number;
  deposit_paid_at: string | null;
  balance_paid_at: string | null;
  balance_method: string | null;
  due_date: string;
  status: string;
  created_at: string;
  bookings: { first_name: string; last_name: string; location_label: string | null } | null;
};

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

interface Props {
  /** ISO bounds matching the parent report's selected date range. */
  from: string;
  to: string;
}

/**
 * Everything the owner needs to judge whether deposits help or hurt:
 * take-up, amounts, on-time payoff rate, speed of payoff, and money at risk.
 */
const DepositAnalytics = ({ from, to }: Props) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [paidBookings, setPaidBookings] = useState(0);

  useEffect(() => {
    const run = async () => {
      const [depRes, bookRes] = await Promise.all([
        (supabase as any)
          .from("booking_deposits")
          .select("*, bookings(first_name, last_name, location_label)")
          .gte("created_at", from)
          .lt("created_at", to)
          .order("created_at", { ascending: false }),
        supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .gte("created_at", from)
          .lt("created_at", to),
      ]);
      setRows(((depRes as any).data as Row[]) || []);
      setPaidBookings((bookRes as any).count ?? 0);
    };
    run();
  }, [from, to]);

  const captured = rows.filter(r => r.deposit_paid_at);
  const paidOff = rows.filter(r => r.status === "paid");
  const forfeited = rows.filter(r => r.status === "forfeited");
  const openRows = rows.filter(r => r.status === "open" || r.status === "awaiting_deposit");

  const depositTotal = captured.reduce((s, r) => s + r.deposit_amount_cents, 0);
  const avgDeposit = captured.length ? depositTotal / captured.length : 0;
  const avgCourse = captured.length ? captured.reduce((s, r) => s + r.total_amount_cents, 0) / captured.length : 0;
  const depositPct = avgCourse ? (avgDeposit / avgCourse) * 100 : 0;
  const balanceCollected = paidOff.reduce((s, r) => s + r.balance_cents, 0);
  const outstanding = openRows.reduce((s, r) => s + r.balance_cents, 0);
  const atRisk = forfeited.reduce((s, r) => s + r.balance_cents, 0);
  const settled = paidOff.length + forfeited.length;
  const onTimeRate = settled ? (paidOff.length / settled) * 100 : 0;
  const takeUp = paidBookings ? (rows.length / paidBookings) * 100 : 0;

  const payoffDays = paidOff
    .filter(r => r.deposit_paid_at && r.balance_paid_at)
    .map(r => (new Date(r.balance_paid_at!).getTime() - new Date(r.deposit_paid_at!).getTime()) / 86400000);
  const avgPayoffDays = payoffDays.length ? payoffDays.reduce((a, b) => a + b, 0) / payoffDays.length : 0;

  const earlyPayoffs = paidOff.filter(r => r.balance_paid_at && r.balance_paid_at.split("T")[0] < r.due_date).length;

  const byLocation = Object.entries(
    rows.reduce<Record<string, { count: number; deposits: number; outstanding: number; missed: number }>>((acc, r) => {
      const k = r.bookings?.location_label || "Unknown";
      acc[k] ||= { count: 0, deposits: 0, outstanding: 0, missed: 0 };
      acc[k].count += 1;
      if (r.deposit_paid_at) acc[k].deposits += r.deposit_amount_cents;
      if (r.status === "open" || r.status === "awaiting_deposit") acc[k].outstanding += r.balance_cents;
      if (r.status === "forfeited") acc[k].missed += 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1].count - a[1].count);

  const cards = [
    { icon: Wallet, color: "text-accent", value: String(rows.length), label: "Deposits taken", sub: `${takeUp.toFixed(1)}% of registrations` },
    { icon: TrendingUp, color: "text-green-400", value: money(depositTotal), label: "Deposit money collected", sub: `avg ${money(avgDeposit)} (${depositPct.toFixed(0)}% of course price)` },
    { icon: TrendingUp, color: "text-green-400", value: money(balanceCollected), label: "Balances collected", sub: `${paidOff.length} paid in full` },
    { icon: Clock, color: "text-yellow-400", value: money(outstanding), label: "Balance outstanding", sub: `${openRows.length} students still owing` },
    { icon: TrendingUp, color: "text-blue-400", value: `${onTimeRate.toFixed(0)}%`, label: "Paid off on time", sub: `${paidOff.length} of ${settled} settled · ${earlyPayoffs} paid early` },
    { icon: AlertTriangle, color: "text-red-400", value: String(forfeited.length), label: "Missed the deadline", sub: `${money(atRisk)} lost / seats released` },
  ];

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-foreground mb-3">Deposits</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-4">
        {cards.map(c => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-5">
            <c.icon className={`w-6 h-6 mb-3 ${c.color}`} />
            <p className="text-2xl font-bold text-foreground">{c.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-3">Deposits by Location</h3>
          {byLocation.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deposits in this period</p>
          ) : byLocation.map(([k, v]) => (
            <div key={k} className="flex justify-between py-1.5 border-b border-border last:border-0 text-sm">
              <span className="text-foreground">{k} <span className="text-muted-foreground">({v.count})</span></span>
              <span className="text-muted-foreground">
                {money(v.deposits)} in · <span className="text-yellow-400">{money(v.outstanding)} out</span>
                {v.missed > 0 && <span className="text-red-400"> · {v.missed} missed</span>}
              </span>
            </div>
          ))}
        </div>
        <div className="bg-card border border-border rounded-xl p-6 text-sm space-y-2">
          <h3 className="font-semibold text-foreground mb-3">Deposit Behavior</h3>
          <div className="flex justify-between"><span className="text-muted-foreground">Average time to pay the balance</span><span className="text-foreground font-medium">{avgPayoffDays ? `${avgPayoffDays.toFixed(1)} days` : "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Average course price on deposits</span><span className="text-foreground font-medium">{money(avgCourse)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Average balance owed</span><span className="text-foreground font-medium">{money(captured.length ? captured.reduce((s, r) => s + r.balance_cents, 0) / captured.length : 0)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Deposits still awaiting card capture</span><span className="text-foreground font-medium">{rows.filter(r => r.status === "awaiting_deposit").length}</span></div>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6 mt-6 overflow-x-auto">
          <h3 className="font-semibold text-foreground mb-3">Deposit Detail ({rows.length})</h3>
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 pr-3 text-left font-medium">Started</th>
                <th className="py-2 pr-3 text-left font-medium">Student</th>
                <th className="py-2 pr-3 text-left font-medium">Site</th>
                <th className="py-2 pr-3 text-right font-medium">Course</th>
                <th className="py-2 pr-3 text-right font-medium">Deposit</th>
                <th className="py-2 pr-3 text-right font-medium">Balance</th>
                <th className="py-2 pr-3 text-left font-medium">Due</th>
                <th className="py-2 text-left font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3 text-foreground">{format(new Date(r.created_at), "MMM d, yyyy")}</td>
                  <td className="py-2 pr-3 text-foreground">{r.bookings ? `${r.bookings.first_name} ${r.bookings.last_name}` : "—"}</td>
                  <td className="py-2 pr-3 text-foreground">{r.bookings?.location_label || "—"}</td>
                  <td className="py-2 pr-3 text-right text-foreground">{money(r.total_amount_cents)}</td>
                  <td className="py-2 pr-3 text-right text-foreground">{money(r.deposit_amount_cents)}</td>
                  <td className="py-2 pr-3 text-right text-foreground">{money(r.balance_cents)}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.due_date}</td>
                  <td className="py-2">
                    {r.status === "paid" ? <span className="text-green-400">Paid in full{r.balance_paid_at ? ` (${format(new Date(r.balance_paid_at), "MMM d")})` : ""}</span>
                      : r.status === "forfeited" ? <span className="text-red-400">Missed — seat released</span>
                      : r.status === "awaiting_deposit" ? <span className="text-yellow-400">Deposit not captured</span>
                      : <span className="text-accent">Balance open</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DepositAnalytics;

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, MapPin, CalendarDays, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, subDays, startOfMonth } from "date-fns";

type ViewMode = "all" | "by-site" | "by-date";
type DateRange = "today" | "yesterday" | "7days" | "30days" | "this-month" | "custom";

interface EarningRow {
  fee: string | null;
  location_label: string;
  created_at: string;
}

const parseFee = (fee: string | null) => {
  const val = parseFloat((fee || "0").replace(/[^0-9.]/g, ""));
  return isNaN(val) ? 0 : val;
};

const EarningsAnalytics = () => {
  const [rows, setRows] = useState<EarningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [dateRange, setDateRange] = useState<DateRange>("30days");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const getDateBounds = (): { from: string; to: string } => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().split("T")[0];

    switch (dateRange) {
      case "today":
        return { from: `${todayStr}T00:00:00`, to: `${tomorrowStr}T00:00:00` };
      case "yesterday": {
        const y = subDays(now, 1).toISOString().split("T")[0];
        return { from: `${y}T00:00:00`, to: `${todayStr}T00:00:00` };
      }
      case "7days": {
        const d = subDays(now, 7).toISOString().split("T")[0];
        return { from: `${d}T00:00:00`, to: `${tomorrowStr}T00:00:00` };
      }
      case "30days": {
        const d = subDays(now, 30).toISOString().split("T")[0];
        return { from: `${d}T00:00:00`, to: `${tomorrowStr}T00:00:00` };
      }
      case "this-month": {
        const d = startOfMonth(now).toISOString().split("T")[0];
        return { from: `${d}T00:00:00`, to: `${tomorrowStr}T00:00:00` };
      }
      case "custom": {
        const f = customFrom ? customFrom.toISOString().split("T")[0] : todayStr;
        const t = customTo ? new Date(customTo.getTime() + 86400000).toISOString().split("T")[0] : tomorrowStr;
        return { from: `${f}T00:00:00`, to: `${t}T00:00:00` };
      }
      default:
        return { from: `${todayStr}T00:00:00`, to: `${tomorrowStr}T00:00:00` };
    }
  };

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { from, to } = getDateBounds();
      const { data } = await supabase
        .from("bookings")
        .select("fee, location_label, created_at")
        .eq("payment_status", "paid")
        .gte("created_at", from)
        .lt("created_at", to)
        .order("created_at", { ascending: false });
      setRows((data as EarningRow[]) || []);
      setLoading(false);
    };
    fetch();
  }, [dateRange, customFrom, customTo]);

  const totalEarnings = rows.reduce((s, r) => s + parseFee(r.fee), 0);
  const transactionCount = rows.length;

  // Group by site
  const bySite: Record<string, { total: number; count: number }> = {};
  rows.forEach((r) => {
    const loc = r.location_label || "Unknown";
    if (!bySite[loc]) bySite[loc] = { total: 0, count: 0 };
    bySite[loc].total += parseFee(r.fee);
    bySite[loc].count += 1;
  });

  // Group by date
  const byDate: Record<string, { total: number; count: number }> = {};
  rows.forEach((r) => {
    const d = r.created_at.split("T")[0];
    if (!byDate[d]) byDate[d] = { total: 0, count: 0 };
    byDate[d].total += parseFee(r.fee);
    byDate[d].count += 1;
  });
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));


  const dateRangeOptions: { value: DateRange; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "7days", label: "Last 7 Days" },
    { value: "30days", label: "Last 30 Days" },
    { value: "this-month", label: "This Month" },
    { value: "custom", label: "Custom Range" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Earnings Analytics</h1>

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
          <p className="text-sm text-muted-foreground mt-1">Total Earned</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8 text-accent" />
          </div>
          <p className="text-3xl font-bold text-foreground">{transactionCount}</p>
          <p className="text-sm text-muted-foreground mt-1">Paid Transactions</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <MapPin className="w-8 h-8 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-foreground">{Object.keys(bySite).length}</p>
          <p className="text-sm text-muted-foreground mt-1">Active Locations</p>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex gap-2 mb-6">
        {([
          { value: "all" as ViewMode, label: "All Transactions" },
          { value: "by-site" as ViewMode, label: "By Site" },
          { value: "by-date" as ViewMode, label: "By Date" },
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
                    <th className="text-left p-4 text-muted-foreground font-medium">Location</th>
                    <th className="text-right p-4 text-muted-foreground font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">No paid transactions in this period</td></tr>
                  ) : (
                    rows.map((r, i) => (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/50">
                        <td className="p-4 text-foreground">{format(new Date(r.created_at), "MMM d, yyyy h:mm a")}</td>
                        <td className="p-4 text-foreground flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-muted-foreground" />{r.location_label}</td>
                        <td className="p-4 text-right font-medium text-foreground">${parseFee(r.fee).toFixed(2)}</td>
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

          {viewMode === "date-site" && (
            <div className="space-y-4">
              {sortedDates.length === 0 ? (
                <p className="text-muted-foreground text-sm">No data for this period</p>
              ) : (
                sortedDates.map((d) => (
                  <div key={d} className="bg-card border border-border rounded-xl p-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-foreground">{format(new Date(d + "T12:00:00"), "EEEE, MMM d, yyyy")}</h3>
                      <div className="text-right">
                        <span className="text-lg font-bold text-foreground">${byDate[d].total.toFixed(2)}</span>
                        <span className="text-xs text-muted-foreground ml-2">({byDate[d].count} txn{byDate[d].count !== 1 ? "s" : ""})</span>
                      </div>
                    </div>
                    <div className="border-t border-border pt-3 space-y-2">
                      {Object.entries(byDateSite[d] || {}).sort((a, b) => b[1].total - a[1].total).map(([loc, data]) => (
                        <div key={loc} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <MapPin className="w-3.5 h-3.5" />
                            {loc}
                          </span>
                          <span className="font-medium text-foreground">${data.total.toFixed(2)} <span className="text-xs text-muted-foreground">({data.count})</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EarningsAnalytics;

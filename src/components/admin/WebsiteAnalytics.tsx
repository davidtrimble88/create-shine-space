import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  BarChart3, Eye, Users, TrendingUp, DollarSign, CalendarDays,
  MapPin, Megaphone, LogIn, BookOpen, X, ArrowLeft
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";
import { Button } from "@/components/ui/button";

const COLORS = ["hsl(var(--accent))", "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

const WebsiteAnalytics = () => {
  const [timeRange, setTimeRange] = useState("30");
  const [pageViews, setPageViews] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [logins, setLogins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [drilldown, setDrilldown] = useState<{ type: string; label: string; data: any[] } | null>(null);

  const getDateFilter = () => {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(timeRange));
    return d.toISOString();
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const since = getDateFilter();
      const [pvRes, bkRes, lgRes] = await Promise.all([
        supabase.from("page_views").select("*").gte("created_at", since).order("created_at"),
        supabase.from("bookings").select("*").order("created_at"),
        supabase.from("employee_logins").select("*").gte("created_at", since).order("created_at", { ascending: false }),
      ]);
      setPageViews(pvRes.data ?? []);
      setBookings(bkRes.data ?? []);
      setLogins(lgRes.data ?? []);
      setLoading(false);
    };
    load();
  }, [timeRange]);

  // ---- Computed Stats ----
  const totalViews = pageViews.length;
  const uniqueVisitors = new Set(pageViews.map(p => p.visitor_id)).size;
  const totalBookings = bookings.length;
  const registrationViews = pageViews.filter(p => p.page_path === "/register").length;
  const conversionRate = registrationViews > 0 ? ((totalBookings / registrationViews) * 100).toFixed(1) : "0";

  // Page views by page
  const viewsByPage = pageViews.reduce<Record<string, number>>((acc, p) => {
    const name = p.page_name || p.page_path;
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  const pageViewsChart = Object.entries(viewsByPage)
    .map(([name, count]) => ({ name, views: count }))
    .sort((a, b) => b.views - a.views);

  // Referral source breakdown
  const referralCounts = bookings.reduce<Record<string, number>>((acc, b) => {
    const src = b.referral_source || "Unknown";
    acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, {});
  const referralChart = Object.entries(referralCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Bookings by course
  const courseLabels: Record<string, string> = {
    basic: "Motorcycle Training Course",
    intermediate: "Intermediate Course",
    advanced: "Advanced Riding Clinic",
  };
  const bookingsByCourse = bookings.reduce<Record<string, number>>((acc, b) => {
    const c = courseLabels[b.course] || b.course;
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {});
  const courseChart = Object.entries(bookingsByCourse)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Bookings by location
  const bookingsByLocation = bookings.reduce<Record<string, number>>((acc, b) => {
    acc[b.location_label] = (acc[b.location_label] || 0) + 1;
    return acc;
  }, {});
  const locationChart = Object.entries(bookingsByLocation)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Bookings over time (by month)
  const bookingsByMonth = bookings.reduce<Record<string, number>>((acc, b) => {
    const d = new Date(b.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const monthlyChart = Object.entries(bookingsByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({
      month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      rawMonth: month,
      bookings: count,
    }));

  // Fill rate
  const fillRateData = bookings.reduce<Record<string, { date: string; rawDate: string; course: string; location: string; count: number }>>((acc, b) => {
    if (b.schedule_date) {
      const key = `${b.schedule_date}-${b.course}-${b.location}`;
      if (!acc[key]) {
        acc[key] = {
          date: new Date(b.schedule_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          rawDate: b.schedule_date,
          course: courseLabels[b.course] || b.course,
          location: b.location_label,
          count: 0,
        };
      }
      acc[key].count++;
    }
    return acc;
  }, {});
  const fillChart = Object.values(fillRateData).sort((a, b) => b.count - a.count).slice(0, 10);

  // Payment status
  const paymentCounts = bookings.reduce<Record<string, number>>((acc, b) => {
    const s = b.payment_status || "pending";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  const paymentChart = Object.entries(paymentCounts).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

  // Seasonal analysis
  const bookingsByQuarter = bookings.reduce<Record<string, number>>((acc, b) => {
    const d = new Date(b.created_at);
    const q = Math.ceil((d.getMonth() + 1) / 3);
    const key = `Q${q} ${d.getFullYear()}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const quarterChart = Object.entries(bookingsByQuarter)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([quarter, count]) => ({ quarter, bookings: count }));

  // ---- Drilldown Handlers ----
  const handlePageViewClick = (data: any) => {
    if (!data?.activePayload?.[0]) return;
    const pageName = data.activePayload[0].payload.name;
    const details = pageViews
      .filter(p => (p.page_name || p.page_path) === pageName)
      .map(p => ({
        visitor_id: p.visitor_id?.substring(0, 8) + "…",
        full_visitor_id: p.visitor_id,
        page: p.page_name || p.page_path,
        time: new Date(p.created_at).toLocaleString(),
      }));
    // Group by visitor
    const visitorMap = new Map<string, { visitor_id: string; visits: number; lastVisit: string }>();
    details.forEach(d => {
      const existing = visitorMap.get(d.full_visitor_id);
      if (existing) {
        existing.visits++;
        existing.lastVisit = d.time;
      } else {
        visitorMap.set(d.full_visitor_id, { visitor_id: d.full_visitor_id, visits: 1, lastVisit: d.time });
      }
    });
    setDrilldown({
      type: "page_views",
      label: pageName,
      data: Array.from(visitorMap.values()).sort((a, b) => b.visits - a.visits),
    });
  };

  const handleMonthlyClick = (data: any) => {
    if (!data?.activePayload?.[0]) return;
    const rawMonth = data.activePayload[0].payload.rawMonth;
    const monthLabel = data.activePayload[0].payload.month;
    const details = bookings.filter(b => {
      const d = new Date(b.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return key === rawMonth;
    });
    setDrilldown({
      type: "bookings_month",
      label: monthLabel,
      data: details,
    });
  };

  const handleFillRateClick = (data: any) => {
    if (!data?.activePayload?.[0]) return;
    const payload = data.activePayload[0].payload;
    const details = bookings.filter(b =>
      b.schedule_date === payload.rawDate &&
      (courseLabels[b.course] || b.course) === payload.course
    );
    setDrilldown({
      type: "fill_rate",
      label: `${payload.course} — ${payload.date}`,
      data: details,
    });
  };

  const handleReferralClick = (data: any) => {
    if (!data?.name) return;
    const source = data.name;
    const details = bookings.filter(b => (b.referral_source || "Unknown") === source);
    setDrilldown({
      type: "referral",
      label: source,
      data: details,
    });
  };

  if (loading) return <p className="text-muted-foreground p-8">Loading analytics...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Website Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Click any chart bar or slice to see detailed records</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
            <SelectItem value="9999">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[
          { label: "Page Views", value: totalViews, icon: Eye, color: "text-accent" },
          { label: "Unique Visitors", value: uniqueVisitors, icon: Users, color: "text-blue-400" },
          { label: "Total Bookings", value: totalBookings, icon: BookOpen, color: "text-purple-400" },
          { label: "Conversion Rate", value: `${conversionRate}%`, icon: TrendingUp, color: "text-green-400" },
          { label: "Employee Logins", value: logins.length, icon: LogIn, color: "text-amber-400" },
        ].map((card, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <card.icon className={`w-4 h-4 ${card.color}`} />
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="logins">Employee Logins</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Page Views Chart */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                <Eye className="w-4 h-4 text-accent" /> Page Views by Page
              </h3>
              <p className="text-xs text-muted-foreground mb-4">Click a bar to see visitors</p>
              {pageViewsChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={pageViewsChart} onClick={handlePageViewClick} className="cursor-pointer">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="views" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-12">No page view data yet</p>}
            </div>

            {/* Bookings by Month */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent" /> Bookings Over Time
              </h3>
              <p className="text-xs text-muted-foreground mb-4">Click a point to see bookings</p>
              {monthlyChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={monthlyChart} onClick={handleMonthlyClick} className="cursor-pointer">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="bookings" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ fill: "hsl(var(--accent))" }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-12">No booking data yet</p>}
            </div>
          </div>

          {/* Most Popular */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-accent" /> Most Popular Courses
              </h3>
              {courseChart.length > 0 ? (
                <div className="space-y-3">
                  {courseChart.map((c, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm text-foreground">{c.name}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(c.value / Math.max(...courseChart.map(x => x.value))) * 100}%`, background: COLORS[i % COLORS.length] }} />
                        </div>
                        <span className="text-sm font-medium text-foreground w-8 text-right">{c.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>}
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-accent" /> Most Popular Locations
              </h3>
              {locationChart.length > 0 ? (
                <div className="space-y-3">
                  {locationChart.map((l, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm text-foreground">{l.name}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(l.value / Math.max(...locationChart.map(x => x.value))) * 100}%`, background: COLORS[i % COLORS.length] }} />
                        </div>
                        <span className="text-sm font-medium text-foreground w-8 text-right">{l.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>}
            </div>
          </div>

          {/* Seasonal Trends */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-accent" /> Seasonal Trends (Quarterly)
            </h3>
            {quarterChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={quarterChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="bookings" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-12">Need booking data to show seasonal patterns</p>}
          </div>
        </TabsContent>

        {/* BOOKINGS TAB */}
        <TabsContent value="bookings" className="space-y-6">
          {/* Fill Rate */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-accent" /> Class Fill Rate — Top 10 Classes
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Click a bar to see who booked</p>
            {fillChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={fillChart} layout="vertical" onClick={handleFillRateClick} className="cursor-pointer">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis dataKey="date" type="category" width={80} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    formatter={(value: any, _: any, props: any) => [`${value} booked`, `${props.payload.course} — ${props.payload.location}`]}
                  />
                  <Bar dataKey="count" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-12">No booking data yet</p>}
          </div>

          {/* Recent bookings table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-5 border-b border-border">
              <h3 className="font-semibold text-foreground">Recent Bookings</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Course</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Location</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Class Date</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.slice(-20).reverse().map(b => (
                    <tr key={b.id} className="border-b border-border/50">
                      <td className="p-3 text-muted-foreground text-xs">{new Date(b.created_at).toLocaleDateString()}</td>
                      <td className="p-3 text-foreground">{b.first_name} {b.last_name}</td>
                      <td className="p-3"><span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">{courseLabels[b.course] || b.course}</span></td>
                      <td className="p-3 text-muted-foreground text-xs">{b.location_label}</td>
                      <td className="p-3 text-muted-foreground text-xs">{b.schedule_date ? new Date(b.schedule_date + "T00:00:00").toLocaleDateString() : "—"}</td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          b.booking_status === "confirmed" ? "bg-green-500/10 text-green-400" :
                          b.booking_status === "cancelled" ? "bg-destructive/10 text-destructive" :
                          "bg-amber-500/10 text-amber-400"
                        }`}>{b.booking_status}</span>
                      </td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          b.payment_status === "paid" ? "bg-green-500/10 text-green-400" :
                          "bg-amber-500/10 text-amber-400"
                        }`}>{b.payment_status}</span>
                      </td>
                    </tr>
                  ))}
                  {bookings.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No bookings yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* REFERRALS TAB */}
        <TabsContent value="referrals" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-accent" /> How Did You Hear About Us?
              </h3>
              <p className="text-xs text-muted-foreground mb-4">Click a slice to see bookings</p>
              {referralChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={referralChart}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={false}
                      onClick={handleReferralClick}
                      className="cursor-pointer"
                    >
                      {referralChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-12">No referral data yet</p>}
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-4">Referral Source Breakdown</h3>
              {referralChart.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {referralChart.map((r, i) => (
                    <button
                      key={i}
                      className="w-full flex items-center justify-between py-2 px-2 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
                      onClick={() => handleReferralClick(r)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-sm text-foreground">{r.name}</span>
                      </div>
                      <span className="text-sm font-medium text-foreground">{r.value}</span>
                    </button>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-12">No referral data yet</p>}
            </div>
          </div>
        </TabsContent>

        {/* PAYMENTS TAB */}
        <TabsContent value="payments" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-accent" /> Payment Status
              </h3>
              {paymentChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={paymentChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {paymentChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-12">No payment data yet</p>}
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-4">Payment Summary</h3>
              <div className="space-y-4">
                {Object.entries(paymentCounts).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <span className="text-sm text-foreground capitalize">{status}</span>
                    <span className="text-lg font-bold text-foreground">{count}</span>
                  </div>
                ))}
                {Object.keys(paymentCounts).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No payment data yet</p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* EMPLOYEE LOGINS TAB */}
        <TabsContent value="logins" className="space-y-6">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center gap-2">
              <LogIn className="w-5 h-5 text-accent" />
              <h3 className="font-semibold text-foreground">Employee Login History</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left p-4 font-medium text-muted-foreground">Date & Time</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Email</th>
                </tr>
              </thead>
              <tbody>
                {logins.slice(0, 50).map(l => (
                  <tr key={l.id} className="border-b border-border/50">
                    <td className="p-4 text-foreground">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="p-4 text-muted-foreground">{l.email}</td>
                  </tr>
                ))}
                {logins.length === 0 && (
                  <tr><td colSpan={2} className="p-8 text-center text-muted-foreground">No login records yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Drilldown Dialog */}
      <Dialog open={!!drilldown} onOpenChange={(open) => !open && setDrilldown(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {drilldown?.type === "page_views" && <Eye className="w-5 h-5 text-accent" />}
              {(drilldown?.type === "bookings_month" || drilldown?.type === "fill_rate" || drilldown?.type === "referral") && <BookOpen className="w-5 h-5 text-accent" />}
              {drilldown?.type === "page_views" ? `Visitors — ${drilldown.label}` :
               drilldown?.type === "bookings_month" ? `Bookings — ${drilldown?.label}` :
               drilldown?.type === "fill_rate" ? `Bookings — ${drilldown?.label}` :
               `Referral — ${drilldown?.label}`}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            {drilldown?.type === "page_views" && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left p-3 font-medium text-muted-foreground">Visitor ID</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Visits</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Last Visit</th>
                  </tr>
                </thead>
                <tbody>
                  {drilldown.data.map((d, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="p-3 text-foreground font-mono text-xs">{d.visitor_id?.substring(0, 8)}…</td>
                      <td className="p-3 text-foreground">{d.visits}</td>
                      <td className="p-3 text-muted-foreground text-xs">{d.lastVisit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {(drilldown?.type === "bookings_month" || drilldown?.type === "fill_rate" || drilldown?.type === "referral") && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Course</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Location</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {drilldown.data.map((b, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="p-3 text-foreground">{b.first_name} {b.last_name}</td>
                      <td className="p-3 text-muted-foreground text-xs">{b.email}</td>
                      <td className="p-3"><span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">{courseLabels[b.course] || b.course}</span></td>
                      <td className="p-3 text-muted-foreground text-xs">{b.location_label}</td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          b.booking_status === "confirmed" ? "bg-green-500/10 text-green-400" :
                          b.booking_status === "cancelled" ? "bg-destructive/10 text-destructive" :
                          "bg-amber-500/10 text-amber-400"
                        }`}>{b.booking_status}</span>
                      </td>
                    </tr>
                  ))}
                  {drilldown.data.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No records found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">{drilldown?.data.length} record{drilldown?.data.length !== 1 ? "s" : ""}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WebsiteAnalytics;

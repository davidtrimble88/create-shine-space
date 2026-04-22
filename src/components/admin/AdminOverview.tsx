import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, Users, BookOpen, DollarSign, MapPin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface LocationEarnings {
  [location: string]: number;
}

const AdminOverview = () => {
  const { effectiveRole } = useAuth();
  const [scheduleCount, setScheduleCount] = useState(0);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [upcomingClasses, setUpcomingClasses] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [yesterdayEarnings, setYesterdayEarnings] = useState(0);
  const [todayByLocation, setTodayByLocation] = useState<LocationEarnings>({});
  const [yesterdayByLocation, setYesterdayByLocation] = useState<LocationEarnings>({});

  const canSeeEarnings = effectiveRole === "owner";

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      const [schedRes, empRes, upRes] = await Promise.all([
        supabase.from("schedules").select("id", { count: "exact", head: true }),
        supabase.from("employees").select("id", { count: "exact", head: true }),
        supabase.from("schedules").select("id", { count: "exact", head: true }).gte("date", todayStr),
      ]);

      setScheduleCount(schedRes.count ?? 0);
      setEmployeeCount(empRes.count ?? 0);
      setUpcomingClasses(upRes.count ?? 0);

      if (canSeeEarnings) {
        const [todayRes, yesterdayRes] = await Promise.all([
          supabase.from("bookings").select("fee, location_label").eq("payment_status", "paid").gte("created_at", `${todayStr}T00:00:00`).lt("created_at", `${todayStr}T23:59:59.999`),
          supabase.from("bookings").select("fee, location_label").eq("payment_status", "paid").gte("created_at", `${yesterdayStr}T00:00:00`).lt("created_at", `${yesterdayStr}T23:59:59.999`),
        ]);

        const parseFee = (fee: string | null) => {
          const val = parseFloat((fee || "0").replace(/[^0-9.]/g, ""));
          return isNaN(val) ? 0 : val;
        };

        const sumAndGroup = (rows: any[] | null) => {
          let total = 0;
          const byLoc: LocationEarnings = {};
          (rows || []).forEach((r) => {
            const amount = parseFee(r.fee);
            total += amount;
            const loc = r.location_label || "Unknown";
            byLoc[loc] = (byLoc[loc] || 0) + amount;
          });
          return { total, byLoc };
        };

        const todayData = sumAndGroup(todayRes.data);
        const yesterdayData = sumAndGroup(yesterdayRes.data);

        setTodayEarnings(todayData.total);
        setTodayByLocation(todayData.byLoc);
        setYesterdayEarnings(yesterdayData.total);
        setYesterdayByLocation(yesterdayData.byLoc);
      }
    };

    fetchStats();
  }, [canSeeEarnings]);

  const stats = [
    { label: "Total Classes", value: scheduleCount, icon: BookOpen, color: "text-accent" },
    { label: "Upcoming Classes", value: upcomingClasses, icon: CalendarDays, color: "text-green-400" },
    { label: "Employees", value: employeeCount, icon: Users, color: "text-blue-400" },
  ];

  const allLocations = Array.from(new Set([...Object.keys(todayByLocation), ...Object.keys(yesterdayByLocation)])).sort();

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Dashboard Overview</h1>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <stat.icon className={`w-8 h-8 ${stat.color}`} />
            </div>
            <p className="text-3xl font-bold text-foreground">{stat.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {canSeeEarnings && (
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Today */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="w-8 h-8 text-green-400" />
              <span className="text-xs text-muted-foreground font-medium bg-green-400/10 px-2 py-1 rounded-full">Today</span>
            </div>
            <p className="text-3xl font-bold text-foreground">${todayEarnings.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Earned Today</p>
            {allLocations.length > 0 && (
              <div className="border-t border-border pt-3 space-y-2">
                {allLocations.map((loc) => (
                  <div key={loc} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5" />
                      {loc}
                    </span>
                    <span className="font-medium text-foreground">${(todayByLocation[loc] || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Yesterday */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="w-8 h-8 text-accent" />
              <span className="text-xs text-muted-foreground font-medium bg-accent/10 px-2 py-1 rounded-full">Yesterday</span>
            </div>
            <p className="text-3xl font-bold text-foreground">${yesterdayEarnings.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Earned Yesterday</p>
            {allLocations.length > 0 && (
              <div className="border-t border-border pt-3 space-y-2">
                {allLocations.map((loc) => (
                  <div key={loc} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5" />
                      {loc}
                    </span>
                    <span className="font-medium text-foreground">${(yesterdayByLocation[loc] || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-semibold text-foreground mb-2">Welcome to the Employee Portal</h3>
        <p className="text-muted-foreground text-sm">
          Use the sidebar to manage class schedules, employees, and more. Additional features like content editing, 
          analytics, and more will be added as we continue building.
        </p>
      </div>
    </div>
  );
};

export default AdminOverview;

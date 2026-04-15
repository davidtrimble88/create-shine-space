import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, Users, BookOpen, DollarSign } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const AdminOverview = () => {
  const { userRole } = useAuth();
  const [scheduleCount, setScheduleCount] = useState(0);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [upcomingClasses, setUpcomingClasses] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [yesterdayEarnings, setYesterdayEarnings] = useState(0);

  const canSeeEarnings = userRole === "owner" || userRole === "admin";

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
          supabase.from("bookings").select("fee").eq("payment_status", "paid").gte("created_at", `${todayStr}T00:00:00`).lt("created_at", `${todayStr}T23:59:59.999`),
          supabase.from("bookings").select("fee").eq("payment_status", "paid").gte("created_at", `${yesterdayStr}T00:00:00`).lt("created_at", `${yesterdayStr}T23:59:59.999`),
        ]);

        const sumFees = (rows: any[] | null) =>
          (rows || []).reduce((sum, r) => {
            const val = parseFloat((r.fee || "0").replace(/[^0-9.]/g, ""));
            return sum + (isNaN(val) ? 0 : val);
          }, 0);

        setTodayEarnings(sumFees(todayRes.data));
        setYesterdayEarnings(sumFees(yesterdayRes.data));
      }
    };

    fetchStats();
  }, [canSeeEarnings]);

  const stats = [
    { label: "Total Classes", value: scheduleCount, icon: BookOpen, color: "text-accent", format: "number" },
    { label: "Upcoming Classes", value: upcomingClasses, icon: CalendarDays, color: "text-green-400", format: "number" },
    { label: "Employees", value: employeeCount, icon: Users, color: "text-blue-400", format: "number" },
  ];

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
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="w-8 h-8 text-green-400" />
              <span className="text-xs text-muted-foreground font-medium bg-green-400/10 px-2 py-1 rounded-full">Today</span>
            </div>
            <p className="text-3xl font-bold text-foreground">${todayEarnings.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground mt-1">Earned Today</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="w-8 h-8 text-accent" />
              <span className="text-xs text-muted-foreground font-medium bg-accent/10 px-2 py-1 rounded-full">Yesterday</span>
            </div>
            <p className="text-3xl font-bold text-foreground">${yesterdayEarnings.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground mt-1">Earned Yesterday</p>
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

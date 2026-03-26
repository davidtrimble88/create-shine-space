import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, Users, BookOpen } from "lucide-react";

const AdminOverview = () => {
  const [scheduleCount, setScheduleCount] = useState(0);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [upcomingClasses, setUpcomingClasses] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date().toISOString().split("T")[0];

      const [schedRes, empRes, upRes] = await Promise.all([
        supabase.from("schedules").select("id", { count: "exact", head: true }),
        supabase.from("employees").select("id", { count: "exact", head: true }),
        supabase.from("schedules").select("id", { count: "exact", head: true }).gte("date", today),
      ]);

      setScheduleCount(schedRes.count ?? 0);
      setEmployeeCount(empRes.count ?? 0);
      setUpcomingClasses(upRes.count ?? 0);
    };

    fetchStats();
  }, []);

  const stats = [
    { label: "Total Classes", value: scheduleCount, icon: BookOpen, color: "text-accent" },
    { label: "Upcoming Classes", value: upcomingClasses, icon: CalendarDays, color: "text-green-400" },
    { label: "Employees", value: employeeCount, icon: Users, color: "text-blue-400" },
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

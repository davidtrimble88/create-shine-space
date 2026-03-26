import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, Shield, CalendarDays, Users, LayoutDashboard, UserCog, Eye, Hand } from "lucide-react";
import { useState } from "react";
import AdminSchedule from "@/components/admin/AdminSchedule";
import AdminEmployees from "@/components/admin/AdminEmployees";
import AdminOverview from "@/components/admin/AdminOverview";
import ViewerSchedule from "@/components/admin/ViewerSchedule";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, roles: ["admin", "manager", "employee"] },
  { id: "schedule", label: "Schedule", icon: CalendarDays, roles: ["admin", "manager"] },
  { id: "my-schedule", label: "Upcoming Classes", icon: Hand, roles: ["admin", "manager", "employee"] },
  { id: "employees", label: "Employees", icon: Users, roles: ["admin"] },
] as const;

type TabId = typeof tabs[number]["id"];

const roleLabels: Record<string, { label: string; icon: typeof Shield }> = {
  admin: { label: "Admin", icon: Shield },
  manager: { label: "Manager", icon: UserCog },
  employee: { label: "Viewer", icon: Eye },
};

const EmployeeDashboard = () => {
  const { user, isAdmin, userRole, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/employee-login" replace />;
  }

  const visibleTabs = tabs.filter(t => t.roles.includes(userRole as any));
  const roleInfo = roleLabels[userRole] || roleLabels.employee;
  const RoleIcon = roleInfo.icon;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col min-h-screen">
        <div className="p-6 border-b border-border">
          <Link to="/" className="text-accent font-bold text-lg">
            Learn to Ride VC
          </Link>
          <p className="text-xs text-muted-foreground mt-1">Employee Portal</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-accent/10 text-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center gap-1 text-xs font-medium bg-accent/10 text-accent px-2 py-1 rounded-full">
              <RoleIcon className="w-3 h-3" />
              {roleInfo.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate mb-3">{user.email}</p>
          <Button variant="outline" size="sm" onClick={signOut} className="w-full">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">
        {activeTab === "overview" && <AdminOverview />}
        {activeTab === "schedule" && <AdminSchedule />}
        {activeTab === "my-schedule" && <ViewerSchedule />}
        {activeTab === "employees" && <AdminEmployees />}
      </main>
    </div>
  );
};

export default EmployeeDashboard;

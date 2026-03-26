import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, Shield, CalendarDays, Users, LayoutDashboard } from "lucide-react";
import { useState } from "react";
import AdminSchedule from "@/components/admin/AdminSchedule";
import AdminEmployees from "@/components/admin/AdminEmployees";
import AdminOverview from "@/components/admin/AdminOverview";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, roles: ["admin", "manager", "employee"] },
  { id: "schedule", label: "Schedule", icon: CalendarDays, roles: ["admin", "manager"] },
  { id: "employees", label: "Employees", icon: Users, roles: ["admin"] },
] as const;

type TabId = typeof tabs[number]["id"];

const EmployeeDashboard = () => {
  const { user, isAdmin, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [userRole, setUserRole] = useState<string>("employee");

  // Check role from auth context
  const effectiveRole = isAdmin ? "admin" : userRole;

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

  const visibleTabs = tabs.filter(t => t.roles.includes(effectiveRole as any));

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
            {isAdmin && (
              <span className="flex items-center gap-1 text-xs text-accent font-medium bg-accent/10 px-2 py-1 rounded-full">
                <Shield className="w-3 h-3" />
                Admin
              </span>
            )}
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
        {activeTab === "employees" && <AdminEmployees />}
      </main>
    </div>
  );
};

export default EmployeeDashboard;

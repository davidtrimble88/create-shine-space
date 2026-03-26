import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, Shield, CalendarDays, Users, LayoutDashboard, UserCog, Eye, Hand, FileText, ArrowLeft, BarChart3, Crown, ClipboardList } from "lucide-react";
import { useState } from "react";
import AdminSchedule from "@/components/admin/AdminSchedule";
import AdminEmployees from "@/components/admin/AdminEmployees";
import AdminOverview from "@/components/admin/AdminOverview";
import ViewerSchedule from "@/components/admin/ViewerSchedule";
import ComprehensiveSchedule from "@/components/admin/ComprehensiveSchedule";
import WebsiteAnalytics from "@/components/admin/WebsiteAnalytics";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, roles: ["owner", "admin", "manager", "employee"] },
  { id: "schedule", label: "Schedule", icon: CalendarDays, roles: ["owner", "admin", "manager"] },
  { id: "full-schedule", label: "Full Schedule", icon: FileText, roles: ["owner", "admin", "manager"] },
  { id: "my-schedule", label: "Upcoming Classes", icon: Hand, roles: ["owner", "admin", "manager", "employee"] },
  { id: "employees", label: "Employees", icon: Users, roles: ["owner", "admin"] },
  { id: "analytics", label: "Website Analytics", icon: BarChart3, roles: ["owner"] },
] as const;

type TabId = typeof tabs[number]["id"];

const roleLabels: Record<string, { label: string; icon: typeof Shield }> = {
  owner: { label: "Owner", icon: Crown },
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
          <div className="flex gap-2 mt-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground p-0 h-auto"
              onClick={() => setActiveTab("overview")}
            >
              <LayoutDashboard className="w-3 h-3 mr-1" /> Dashboard
            </Button>
            <span className="text-muted-foreground/30">|</span>
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Website
            </Link>
          </div>
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
        {activeTab === "full-schedule" && <ComprehensiveSchedule />}
        {activeTab === "my-schedule" && <ViewerSchedule />}
        {activeTab === "employees" && <AdminEmployees />}
        {activeTab === "analytics" && <WebsiteAnalytics />}
      </main>
    </div>
  );
};

export default EmployeeDashboard;

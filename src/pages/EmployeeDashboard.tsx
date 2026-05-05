import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, Shield, CalendarDays, Users, LayoutDashboard, UserCog, Eye, Hand, FileText, ArrowLeft, BarChart3, Crown, ClipboardList, KeyRound, HelpCircle, ShieldCheck, Lock, DollarSign, ListChecks, ListPlus, FolderOpen, EyeOff, Smartphone, CreditCard, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import AdminSchedule from "@/components/admin/AdminSchedule";
import AdminEmployees from "@/components/admin/AdminEmployees";
import AdminOverview from "@/components/admin/AdminOverview";
import ViewerSchedule from "@/components/admin/ViewerSchedule";
import ComprehensiveSchedule from "@/components/admin/ComprehensiveSchedule";
import WebsiteAnalytics from "@/components/admin/WebsiteAnalytics";
import AdminBookings from "@/components/admin/AdminBookings";
import RolePermissions from "@/components/admin/RolePermissions";
import HowToGuide from "@/components/admin/HowToGuide";
import SecurityQuestionsSetup from "@/components/admin/SecurityQuestionsSetup";
import ChangePasswordInline from "@/components/admin/ChangePasswordInline";
import EarningsAnalytics from "@/components/admin/EarningsAnalytics";
import ClassRosters from "@/components/admin/ClassRosters";
import AdminReferralSources from "@/components/admin/AdminReferralSources";
import AdminFiles from "@/components/admin/AdminFiles";
import PaymentSettings from "@/components/admin/PaymentSettings";
import IncidentReports from "@/components/admin/IncidentReports";
import SignedWaivers from "@/components/admin/SignedWaivers";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, roles: ["owner", "admin", "manager", "employee"] },
  { id: "schedule", label: "Schedule", icon: CalendarDays, roles: ["owner", "admin", "manager"] },
  { id: "full-schedule", label: "Full Schedule", icon: FileText, roles: ["owner", "admin", "manager", "employee"] },
  { id: "my-schedule", label: "Upcoming Classes", icon: Hand, roles: ["owner", "admin", "manager", "employee"] },
  { id: "employees", label: "Employees", icon: Users, roles: ["owner", "admin"] },
  { id: "bookings", label: "Bookings", icon: ClipboardList, roles: ["owner", "admin"] },
  { id: "referrals", label: "Referral Sources", icon: ListPlus, roles: ["owner", "admin"] },
  { id: "rosters", label: "Class Rosters", icon: ListChecks, roles: ["owner", "admin", "manager", "employee"] },
  { id: "files", label: "Files", icon: FolderOpen, roles: ["owner", "admin", "manager", "employee"] },
  { id: "incident-reports", label: "Incident Reports", icon: AlertCircle, roles: ["owner", "admin"] },
  { id: "signed-waivers", label: "Signed Waivers", icon: ShieldCheck, roles: ["owner", "admin"] },
  { id: "earnings", label: "Earnings", icon: DollarSign, roles: ["owner"] },
  { id: "payment-settings", label: "Payment Settings", icon: CreditCard, roles: ["owner"] },
  { id: "analytics", label: "Website Analytics", icon: BarChart3, roles: ["owner"] },
  { id: "roles", label: "Role Permissions", icon: KeyRound, roles: ["owner"] },
  { id: "security-questions", label: "Security Questions", icon: ShieldCheck, roles: ["owner", "admin", "manager", "employee"] },
  { id: "change-password", label: "Change Password", icon: Lock, roles: ["owner", "admin", "manager", "employee"] },
  { id: "how-to", label: "How To", icon: HelpCircle, roles: ["owner", "admin", "manager", "employee"] },
] as const;

type TabId = typeof tabs[number]["id"];

const roleLabels: Record<string, { label: string; icon: typeof Shield }> = {
  owner: { label: "Owner", icon: Crown },
  admin: { label: "Admin", icon: Shield },
  manager: { label: "Manager", icon: UserCog },
  employee: { label: "Viewer", icon: Eye },
};

const EmployeeDashboard = () => {
  const { user, isAdmin, userRole, effectiveRole, viewAsRole, setViewAsRole, loading, mustChangePassword, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  useEffect(() => {
    const handler = () => setActiveTab("rosters");
    window.addEventListener("openRoster", handler);
    return () => window.removeEventListener("openRoster", handler);
  }, []);

  // If owner switches to a view that hides the active tab, send them back to overview
  useEffect(() => {
    const stillVisible = tabs.find(t => t.id === activeTab)?.roles.includes(effectiveRole as any);
    if (!stillVisible) setActiveTab("overview");
  }, [effectiveRole, activeTab]);

  if (!loading && user && mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

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
  const roleInfo = roleLabels[effectiveRole] || roleLabels.employee;
  const RoleIcon = roleInfo.icon;
  const isOwner = userRole === "owner";
  const isImpersonating = isOwner && !!viewAsRole && viewAsRole !== "owner";

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

        <div className="p-4 border-t border-border space-y-3">
          {isOwner && (
            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1 mb-1.5">
                <Eye className="w-3 h-3" /> View as
              </label>
              <Select
                value={viewAsRole ?? "owner"}
                onValueChange={(v) => setViewAsRole(v === "owner" ? null : (v as any))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner (default)</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="employee">Employee / Viewer</SelectItem>
                </SelectContent>
              </Select>
              {isImpersonating && (
                <button
                  type="button"
                  onClick={() => setViewAsRole(null)}
                  className="mt-1.5 w-full text-[10px] text-accent hover:text-accent/80 flex items-center justify-center gap-1"
                >
                  <EyeOff className="w-3 h-3" /> Exit preview, return to Owner
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-medium bg-accent/10 text-accent px-2 py-1 rounded-full">
              <RoleIcon className="w-3 h-3" />
              {roleInfo.label}
              {isImpersonating && <span className="text-[10px] opacity-70">(preview)</span>}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
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
        {activeTab === "bookings" && <AdminBookings />}
        {activeTab === "referrals" && <AdminReferralSources />}
        {activeTab === "earnings" && <EarningsAnalytics />}
        {activeTab === "payment-settings" && <PaymentSettings />}
        {activeTab === "rosters" && <ClassRosters />}
        {activeTab === "files" && <AdminFiles />}
        {activeTab === "incident-reports" && <IncidentReports />}
        {activeTab === "signed-waivers" && <SignedWaivers />}
        {activeTab === "analytics" && <WebsiteAnalytics />}
        {activeTab === "roles" && <RolePermissions />}
        {activeTab === "security-questions" && <SecurityQuestionsSetup />}
        {activeTab === "change-password" && <ChangePasswordInline />}
        {activeTab === "how-to" && <HowToGuide />}
      </main>
    </div>
  );
};

export default EmployeeDashboard;

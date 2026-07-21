import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { LogOut, Shield, CalendarDays, Users, LayoutDashboard, UserCog, Eye, Hand, FileText, ArrowLeft, BarChart3, Crown, ClipboardList, KeyRound, HelpCircle, ShieldCheck, Lock, DollarSign, ListChecks, ListPlus, FolderOpen, EyeOff, Smartphone, CreditCard, Mail, ChevronLeft, ChevronRight, Wrench, Menu, MessageSquare } from "lucide-react";
import { useState, useEffect, useRef } from "react";
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
import AutoEmails from "@/components/admin/AutoEmails";
import ITTickets from "@/components/admin/ITTickets";
import InstructorCertifications from "@/components/admin/InstructorCertifications";

import SignedWaivers from "@/components/admin/SignedWaivers";
import StudentIds from "@/components/admin/StudentIds";
import NotificationBell from "@/components/admin/NotificationBell";
import MessagingCenter from "@/components/admin/MessagingCenter";

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
  { id: "it-tickets", label: "IT Tickets", icon: Wrench, roles: ["owner", "admin", "manager", "employee"] },
  { id: "messages", label: "Messages", icon: MessageSquare, roles: ["owner", "admin", "manager", "employee"] },
  { id: "certifications", label: "Certifications", icon: ShieldCheck, roles: ["owner", "admin", "manager", "employee"] },
  
  
  { id: "signed-waivers", label: "Signed Waivers", icon: ShieldCheck, roles: ["owner", "admin"] },
  { id: "student-ids", label: "Student IDs", icon: ShieldCheck, roles: ["owner", "admin"] },
  { id: "auto-emails", label: "Auto Emails", icon: Mail, roles: ["owner", "admin"] },
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
  employee: { label: "Instructor", icon: Eye },
};

const EmployeeDashboard = () => {
  const { user, isAdmin, userRole, effectiveRole, viewAsRole, setViewAsRole, loading, mustChangePassword, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobile = useIsMobile();
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (isMobile) {
        if (dx > 0 && !mobileNavOpen && touchStartX.current < 30) setMobileNavOpen(true);
        else if (dx < 0 && mobileNavOpen) setMobileNavOpen(false);
      } else {
        if (dx < 0 && !sidebarCollapsed) setSidebarCollapsed(true);
        else if (dx > 0 && sidebarCollapsed) setSidebarCollapsed(false);
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };


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

  const handleTabSelect = (id: TabId) => {
    setActiveTab(id);
    setMobileNavOpen(false);
  };

  const sidebarInner = (collapsed: boolean) => (
    <>
      {/* Header */}
      <div className={`border-b border-border flex items-center ${collapsed ? "p-3 justify-center" : "p-6"}`}>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <Link to="/" className="text-accent font-bold text-lg">
              Learn to Ride VC
            </Link>
            <p className="text-xs text-muted-foreground mt-1">Employee Portal</p>
            <div className="flex gap-2 mt-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground p-0 h-auto"
                onClick={() => handleTabSelect("overview")}
              >
                <LayoutDashboard className="w-3 h-3 mr-1" /> Dashboard
              </Button>
              <span className="text-muted-foreground/30">|</span>
              <Link to="/" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <ArrowLeft className="w-3 h-3" /> Website
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabSelect(tab.id)}
            className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-colors ${
              collapsed ? "justify-center px-2 py-3" : "px-4 py-3"
            } ${
              activeTab === tab.id
                ? "bg-accent/10 text-accent"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
            title={collapsed ? tab.label : undefined}
          >
            <tab.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{tab.label}</span>}
          </button>
        ))}
      </nav>

      {/* Collapse toggle (desktop only) */}
      {!isMobile && (
        <div className="flex justify-center py-2">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
      )}

      {/* Footer */}
      <div className={`border-t border-border space-y-3 ${collapsed ? "p-2" : "p-4"}`}>
        {isOwner && !collapsed && (
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
                <SelectItem value="employee">Instructor</SelectItem>
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
        {!collapsed && (
          <>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs font-medium bg-accent/10 text-accent px-2 py-1 rounded-full">
                <RoleIcon className="w-3 h-3" />
                {roleInfo.label}
                {isImpersonating && <span className="text-[10px] opacity-70">(preview)</span>}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={signOut}
          className={`${collapsed ? "w-full px-1" : "w-full"}`}
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </div>
    </>
  );

  return (
    <div
      className="min-h-screen bg-background flex"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside
          className={`bg-card border-r border-border flex flex-col min-h-screen transition-all duration-300 ${
            sidebarCollapsed ? "w-16" : "w-64"
          }`}
        >
          {sidebarInner(sidebarCollapsed)}
        </aside>
      )}

      {/* Mobile slide-in nav */}
      {isMobile && (
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="p-0 w-72 flex flex-col">
            {sidebarInner(false)}
          </SheetContent>
        </Sheet>
      )}

      {/* Mobile swipe hint */}
      {isMobile && (
        <button
          onClick={() => setMobileNavOpen(true)}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-20 flex items-center py-2 pl-1 pr-1.5 bg-card/70 backdrop-blur-sm border border-border border-l-0 rounded-r-lg shadow-sm active:bg-card"
          aria-label="Open menu"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground/70" />
        </button>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Mobile sticky top bar */}
        {isMobile && (
          <div className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b border-border flex items-center justify-between px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <div className="flex items-center gap-2 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </Button>
              <span className="text-accent font-bold text-base truncate">Learn to Ride VC</span>
            </div>
            <NotificationBell onNavigate={(t) => setActiveTab(t as typeof activeTab)} />
          </div>
        )}

        <div className={isMobile ? "p-4" : "p-8"}>
          {!isMobile && (
            <div className="flex justify-end mb-4">
              <NotificationBell onNavigate={(t) => setActiveTab(t as typeof activeTab)} />
            </div>
          )}
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
          {activeTab === "it-tickets" && <ITTickets />}
          {activeTab === "certifications" && <InstructorCertifications />}
          {activeTab === "messages" && <MessagingCenter />}
          {activeTab === "signed-waivers" && <SignedWaivers />}
          {activeTab === "student-ids" && <StudentIds />}
          {activeTab === "auto-emails" && <AutoEmails />}
          {activeTab === "analytics" && <WebsiteAnalytics />}
          {activeTab === "roles" && <RolePermissions />}
          {activeTab === "security-questions" && <SecurityQuestionsSetup />}
          {activeTab === "change-password" && <ChangePasswordInline />}
          {activeTab === "how-to" && <HowToGuide />}
        </div>
      </main>
    </div>
  );
};

export default EmployeeDashboard;

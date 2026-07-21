import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";

type Role = "owner" | "admin" | "manager" | "employee";

type Step = {
  tab: string;
  title: string;
  body: string;
  roles: Role[];
};

const STEPS: Step[] = [
  { tab: "overview", title: "Overview", body: "Your home base. Snapshot of upcoming classes, quick stats, and certification status. Every card is clickable and takes you to the details.", roles: ["owner", "admin", "manager", "employee"] },
  { tab: "schedule", title: "Schedule", body: "Create and edit classes, set locations, spots, and pricing. Weekend placeholders auto-generate for planning.", roles: ["owner", "admin", "manager"] },
  { tab: "full-schedule", title: "Full Schedule", body: "See every scheduled class across all locations with instructor assignments.", roles: ["owner", "admin", "manager", "employee"] },
  { tab: "my-schedule", title: "Upcoming Classes", body: "Your personal upcoming classes. Past classes auto-drop off.", roles: ["owner", "admin", "manager", "employee"] },
  { tab: "employees", title: "Employees", body: "Add or edit staff, assign roles (Instructor, Manager, Admin, Owner), and update contact info. Roles stay locked unless you change them.", roles: ["owner", "admin"] },
  { tab: "bookings", title: "Bookings", body: "See all registrations. Manually add students (with payment) or issue refunds.", roles: ["owner", "admin"] },
  { tab: "referrals", title: "Referral Sources", body: "Manage the list of options students see for “How did you hear about us?”.", roles: ["owner", "admin"] },
  { tab: "rosters", title: "Class Rosters", body: "Per-class rosters with waiver status, ID verification column, scores, and manual retest additions with instructor notes.", roles: ["owner", "admin", "manager", "employee"] },
  { tab: "files", title: "Files", body: "Shared documents (including your How-To guide). Visibility is role-scoped automatically.", roles: ["owner", "admin", "manager", "employee"] },
  { tab: "it-tickets", title: "IT Tickets", body: "Report site or tech issues. Owners get notified and can reply here.", roles: ["owner", "admin", "manager", "employee"] },
  { tab: "messages", title: "Messages", body: "Message center. Instructors can reply to any message and start new threads to Owners/Admins. Owners/Admins can message anyone or broadcast to all.", roles: ["owner", "admin", "manager", "employee"] },
  { tab: "certifications", title: "Certifications", body: "Track your certifications and expirations. Auto reminders go out at 30/10/1 days before, and after expiration.", roles: ["owner", "admin", "manager", "employee"] },
  { tab: "signed-waivers", title: "Signed Waivers", body: "All signed waivers, model releases, and registration forms. Search, view full-size, download, or upload manually.", roles: ["owner", "admin"] },
  { tab: "auto-emails", title: "Auto Emails", body: "Edit the automatic emails sent to students (confirmations, reminders, etc.).", roles: ["owner", "admin"] },
  { tab: "discounts", title: "Discounts", body: "Set returning-student amounts for Intermediate and Advanced. Create one-time or promo codes with course restrictions and expiration dates.", roles: ["owner", "admin"] },
  { tab: "earnings", title: "Earnings", body: "Revenue analytics by course, location, and date range.", roles: ["owner"] },
  { tab: "payment-settings", title: "Payment Settings", body: "Switch active payment provider and manage Square location settings.", roles: ["owner"] },
  { tab: "analytics", title: "Website Analytics", body: "Traffic and page-view analytics for the public site.", roles: ["owner"] },
  { tab: "roles", title: "Role Permissions", body: "Reference for what each role can do.", roles: ["owner"] },
  { tab: "security-questions", title: "Security Questions", body: "Set your 3 security questions so you can self-reset your password.", roles: ["owner", "admin", "manager", "employee"] },
  { tab: "change-password", title: "Change Password", body: "Update your login password anytime.", roles: ["owner", "admin", "manager", "employee"] },
  { tab: "how-to", title: "How To & Take Tour", body: "Your role-specific how-to guide lives here. You can also relaunch this tour anytime from the top of the dashboard.", roles: ["owner", "admin", "manager", "employee"] },
];

interface Props {
  role: Role;
  userId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onNavigateTab: (tab: string) => void;
}

export default function DashboardTour({ role, userId, open, onOpenChange, onNavigateTab }: Props) {
  const steps = useMemo(() => STEPS.filter(s => s.roles.includes(role)), [role]);
  const [i, setI] = useState(0);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => { if (open) { setI(0); setMinimized(false); } }, [open]);

  useEffect(() => {
    if (open && steps[i]) onNavigateTab(steps[i].tab);
  }, [i, open, steps, onNavigateTab]);

  // Track the highlighted element's rect
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!open || minimized || !steps[safeIndexRef()]) { setRect(null); return; }
    const targetTab = steps[Math.min(Math.max(i, 0), steps.length - 1)]?.tab;
    if (!targetTab) return;

    let raf = 0;
    const update = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour-target="${targetTab}"]`);
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        setRect(el.getBoundingClientRect());
      } else {
        setRect(null);
      }
    };
    // small delay to let tab switch / layout settle
    const t = window.setTimeout(update, 150);
    const onScrollResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    window.addEventListener("resize", onScrollResize);
    window.addEventListener("scroll", onScrollResize, true);
    const interval = window.setInterval(update, 500);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(interval);
      window.removeEventListener("resize", onScrollResize);
      window.removeEventListener("scroll", onScrollResize, true);
      cancelAnimationFrame(raf);
    };
    function safeIndexRef() { return Math.min(Math.max(i, 0), steps.length - 1); }
  }, [i, open, minimized, steps]);

  if (!open || !steps.length) return null;

  const finish = () => {
    try { localStorage.setItem(`dashboardTourSeen:${userId}`, "1"); } catch {}
    onOpenChange(false);
    onNavigateTab("overview");
  };

  const safeIndex = Math.min(Math.max(i, 0), steps.length - 1);
  const step = steps[safeIndex];
  if (!step) return null;
  const isLast = safeIndex === steps.length - 1;

  if (minimized) {
    return (
      <div className="fixed bottom-6 right-6 z-[60] animate-in fade-in zoom-in duration-300">
        <Button size="lg" onClick={() => setMinimized(false)} className="shadow-2xl ring-2 ring-accent/40 ring-offset-2 ring-offset-background">
          <Sparkles className="w-5 h-5 mr-2" /> Resume tour ({i + 1}/{steps.length})
        </Button>
      </div>
    );
  }

  // Spotlight geometry
  const pad = 8;
  const spot = rect
    ? { x: rect.left - pad, y: rect.top - pad, w: rect.width + pad * 2, h: rect.height + pad * 2 }
    : null;

  return (
    <>
      {/* Spotlight overlay */}
      {spot && (
        <div className="pointer-events-none fixed inset-0 z-40" aria-hidden="true">
          <svg className="absolute inset-0 w-full h-full">
            <defs>
              <mask id="tour-spot-mask">
                <rect width="100%" height="100%" fill="white" />
                <rect
                  x={spot.x}
                  y={spot.y}
                  width={spot.w}
                  height={spot.h}
                  rx={12}
                  ry={12}
                  fill="black"
                  style={{ transition: "all 300ms ease" }}
                />
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="rgba(0,0,0,0.55)"
              mask="url(#tour-spot-mask)"
            />
          </svg>
          {/* Pulsing ring around the target */}
          <div
            className="absolute rounded-xl ring-2 ring-accent animate-pulse"
            style={{
              left: spot.x,
              top: spot.y,
              width: spot.w,
              height: spot.h,
              boxShadow: "0 0 0 4px hsl(var(--accent) / 0.35), 0 0 30px 6px hsl(var(--accent) / 0.45)",
              transition: "all 300ms ease",
            }}
          />
        </div>
      )}

    <div className="fixed bottom-6 right-6 z-50 w-[min(26rem,calc(100vw-2rem))] animate-in slide-in-from-bottom-4 fade-in zoom-in duration-300">
      <div className="rounded-2xl border-2 border-accent/40 bg-card shadow-[0_0_40px_-8px_hsl(var(--accent)/0.35)] ring-1 ring-accent/20 overflow-hidden">
        <div className="bg-accent/10 px-5 py-3 border-b border-accent/20">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-accent font-bold uppercase tracking-wider text-xs">
              <Sparkles className="w-4 h-4" /> Portal Tour · {i + 1} of {steps.length}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMinimized(true)}
                className="text-muted-foreground hover:text-foreground text-xs font-medium px-2 py-1 rounded-md hover:bg-accent/20 transition-colors"
                title="Minimize"
              >
                Hide
              </button>
              <button
                onClick={finish}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-accent/20 transition-colors"
                title="Close tour"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="p-5">
          <h3 className="font-bold text-lg text-foreground">{step.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mt-2">{step.body}</p>
          <div className="mt-4 h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-accent transition-all duration-300" style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={finish} className="text-muted-foreground hover:text-foreground">Skip tour</Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setI(x => Math.max(0, x - 1))} disabled={i === 0}>Back</Button>
              {isLast ? (
                <Button size="sm" onClick={finish}>Finish</Button>
              ) : (
                <Button size="sm" onClick={() => setI(x => Math.min(steps.length - 1, x + 1))}>Next</Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

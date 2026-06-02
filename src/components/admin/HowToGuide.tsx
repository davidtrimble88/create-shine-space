import { useAuth } from "@/contexts/AuthContext";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  LayoutDashboard,
  CalendarDays,
  FileText,
  Hand,
  Users,
  ClipboardList,
  BarChart3,
  KeyRound,
  HelpCircle,
  Shield,
  ShieldCheck,
  ListChecks,
  ListPlus,
  DollarSign,
  Lock,
  FolderOpen,
  CreditCard,
  Smartphone,
  Info,
  Lightbulb,
  AlertTriangle,
  Wrench,
  Mail,
} from "lucide-react";

import overviewImg from "@/assets/howto/overview.png";
import scheduleImg from "@/assets/howto/schedule.png";
import rosterImg from "@/assets/howto/roster.png";
import dl389Img from "@/assets/howto/dl389.png";
import employeesImg from "@/assets/howto/employees.png";
import bookingsImg from "@/assets/howto/bookings.png";
import availabilityImg from "@/assets/howto/availability.png";
import waiversImg from "@/assets/howto/waivers.png";

type Callout = {
  kind: "tip" | "note" | "warning";
  text: string;
};

type Step = string | { heading: string; details: string[] };

interface GuideSection {
  id: string;
  title: string;
  icon: React.ElementType;
  roles: string[];
  intro?: string;
  screenshot?: string;
  screenshotCaption?: string;
  steps: Step[];
  callouts?: Callout[];
}

const guideSections: GuideSection[] = [
  {
    id: "overview-staff",
    title: "Dashboard Overview",
    icon: LayoutDashboard,
    roles: ["manager", "employee"],
    intro:
      "The Overview tab is your landing page every time you sign in. It gives you a one-glance snapshot of what's happening this week.",
    steps: [
      {
        heading: "Read the stat cards at the top",
        details: [
          "Upcoming Classes — how many classes you are personally assigned to teach in the days ahead.",
          "If the number is 0 but you expect assignments, check the Upcoming Classes tab — you may not have been added to a roster yet.",
        ],
      },
      {
        heading: "Use the left sidebar to navigate",
        details: [
          "Only the sections you have permission to see are listed.",
          "Tap the menu icon on mobile to open and close the sidebar.",
        ],
      },
    ],
  },
  {
    id: "overview-admin",
    title: "Dashboard Overview",
    icon: LayoutDashboard,
    roles: ["owner", "admin"],
    intro:
      "The Overview tab gives you a live snapshot of the business — class load, today's registrations, and active staff.",
    screenshot: overviewImg,
    screenshotCaption:
      "Example of the admin overview with daily registration counts and location breakdown.",
    steps: [
      {
        heading: "Read the four stat cards at the top",
        details: [
          "Upcoming Classes — total scheduled classes from today forward, across every location.",
          "Today's Registrations — count of bookings created so far today.",
          "Yesterday's Registrations — for comparison against today.",
          "Active Employees — staff accounts currently enabled.",
        ],
      },
      {
        heading: "Review the Registrations by Location breakdown",
        details: [
          "Each location shows how many registrations came in today and yesterday.",
          "Use this to spot a busy enrollment day at one location before students arrive.",
        ],
      },
      {
        heading: "Jump into the sidebar to take action",
        details: [
          "Owners see every section, including Earnings and Role Permissions.",
          "Admins see everything except Owner-only analytics and payment settings.",
        ],
      },
    ],
    callouts: [
      {
        kind: "tip",
        text: "If 'Upcoming Classes' shows 0 unexpectedly, jump into the Schedule tab and confirm classes were not accidentally cancelled.",
      },
    ],
  },
  {
    id: "schedule",
    title: "Managing Schedules",
    icon: CalendarDays,
    roles: ["owner", "admin", "manager"],
    intro:
      "The Schedule tab is where every class on the calendar is created, edited, cancelled, and staffed.",
    screenshot: scheduleImg,
    screenshotCaption:
      "Schedule list with course, location, time, assigned instructors, and quick Edit/Cancel actions.",
    steps: [
      {
        heading: "Filter the list to find a class fast",
        details: [
          "Use the date range, location, and status filters at the top.",
          "Click Reset to clear all filters and see everything again.",
        ],
      },
      {
        heading: "Add a new class with the orange 'Add Schedule' button",
        details: [
          "Pick the course type (MTC, 1-Day Premier, Intermediate, Advanced ARC).",
          "Pick the location — note that only MTC may be scheduled at High Desert.",
          "Set date, start/end times, and price.",
        ],
      },
      {
        heading: "Edit or cancel an existing class",
        details: [
          "Click Edit on the row to change time, price, or capacity.",
          "Click Cancel to mark a published class as cancelled — it moves to the Cancellations tab so affected students can be contacted.",
          "Use the delete icon only for classes that were never published.",
        ],
      },
      {
        heading: "Assign instructors",
        details: [
          "Open a class and use the Instructor Assignment panel.",
          "The picker respects each instructor's availability, including the weekend placeholders they've marked.",
        ],
      },
    ],
    callouts: [
      {
        kind: "note",
        text: "Weekend placeholder slots auto-generate so instructors can mark availability ahead of any class being formally scheduled. Dismiss a weekend you don't plan to use to remove its placeholder.",
      },
    ],
  },
  {
    id: "full-schedule",
    title: "Viewing the Full Schedule",
    icon: FileText,
    roles: ["owner", "admin", "manager", "employee"],
    intro:
      "The Full Schedule is a read-friendly view of every upcoming class across all locations — useful for printing or sharing.",
    steps: [
      "Use the filter bar to narrow by location, course type, or date range.",
      "Filter by instructor to surface just your own assignments.",
      "Use the print/export button to generate a clean PDF-style report for reference or to hand to staff.",
    ],
  },
  {
    id: "my-schedule",
    title: "Upcoming Classes & Availability",
    icon: Hand,
    roles: ["owner", "admin", "manager", "employee"],
    intro:
      "This is where every staff member tells us when they're free and sees which classes they've been assigned to.",
    screenshot: availabilityImg,
    screenshotCaption:
      "Mark 'I'm available' on dates you can work. Classes you've been assigned to are flagged with an orange Assigned badge.",
    steps: [
      {
        heading: "Mark your availability",
        details: [
          "Tick 'I'm available' for any date you can work — including the auto-generated weekend placeholders.",
          "Untick it to remove yourself from consideration for that date.",
        ],
      },
      {
        heading: "Spot your confirmed assignments",
        details: [
          "Cards with an orange Assigned badge are classes you've already been scheduled for.",
          "Open them to see the class details and any roster notes.",
        ],
      },
    ],
    callouts: [
      {
        kind: "tip",
        text: "Update availability weekly — managers use this data when building the next month of class assignments.",
      },
    ],
  },
  {
    id: "employees",
    title: "Managing Employees",
    icon: Users,
    roles: ["owner", "admin"],
    intro:
      "The Employees tab is the master directory of every staff account — adding new hires, editing profiles, and controlling who appears on the public website.",
    screenshot: employeesImg,
    screenshotCaption:
      "Each employee card shows photo, role badge, contact info, and toggles for Active and Show on Website.",
    steps: [
      {
        heading: "Add a new employee",
        details: [
          "Click 'Add Employee' and fill in name, email, and phone.",
          "A temporary password is generated automatically — share it securely.",
          "On first sign-in the employee is walked through a 2-step setup: change the temporary password, then set security questions.",
        ],
      },
      {
        heading: "Edit a profile",
        details: [
          "Click an employee card to update bio, position title, and profile photo.",
          "Use the photo framing controls to zoom and position the picture for the public About page.",
        ],
      },
      {
        heading: "Control website visibility",
        details: [
          "Toggle 'Show on Website' to add or remove the employee from the public About page.",
          "Toggle 'Active' to disable access without deleting the account — preserves their history on rosters and bookings.",
        ],
      },
    ],
    callouts: [
      {
        kind: "warning",
        text: "Deleting an employee removes them permanently. Almost always prefer turning Active off instead — that revokes login but keeps their record intact.",
      },
    ],
  },
  {
    id: "roles",
    title: "Assigning Roles",
    icon: Shield,
    roles: ["owner", "admin"],
    intro:
      "Roles control what each employee can see and do. They're strict and hierarchical — you can only assign a role at or below your own level.",
    steps: [
      {
        heading: "Change a role from the Employees tab",
        details: [
          "Find the employee, open their card, and choose a new role from the dropdown.",
          "Available roles in the dropdown are filtered to ones you're allowed to assign.",
        ],
      },
      {
        heading: "Role reference",
        details: [
          "Owner — full access to everything, including Earnings, Payment Settings, and Role Permissions.",
          "Admin — manages staff, schedules, bookings, and employees. Can assign Manager / Employee roles.",
          "Manager — creates and manages schedules, views staff availability.",
          "Employee / Viewer — views schedules, marks personal availability, sees shared files.",
        ],
      },
    ],
    callouts: [
      {
        kind: "note",
        text: "Only Owners can promote someone to Admin. Only Owners can demote another Owner.",
      },
    ],
  },
  {
    id: "bookings",
    title: "Managing Bookings",
    icon: ClipboardList,
    roles: ["owner", "admin"],
    intro:
      "The Bookings tab is the complete record of student registrations — paid, pending, manual, and rescheduled.",
    screenshot: bookingsImg,
    screenshotCaption:
      "Every booking with its student, class, payment status, and booking status. Filter by location, course, or status.",
    steps: [
      {
        heading: "Find a booking",
        details: [
          "Use the filters across the top — location, course, status.",
          "Click any row to open the full booking with the student's name, contact info, and waiver status.",
        ],
      },
      {
        heading: "Manual enrollment for phone / walk-in students",
        details: [
          "Click 'Manual Enrollment' to register a student yourself.",
          "Capture First, Middle (required), Last, and an optional Preferred Name — the preferred name shows in parentheses on rosters.",
          "Students may use a Driver's License OR another ID (Passport, School ID, Military ID, etc.). For 'Other' IDs, record the type alongside the number.",
        ],
      },
      {
        heading: "Minors (under 18)",
        details: [
          "The form requires a parent/legal guardian to acknowledge they are making payment — this is enforced automatically.",
        ],
      },
      {
        heading: "Waivers",
        details: [
          "Every student e-signs the official CMSP waiver before payment.",
          "A signed PDF copy is saved automatically and indicated by a green shield on the roster row.",
        ],
      },
    ],
  },
  {
    id: "rosters-staff",
    title: "Class Rosters",
    icon: ListChecks,
    roles: ["manager", "employee"],
    intro:
      "Class Rosters show every upcoming class with the students enrolled. Open a class to get the printable list you'll use on the range.",
    screenshot: rosterImg,
    screenshotCaption:
      "Roster view with student name, preferred name, contact info, DL/ID, waiver shield, and result column.",
    steps: [
      "Each class card shows Registered count and a separate Retests count — retests are NOT included in the registered total.",
      "Click a class to open the full roster with student details: name, preferred name, phone, DL/ID, and DOB.",
      "Green shield next to a name = waiver signed. Amber shield = still missing and the student should sign before class day.",
      "Use the Print button to generate a clean printable roster — waiver status icons are included on the printout.",
    ],
  },
  {
    id: "rosters-admin",
    title: "Class Rosters, Evaluations & Retests",
    icon: ListChecks,
    roles: ["owner", "admin"],
    intro:
      "The admin view of Class Rosters adds evaluation, retest scheduling, drop/reschedule, and routing into the DL389 queue.",
    screenshot: rosterImg,
    screenshotCaption:
      "Admin roster with the Result column for marking Pass/Fail and Comments for internal notes.",
    steps: [
      {
        heading: "Reading the roster",
        details: [
          "Registered count is regular students only. Retests are counted separately.",
          "Comments column is for internal roster notes — visible on screen but never printed.",
          "Green/amber shield indicates waiver status.",
        ],
      },
      {
        heading: "Adding retests",
        details: [
          "Use 'Add Retest Student' inside a roster to enroll a returning student for the Skill, Knowledge, or both portions.",
        ],
      },
      {
        heading: "Dropping or rescheduling a student",
        details: [
          "Use the drop button on a row to remove a student — record the reason and whether they're eligible to be rescheduled.",
          "Reschedule a dropped or affected student into another class directly from the roster; the original class is kept for reference.",
        ],
      },
      {
        heading: "Marking results",
        details: [
          "Use the Result column to mark each student Pass or Fail after class.",
          "Marking Fail opens a dialog to choose which retest portion they're eligible for.",
        ],
      },
      {
        heading: "Evaluation queue",
        details: [
          "After class date passes, classes with un-evaluated students appear under 'Evaluation Pending' until every student has a Pass/Fail recorded.",
          "Once everyone is evaluated, classes with passed students move into the DL389 queue.",
        ],
      },
    ],
  },
  {
    id: "dl389",
    title: "DL389 Certificate Tracking",
    icon: FileText,
    roles: ["owner", "admin"],
    intro:
      "DL389 is the to-do queue of passed students who still need a paper certificate created and handed out.",
    screenshot: dl389Img,
    screenshotCaption:
      "DL389 queue with student details dialog — everything you need to fill out the certificate.",
    steps: [
      "Open the DL389 view from inside Class Rosters.",
      "Click a student to open a dialog with their full details — name, contact, DOB, license/ID, address, and roster comments.",
      "Fill out the paper DL389 using those details.",
      "Back in the dialog, flip the 'DL389 has been created' toggle so they fall off the queue.",
      "Once every passed student in a class is marked complete, the class moves into the Past Roster archive automatically.",
    ],
    callouts: [
      {
        kind: "note",
        text: "DL389 is restricted to Owners and Admins. Other staff don't see this view.",
      },
    ],
  },
  {
    id: "referrals",
    title: "Referral Sources",
    icon: ListPlus,
    roles: ["owner", "admin"],
    intro:
      "Manages the 'How did you hear about us?' dropdown on the public registration form.",
    steps: [
      "Add new sources, rename existing ones, or change their display order via the sort field.",
      "Toggle a source inactive to hide it from the public form without deleting it — existing bookings keep their reference intact.",
    ],
  },
  {
    id: "files-staff",
    title: "Shared Files",
    icon: FolderOpen,
    roles: ["manager", "employee"],
    intro:
      "Shared Files is a read-only library of documents management has posted for the team — manuals, blank forms, policies.",
    steps: [
      "Browse the list and click Download on any file you need (e.g., blank DL389 forms, instructor manuals).",
      "Contact an Owner or Admin if a file needs to be added, updated, or removed.",
    ],
  },
  {
    id: "files-admin",
    title: "Shared Files",
    icon: FolderOpen,
    roles: ["owner", "admin"],
    intro:
      "The admin view of Shared Files lets you upload, rename, and remove documents the team can download.",
    steps: [
      "Click 'Upload File' to add a new resource (50 MB max). Give it a display name and optional description.",
      "Use the edit and delete buttons to keep the library current.",
      "Every signed-in staff member can browse and download — there is no per-file permission.",
    ],
  },
  {
    id: "signed-waivers",
    title: "Signed Waivers",
    icon: ShieldCheck,
    roles: ["owner", "admin"],
    intro:
      "The legal archive of every electronically signed CMSP waiver. Append-only by design.",
    screenshot: waiversImg,
    screenshotCaption:
      "Waivers archive with signer, course, signature timestamp, IP, document hash, and View / Download actions.",
    steps: [
      "Each row links a signer to their booking, course, location, class date, signature timestamp, IP address, and document hash.",
      "Click View to preview the saved PDF — the official template plus an audit-trail page.",
      "Click Download to save a copy for your records.",
      "Search by name, email, course, or location to find a specific waiver fast.",
    ],
    callouts: [
      {
        kind: "warning",
        text: "Waivers are append-only and cannot be edited or deleted. This preserves their legal validity under ESIGN/UETA.",
      },
    ],
  },
  {
    id: "cancellations",
    title: "Cancellations",
    icon: CalendarDays,
    roles: ["owner", "admin"],
    intro:
      "A running list of classes (or class parts) that have been cancelled, with who cancelled them and why.",
    steps: [
      "Use this list as a follow-up queue to contact affected students.",
      "Reschedule a student straight from their original roster's reschedule action.",
    ],
  },
  {
    id: "payment-settings",
    title: "Payment Settings",
    icon: CreditCard,
    roles: ["owner"],
    intro:
      "Controls which payment provider is active for online checkout. Owner-only.",
    steps: [
      "Square is the default and runs in live mode using the Web Payments SDK.",
      "Toggle providers on/off and switch between sandbox and live modes when testing.",
    ],
  },
  {
    id: "install-app",
    title: "Install the App",
    icon: Smartphone,
    roles: ["owner", "admin", "manager", "employee"],
    intro:
      "Add the Employee Portal to your phone or desktop home screen for a one-tap, full-screen launch.",
    steps: [
      "Open the 'Install App' page from the navbar.",
      "iPhone / iPad: open in Safari → tap Share → 'Add to Home Screen'.",
      "Android / Chrome: tap the install prompt, or use the menu's 'Install app' option.",
      "Desktop Chrome / Edge: click the install icon in the address bar.",
      "Once installed, the app launches full-screen and stays signed in for faster access on class day.",
    ],
  },
  {
    id: "earnings",
    title: "Earnings Analytics",
    icon: DollarSign,
    roles: ["owner"],
    intro:
      "Revenue trends pulled from completed bookings. Owner-only.",
    steps: [
      "Filter by date range, location, or course to break down income.",
      "Use this view to track monthly performance and identify top-performing courses or locations.",
    ],
  },
  {
    id: "analytics",
    title: "Website Analytics",
    icon: BarChart3,
    roles: ["owner"],
    intro:
      "Insights into public website traffic — popular pages, visitor trends, and how interest maps to courses.",
    steps: [
      "View page visit counts, popular pages, and visitor trends over time.",
      "Use this data to understand which courses and locations attract the most interest.",
      "Analytics update in real time as visitors browse the public site.",
    ],
  },
  {
    id: "permissions",
    title: "Role Permissions Reference",
    icon: KeyRound,
    roles: ["owner"],
    intro:
      "A complete breakdown of every feature and which roles have access. Owner-only.",
    steps: [
      "Use this matrix when deciding which role to assign to a new hire.",
      "Every section of the portal is listed with the roles that can view or edit it.",
    ],
  },
  {
    id: "security-questions",
    title: "Security Questions",
    icon: ShieldCheck,
    roles: ["owner", "admin", "manager", "employee"],
    intro:
      "Set up the questions used to verify your identity during the self-serve password reset flow.",
    steps: [
      "Pick questions and provide answers you'll remember — answers are case-insensitive but should be specific.",
      "You can update your questions and answers at any time from this tab.",
      "These questions are the ones you'll be asked on the Forgot Password screen at the login page.",
    ],
  },
  {
    id: "change-password",
    title: "Change Password",
    icon: Lock,
    roles: ["owner", "admin", "manager", "employee"],
    intro:
      "Change your account password at any time.",
    steps: [
      "Enter your current password, then your new password twice to confirm.",
      "If an admin reset your password, you'll be required to change it on next sign-in before you can use the dashboard.",
      "Choose a strong password — mix uppercase, lowercase, numbers, and symbols.",
    ],
  },
];

const calloutStyles: Record<Callout["kind"], { wrap: string; icon: React.ElementType }> = {
  tip: {
    wrap: "border-accent/40 bg-accent/5 text-foreground",
    icon: Lightbulb,
  },
  note: {
    wrap: "border-border bg-muted/40 text-foreground",
    icon: Info,
  },
  warning: {
    wrap: "border-destructive/40 bg-destructive/10 text-foreground",
    icon: AlertTriangle,
  },
};

const renderStep = (step: Step, idx: number) => {
  if (typeof step === "string") {
    return (
      <li key={idx} className="leading-relaxed">
        {step}
      </li>
    );
  }
  return (
    <li key={idx} className="leading-relaxed">
      <span className="font-semibold text-foreground">{step.heading}</span>
      <ul className="mt-1.5 space-y-1 pl-5 list-disc text-muted-foreground">
        {step.details.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>
    </li>
  );
};

const HowToGuide = () => {
  const { effectiveRole } = useAuth();

  const visibleSections = guideSections.filter((s) =>
    s.roles.includes(effectiveRole)
  );

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <HelpCircle className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold text-foreground">How To Guide</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          Step-by-step instructions for every section of the Employee Portal. Only features available to your role are shown below. Click any section to expand.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <Accordion type="multiple" className="space-y-2">
          {visibleSections.map((section) => (
            <AccordionItem
              key={section.id}
              value={section.id}
              className="border border-border rounded-lg px-4"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <section.icon className="w-5 h-5 text-accent" />
                  <span className="font-medium text-foreground text-left">
                    {section.title}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pb-2">
                  {section.intro && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {section.intro}
                    </p>
                  )}

                  {section.screenshot && (
                    <figure className="rounded-lg overflow-hidden border border-border bg-background/50">
                      <img
                        src={section.screenshot}
                        alt={`${section.title} screenshot`}
                        loading="lazy"
                        width={1280}
                        height={768}
                        className="w-full h-auto block"
                      />
                      {section.screenshotCaption && (
                        <figcaption className="px-3 py-2 text-xs text-muted-foreground border-t border-border">
                          {section.screenshotCaption}
                        </figcaption>
                      )}
                    </figure>
                  )}

                  <ol className="space-y-3 pl-6 list-decimal text-sm text-muted-foreground marker:text-accent marker:font-semibold">
                    {section.steps.map(renderStep)}
                  </ol>

                  {section.callouts?.map((c, i) => {
                    const { wrap, icon: Icon } = calloutStyles[c.kind];
                    return (
                      <div
                        key={i}
                        className={`flex gap-2 items-start rounded-md border px-3 py-2 text-sm ${wrap}`}
                      >
                        <Icon className="w-4 h-4 mt-0.5 text-accent flex-shrink-0" />
                        <span className="leading-relaxed">{c.text}</span>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
};

export default HowToGuide;

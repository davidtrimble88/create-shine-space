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
} from "lucide-react";

interface GuideSection {
  id: string;
  title: string;
  icon: React.ElementType;
  roles: string[];
  steps: string[];
}

const guideSections: GuideSection[] = [
  {
    id: "overview-staff",
    title: "Dashboard Overview",
    icon: LayoutDashboard,
    roles: ["manager", "employee"],
    steps: [
      "The Overview tab is your home screen when you log in.",
      "It shows how many upcoming classes you are personally assigned to teach.",
      "Use the sidebar on the left to navigate between sections you have access to.",
    ],
  },
  {
    id: "overview-admin",
    title: "Dashboard Overview",
    icon: LayoutDashboard,
    roles: ["owner", "admin"],
    steps: [
      "The Overview tab is your home screen when you log in.",
      "It displays total classes, your upcoming assigned classes, and the active employee count.",
      "Owners also see today's and yesterday's earnings broken down by location.",
      "Use the sidebar on the left to navigate between every section available to your role.",
    ],
  },
  {
    id: "schedule",
    title: "Managing Schedules",
    icon: CalendarDays,
    roles: ["owner", "admin", "manager"],
    steps: [
      "Navigate to the 'Schedule' tab to create and manage class schedules.",
      "Click 'Add Schedule' to create a new class — select the course, location, date, time, and price.",
      "You can edit existing schedules by clicking on them in the list.",
      "To delete a schedule, click the delete icon next to the entry. To cancel an already-published class, use the cancel option so it appears under 'Cancellations' for the team.",
      "Assign instructors to classes using the instructor assignment panel within each schedule. Instructor availability (including weekend placeholders) is taken into account.",
      "Empty weekend slots are auto-generated as placeholders so instructors can mark availability before classes are formally scheduled. Dismiss a weekend you don't plan to use to remove its placeholder.",
    ],
  },
  {
    id: "full-schedule",
    title: "Viewing the Full Schedule",
    icon: FileText,
    roles: ["owner", "admin", "manager", "employee"],
    steps: [
      "The 'Full Schedule' tab shows all upcoming classes across all locations.",
      "Use the filters at the top to narrow by location, course type, or date range.",
      "You can filter by instructor to quickly find your own assignments.",
      "Use the print/export feature to generate a formatted schedule report for reference.",
    ],
  },
  {
    id: "my-schedule",
    title: "Upcoming Classes & Availability",
    icon: Hand,
    roles: ["owner", "admin", "manager", "employee"],
    steps: [
      "The 'Upcoming Classes' tab shows classes relevant to you.",
      "Mark your availability for upcoming dates by toggling the availability checkbox.",
      "Your availability helps managers and admins know when you can be assigned to classes.",
      "You'll see your confirmed assignments highlighted in the list.",
    ],
  },
  {
    id: "employees",
    title: "Managing Employees",
    icon: Users,
    roles: ["owner", "admin"],
    steps: [
      "Go to the 'Employees' tab to view and manage all staff members.",
      "Click 'Add Employee' to create a new staff account — enter their name, email, and phone.",
      "A temporary password will be generated. The employee must change it on first login.",
      "Edit employee profiles to update photos, bios, and position titles.",
      "Use the photo framing controls to adjust zoom and positioning for profile pictures.",
      "Toggle 'Show on Website' to control whether an employee appears on the public About page.",
      "Deactivate employees by toggling their active status instead of deleting them.",
    ],
  },
  {
    id: "roles",
    title: "Assigning Roles",
    icon: Shield,
    roles: ["owner", "admin"],
    steps: [
      "Roles determine what each employee can see and do in the portal.",
      "To change an employee's role, go to the Employees tab and find their entry.",
      "Select a new role from the dropdown — available roles depend on your own access level.",
      "Owner: Full access to everything including analytics and role permissions.",
      "Admin: Manages staff, schedules, bookings, and employees. Can assign Manager/Employee roles.",
      "Manager: Can create and manage schedules and view staff availability.",
      "Employee/Viewer: Can view schedules, upcoming classes, and mark personal availability.",
    ],
  },
  {
    id: "bookings",
    title: "Managing Bookings",
    icon: ClipboardList,
    roles: ["owner", "admin"],
    steps: [
      "The 'Bookings' tab shows all student registrations and their payment status.",
      "Filter bookings by location, course, or status to find specific entries.",
      "Update payment status and booking status as students complete their registration.",
      "Use the manual enrollment feature to register students over the phone or in person.",
      "Registration captures First, Middle (required), Last, and an optional Preferred Name. The preferred name is shown in parentheses on rosters so instructors know what to call the student.",
      "When a minor (under 18) registers, the form requires a parent/legal guardian acknowledgment that they are making payment — this is enforced automatically.",
      "Students can register with a Driver's License OR another ID (Passport, School ID, Military ID, etc.). For 'Other' IDs, the type is stored alongside the ID number.",
      "After registering, every student e-signs the official CMSP waiver before payment. A signed PDF copy is saved automatically and shown on the booking with a green shield icon on the roster.",
    ],
  },
  {
    id: "rosters-staff",
    title: "Class Rosters",
    icon: ListChecks,
    roles: ["manager", "employee"],
    steps: [
      "Open 'Class Rosters' to see all upcoming classes with their student lists.",
      "Each class card shows the number of regular students 'registered' and, separately, how many 'retest' students are signed up. Retests are NOT counted in the registered total.",
      "Click a class to open its full roster with student details (name, preferred name, phone, DL/ID, DOB).",
      "A green shield next to a student's name means their waiver is signed; an amber shield means it is still missing.",
      "Use the print button to generate a clean printable roster for class day — waiver status icons are included on the printout.",
    ],
  },
  {
    id: "rosters-admin",
    title: "Class Rosters, Evaluations & Retests",
    icon: ListChecks,
    roles: ["owner", "admin"],
    steps: [
      "Open 'Class Rosters' to see all upcoming classes with their student lists.",
      "Each class card shows the number of regular students 'registered' and, separately, how many 'retest' students are signed up. Retests are NOT counted in the registered total.",
      "Click a class to open its full roster with student details (name, preferred name, phone, DL/ID, DOB, comments).",
      "A green shield next to each name means the waiver is signed; an amber shield means the student still needs to sign before class day.",
      "Comments column: Add roster notes per student. Comments are visible on screen but never appear on printed rosters.",
      "Use 'Add Retest Student' inside a roster to register a returning student for a re-test in the Skill, Knowledge, or both portions.",
      "Drop a student from a class using the drop button on their row — record a reason and whether they're eligible to be rescheduled.",
      "Reschedule a dropped or affected student into another class directly from the roster; original class info is kept for reference.",
      "Result column: mark each student Pass or Fail after the class. Marking Fail opens a dialog to choose which retest portion they're eligible for.",
      "After the class date passes, classes with un-evaluated students appear under 'Evaluation Pending' until every student has a Pass/Fail recorded.",
      "Once all students are evaluated, classes with passed students move to the 'DL389' queue.",
    ],
  },
  {
    id: "dl389",
    title: "DL389 Certificate Tracking",
    icon: FileText,
    roles: ["owner", "admin"],
    steps: [
      "The 'DL389' view (inside Class Rosters) lists every passed student who still needs a DL389 certificate created.",
      "Click a student to open a dialog with their full details — name, contact info, DOB, license/ID, address, and roster comments — everything you need to fill out the DL389.",
      "After you've created the DL389 for that student, check the 'DL389 has been created' toggle in the dialog.",
      "Once every passed student in a class has been marked complete, the class automatically moves into the 'Past Roster' archive.",
      "This view is restricted to Owners and Admins only.",
    ],
  },
  {
    id: "referrals",
    title: "Referral Sources",
    icon: ListPlus,
    roles: ["owner", "admin"],
    steps: [
      "The 'Referral Sources' tab manages the dropdown options shown on the public registration form ('How did you hear about us?').",
      "Add new sources, rename existing ones, or reorder them using the sort order field.",
      "Toggle a source inactive to hide it from the public form without deleting it (existing bookings keep their reference).",
    ],
  },
  {
    id: "files-staff",
    title: "Shared Files",
    icon: FolderOpen,
    roles: ["manager", "employee"],
    steps: [
      "The 'Files' tab holds documents, forms, and resources shared by management.",
      "Browse the list and click download on any file you need (e.g., blank DL389 forms, instructor manuals, policy documents).",
      "This view is read-only — contact an Owner or Admin if a file needs to be added or updated.",
    ],
  },
  {
    id: "files-admin",
    title: "Shared Files",
    icon: FolderOpen,
    roles: ["owner", "admin"],
    steps: [
      "The 'Files' tab is where you share documents, forms, and resources with the whole team.",
      "Click 'Upload File' to add a new resource (max 50 MB), give it a display name and optional description.",
      "Use the edit and delete buttons to keep the library current.",
      "All signed-in staff can browse and download these files.",
    ],
  },
  {
    id: "signed-waivers",
    title: "Signed Waivers",
    icon: ShieldCheck,
    roles: ["owner", "admin"],
    steps: [
      "The 'Signed Waivers' tab is the legal archive of every electronically signed CMSP waiver.",
      "Each row links a signer to their booking, course, location, class date, signature timestamp, IP address, and document hash.",
      "Click 'View' to preview the saved PDF (the official template plus an audit-trail page) and 'Download' to save a copy for records.",
      "Search by name, email, course, or location to quickly find a specific waiver.",
      "Waivers are append-only — they cannot be edited or deleted, which preserves their legal validity under ESIGN/UETA.",
    ],
  },
  {
    id: "cancellations",
    title: "Cancellations",
    icon: CalendarDays,
    roles: ["owner", "admin"],
    steps: [
      "The 'Cancellations' view lists classes (or class parts) that have been cancelled, along with who cancelled them and why.",
      "Use this list to follow up with affected students and reschedule them through the roster reschedule action.",
    ],
  },
  {
    id: "payment-settings",
    title: "Payment Settings",
    icon: CreditCard,
    roles: ["owner"],
    steps: [
      "The 'Payment Settings' tab controls which payment provider is active for online checkout.",
      "Square is the default and runs in live mode using the Web Payments SDK.",
      "Toggle providers on/off and switch between sandbox and live modes when testing.",
      "Only the Owner can change these settings.",
    ],
  },
  {
    id: "install-app",
    title: "Install the App",
    icon: Smartphone,
    roles: ["owner", "admin", "manager", "employee"],
    steps: [
      "Open the 'Install App' page from the navbar to add the Employee Portal to your phone or desktop home screen.",
      "On iPhone/iPad: open in Safari, tap Share, then 'Add to Home Screen'.",
      "On Android/Chrome: tap the install prompt or use the menu's 'Install app' option.",
      "The installed app launches full-screen and stays signed in for faster access on class day.",
    ],
  },
  {
    id: "earnings",
    title: "Earnings Analytics",
    icon: DollarSign,
    roles: ["owner"],
    steps: [
      "The 'Earnings' tab shows revenue trends pulled from completed bookings.",
      "Filter by date range, location, or course to break down income.",
      "Use this view to track monthly performance and identify top-performing courses or locations.",
      "Restricted to Owner role only.",
    ],
  },
  {
    id: "analytics",
    title: "Website Analytics",
    icon: BarChart3,
    roles: ["owner"],
    steps: [
      "The 'Website Analytics' tab provides insights into website traffic.",
      "View page visit counts, popular pages, and visitor trends over time.",
      "Use this data to understand which courses and locations attract the most interest.",
      "Analytics update in real time as visitors browse the public website.",
    ],
  },
  {
    id: "permissions",
    title: "Role Permissions Reference",
    icon: KeyRound,
    roles: ["owner"],
    steps: [
      "The 'Role Permissions' tab provides a complete breakdown of what each role can do.",
      "Use it as a reference when deciding which role to assign to an employee.",
      "The permission matrix shows every feature and which roles have access.",
    ],
  },
  {
    id: "security-questions",
    title: "Security Questions",
    icon: ShieldCheck,
    roles: ["owner", "admin", "manager", "employee"],
    steps: [
      "Set up security questions so you can recover your account if you forget your password.",
      "Choose questions and provide answers you'll remember — answers are case-insensitive but should be specific.",
      "You can update your questions and answers at any time from this tab.",
      "These questions are used during the self-serve password reset flow on the login page.",
    ],
  },
  {
    id: "change-password",
    title: "Change Password",
    icon: Lock,
    roles: ["owner", "admin", "manager", "employee"],
    steps: [
      "Use the 'Change Password' tab to update your account password at any time.",
      "Enter your current password, then your new password twice to confirm.",
      "If an admin reset your password, you'll be required to change it on next login before accessing the dashboard.",
      "Choose a strong password — mix letters, numbers, and symbols.",
    ],
  },
];

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
          Learn how to use each section of the Employee Portal. Only features available to your role are shown below.
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
                  <span className="font-medium text-foreground">
                    {section.title}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ol className="space-y-2 pl-8 list-decimal text-sm text-muted-foreground">
                  {section.steps.map((step, i) => (
                    <li key={i} className="leading-relaxed">
                      {step}
                    </li>
                  ))}
                </ol>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
};

export default HowToGuide;

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
  ListChecks,
  ListPlus,
  DollarSign,
  ShieldCheck,
  Lock,
  FolderOpen,
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
    id: "overview",
    title: "Dashboard Overview",
    icon: LayoutDashboard,
    roles: ["owner", "admin", "manager", "employee"],
    steps: [
      "The Overview tab is your home screen when you log in.",
      "It displays a summary of upcoming classes you're assigned to.",
      "You can see recent activity and quick stats relevant to your role.",
      "Use the sidebar on the left to navigate between different sections.",
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
      "To delete a schedule, click the delete icon next to the entry.",
      "Assign instructors to classes using the instructor assignment panel within each schedule.",
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
      "When a minor (under 18) registers, the form requires a parent/legal guardian acknowledgment that they are making payment — this is enforced automatically.",
      "Students can register with a Driver's License OR another ID (Passport, School ID, Military ID, etc.). For 'Other' IDs, the type is stored alongside the ID number.",
    ],
  },
  {
    id: "rosters",
    title: "Class Rosters, Evaluations & Retests",
    icon: ListChecks,
    roles: ["owner", "admin", "manager", "employee"],
    steps: [
      "Open 'Class Rosters' to see all upcoming classes with their student lists.",
      "Each class card shows the number of regular students 'registered' and, separately, how many 'retest' students are signed up. Retests are NOT counted in the registered total.",
      "Click a class to open its full roster with student details (name, phone, DL/ID, DOB, comments).",
      "Comments column: Add roster notes per student. Retest students added via the booking funnel will not get auto-generated comment text.",
      "Use 'Add Retest Student' inside a roster to register a returning student for a re-test in the Skill, Knowledge, or both portions.",
      "Result column (Owner/Admin only): mark each student Pass or Fail after the class. Marking Fail opens a dialog to choose which retest portion they're eligible for.",
      "After the class date passes, classes with un-evaluated students appear under 'Evaluation Pending' until every student has a Pass/Fail recorded.",
      "Once all students are evaluated, classes with passed students move to the 'DL389' queue (Owner/Admin only).",
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
  const { userRole } = useAuth();

  const visibleSections = guideSections.filter((s) =>
    s.roles.includes(userRole)
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

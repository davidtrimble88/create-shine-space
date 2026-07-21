import { Shield, Crown, UserCog, Eye, Check, X } from "lucide-react";

const roles = [
  { key: "owner", label: "Owner", icon: Crown, description: "Full access to everything. Cannot be assigned — set by system." },
  { key: "admin", label: "Admin", icon: Shield, description: "Manages staff (up to manager level), schedules, bookings, and employees." },
  { key: "manager", label: "Manager", icon: UserCog, description: "Manages schedules and views staff availability." },
  { key: "employee", label: "Instructor", icon: Eye, description: "Views schedule and marks personal availability." },
];

const permissions = [
  { label: "View Dashboard Overview", owner: true, admin: true, manager: true, employee: true },
  { label: "View Upcoming Classes", owner: true, admin: true, manager: true, employee: true },
  { label: "Mark Personal Availability", owner: true, admin: true, manager: true, employee: true },
  { label: "View Full Schedule", owner: true, admin: true, manager: true, employee: true },
  { label: "Create / Edit Schedules", owner: true, admin: true, manager: true, employee: false },
  { label: "Delete Schedules", owner: true, admin: true, manager: true, employee: false },
  { label: "Assign Instructors to Classes", owner: true, admin: true, manager: true, employee: false },
  { label: "Dismiss Placeholder Weekends", owner: true, admin: true, manager: false, employee: false },
  { label: "View & Manage Bookings", owner: true, admin: true, manager: false, employee: false },
  { label: "View & Manage Employees", owner: true, admin: true, manager: false, employee: false },
  { label: "Add / Remove Employees", owner: true, admin: true, manager: false, employee: false },
  { label: "Edit Employee Photos & Bios", owner: true, admin: true, manager: false, employee: false },
  { label: "Assign Roles (Manager, Employee)", owner: true, admin: true, manager: false, employee: false },
  { label: "Assign Roles (Owner, Admin)", owner: true, admin: false, manager: false, employee: false },
  { label: "View Website Analytics", owner: true, admin: false, manager: false, employee: false },
  { label: "View Role Permissions (this page)", owner: true, admin: false, manager: false, employee: false },
];

const RolePermissions = () => {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Role Permissions</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Breakdown of what each access level can and cannot do.
        </p>
      </div>

      {/* Role Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {roles.map((role) => (
          <div key={role.key} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <role.icon className="w-5 h-5 text-accent" />
              <h3 className="font-semibold text-foreground">{role.label}</h3>
            </div>
            <p className="text-xs text-muted-foreground">{role.description}</p>
          </div>
        ))}
      </div>

      {/* Permissions Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left p-4 font-medium text-muted-foreground">Permission</th>
                {roles.map(r => (
                  <th key={r.key} className="text-center p-4 font-medium text-muted-foreground">
                    <div className="flex flex-col items-center gap-1">
                      <r.icon className="w-4 h-4" />
                      <span>{r.label}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((perm, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="p-4 text-foreground">{perm.label}</td>
                  {roles.map(r => {
                    const allowed = perm[r.key as keyof typeof perm];
                    return (
                      <td key={r.key} className="text-center p-4">
                        {allowed ? (
                          <Check className="w-4 h-4 text-green-400 mx-auto" />
                        ) : (
                          <X className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RolePermissions;

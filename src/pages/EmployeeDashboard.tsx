import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, Shield, User } from "lucide-react";
import { Navigate, Link } from "react-router-dom";

const EmployeeDashboard = () => {
  const { user, isAdmin, loading, signOut } = useAuth();

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-accent font-bold text-xl">
              Learn to Ride VC
            </Link>
            <span className="text-muted-foreground">|</span>
            <span className="text-foreground font-medium">Employee Portal</span>
          </div>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <span className="flex items-center gap-1 text-sm text-accent font-medium bg-accent/10 px-3 py-1 rounded-full">
                <Shield className="w-4 h-4" />
                Admin
              </span>
            )}
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
              <User className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Welcome back{isAdmin ? ", Admin" : ""}!
              </h1>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-semibold text-foreground mb-2">Dashboard</h3>
              <p className="text-muted-foreground text-sm">
                Your employee dashboard is ready. We'll add more features as we continue building.
              </p>
            </div>
            {isAdmin && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-accent" />
                  Admin Panel
                </h3>
                <p className="text-muted-foreground text-sm">
                  You have full admin access. Management tools will appear here as we build them.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default EmployeeDashboard;

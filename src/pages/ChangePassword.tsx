import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2 } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const ChangePassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, mustChangePassword, clearMustChangePassword } = useAuth();

  if (!user) return <Navigate to="/employee-login" replace />;
  if (!mustChangePassword) return <Navigate to="/employee-dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords don't match", description: "Please make sure both fields match.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsLoading(false);
      return;
    }

    // Clear the flag in the database
    await supabase.from("employees").update({ must_change_password: false }).eq("user_id", user.id);
    clearMustChangePassword();
    toast({ title: "Password updated!", description: "You can now use your new password." });
    navigate("/employee-dashboard");
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Set Your Password</h1>
          <p className="text-muted-foreground mt-2">Please create a new password for your account</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirm"
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="pl-10"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Set Password"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;

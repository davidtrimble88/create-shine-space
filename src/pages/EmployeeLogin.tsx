import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Lock, Mail, Loader2, ScanFace } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  biometricAvailable,
  biometryLabel,
  clearCredentials,
  isBiometricEnabled,
  isNative,
  saveCredentials,
  verifyAndGetCredentials,
} from "@/lib/biometric";
import type { BiometryType } from "capacitor-native-biometric";

const EmployeeLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [bioReady, setBioReady] = useState(false);
  const [bioType, setBioType] = useState<BiometryType | null>(null);
  const [showEnablePrompt, setShowEnablePrompt] = useState(false);
  const [pendingCreds, setPendingCreds] = useState<{ email: string; password: string } | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, mustChangePassword } = useAuth();

  // Check biometric availability + auto-prompt if previously enabled
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { available, type } = await biometricAvailable();
      if (cancelled) return;
      setBioReady(available);
      setBioType(type);
      if (available && isBiometricEnabled() && isNative()) {
        // Auto trigger
        handleBiometricLogin();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (user && !mustChangePassword) {
    return <Navigate to="/employee-dashboard" replace />;
  }

  const completeLogin = async (em: string, pw: string, fromBiometric: boolean) => {
    const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
    if (error) {
      if (fromBiometric) {
        // Stored creds no longer valid — clear them
        await clearCredentials();
        toast({
          title: "Biometric Sign-In Failed",
          description: "Your saved password is no longer valid. Please sign in manually.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Login Failed", description: error.message, variant: "destructive" });
      }
      return false;
    }
    toast({ title: "Welcome back!", description: "You've been signed in successfully." });
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const ok = await completeLogin(email, password, false);
    setIsLoading(false);
    if (!ok) return;

    // Offer biometric if available and not already enabled
    if (bioReady && !isBiometricEnabled()) {
      setPendingCreds({ email, password });
      setShowEnablePrompt(true);
    } else {
      navigate("/employee-dashboard");
    }
  };

  const handleBiometricLogin = async () => {
    try {
      setIsLoading(true);
      const creds = await verifyAndGetCredentials(
        `Sign in to LTR with ${biometryLabel(bioType)}`,
      );
      const ok = await completeLogin(creds.username, creds.password, true);
      if (ok) navigate("/employee-dashboard");
    } catch (err: any) {
      // User cancelled or biometric failed
      if (err?.message && !/cancel/i.test(err.message)) {
        toast({
          title: "Biometric Error",
          description: err.message,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableBiometric = async () => {
    if (!pendingCreds) return;
    try {
      await saveCredentials(pendingCreds.email, pendingCreds.password);
      toast({
        title: `${biometryLabel(bioType)} Enabled`,
        description: "Next time, just use your face or fingerprint.",
      });
    } catch (err: any) {
      toast({
        title: "Could not enable biometrics",
        description: err?.message ?? "Try again later.",
        variant: "destructive",
      });
    } finally {
      setShowEnablePrompt(false);
      setPendingCreds(null);
      navigate("/employee-dashboard");
    }
  };

  const handleSkipBiometric = () => {
    setShowEnablePrompt(false);
    setPendingCreds(null);
    navigate("/employee-dashboard");
  };

  const bioLabel = biometryLabel(bioType);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-accent font-bold text-2xl">
            Learn to Ride VC
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-6">Employee Login</h1>
          <p className="text-muted-foreground mt-2">Sign in to access the employee portal</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@learntoridevc.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
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
                />
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          {bioReady && isBiometricEnabled() && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full mt-3"
              onClick={handleBiometricLogin}
              disabled={isLoading}
            >
              <ScanFace className="mr-2 h-4 w-4" />
              Sign in with {bioLabel}
            </Button>
          )}

          <div className="mt-4 text-center">
            <Link to="/forgot-password" className="text-sm text-accent hover:underline">
              Forgot your password?
            </Link>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          <Link to="/" className="text-accent hover:underline">
            ← Back to website
          </Link>
        </p>
      </div>

      <AlertDialog open={showEnablePrompt} onOpenChange={setShowEnablePrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ScanFace className="h-5 w-5" /> Enable {bioLabel}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sign in faster next time using {bioLabel}. Your credentials are
              stored securely on this device only — never on our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleSkipBiometric}>Not now</AlertDialogCancel>
            <AlertDialogAction onClick={handleEnableBiometric}>
              Enable {bioLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EmployeeLogin;

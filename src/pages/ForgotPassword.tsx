import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Mail, Loader2, ArrowLeft, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const ForgotPassword = () => {
  const [step, setStep] = useState<"email" | "questions" | "newpassword">("email");
  const [email, setEmail] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState(["", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsLoading(true);

    const { data } = await supabase.functions.invoke("self-reset-password", {
      body: { mode: "get-questions", email: email.trim() },
    });

    // Always advance to the questions step regardless of whether the email
    // matches an account — this prevents account enumeration via the
    // forgot-password flow. Verification of the answers on the next step
    // returns a generic failure for both invalid emails and wrong answers.
    const qs = Array.isArray(data?.questions) && data.questions.length >= 3
      ? data.questions
      : [
          "Answer the security question set on your account (1 of 3)",
          "Answer the security question set on your account (2 of 3)",
          "Answer the security question set on your account (3 of 3)",
        ];
    setQuestions(qs);
    setAnswers(["", "", ""]);
    setStep("questions");
    setIsLoading(false);
  };

  const handleQuestionsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answers.some(a => !a.trim())) {
      toast({ title: "Please answer all questions", variant: "destructive" });
      return;
    }
    setStep("newpassword");
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({ title: "Password too short", description: "Must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase.functions.invoke("self-reset-password", {
      body: { email: email.trim(), answers, new_password: newPassword },
    });

    if (error || data?.error) {
      toast({ title: "Reset failed", description: data?.error || error?.message || "Please try again.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    toast({ title: "Password reset!", description: "You can now log in with your new password." });
    navigate("/employee-login");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <ShieldCheck className="w-12 h-12 text-accent mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Reset Your Password</h1>
          <p className="text-muted-foreground mt-2">
            {step === "email" && "Enter your email to get started"}
            {step === "questions" && "Answer your security questions"}
            {step === "newpassword" && "Set your new password"}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8">
          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" required />
                </div>
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Looking up...</> : "Continue"}
              </Button>
            </form>
          )}

          {step === "questions" && (
            <form onSubmit={handleQuestionsSubmit} className="space-y-5">
              {questions.map((q, i) => (
                <div key={i} className="space-y-2">
                  <Label className="text-sm">{q}</Label>
                  <Input
                    placeholder="Your answer"
                    value={answers[i]}
                    onChange={e => {
                      const a = [...answers];
                      a[i] = e.target.value;
                      setAnswers(a);
                    }}
                    required
                  />
                </div>
              ))}
              <Button type="submit" className="w-full" size="lg">Continue</Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("email")}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            </form>
          )}

          {step === "newpassword" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="new-pw">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="new-pw" type="password" placeholder="••••••••" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="pl-10" required minLength={8} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-pw">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="confirm-pw" type="password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="pl-10" required minLength={8} />
                </div>
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting...</> : "Reset Password"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("questions")}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            </form>
          )}
        </div>

        <div className="text-center mt-4">
          <Link to="/employee-login" className="text-sm text-muted-foreground hover:text-accent">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, Loader2, ShieldCheck } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "What is your favorite movie?",
  "What street did you grow up on?",
  "What was your childhood nickname?",
  "What is the name of your favorite childhood friend?",
  "What was the make of your first car?",
  "What is your favorite sports team?",
];

const ChangePassword = () => {
  const [step, setStep] = useState<"password" | "security">("password");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [questions, setQuestions] = useState([
    { question: "", answer: "" },
    { question: "", answer: "" },
    { question: "", answer: "" },
  ]);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, mustChangePassword, clearMustChangePassword } = useAuth();

  if (!user) return <Navigate to="/employee-login" replace />;
  if (!mustChangePassword) return <Navigate to="/employee-dashboard" replace />;

  const handlePasswordSubmit = async (e: React.FormEvent) => {
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

    await supabase.from("employees").update({ must_change_password: false }).eq("user_id", user.id);
    toast({ title: "Password updated!", description: "Now set up your security questions." });
    setIsLoading(false);
    setStep("security");
  };

  const getAvailableQuestions = (currentIndex: number) => {
    const selected = questions.map((q, i) => i !== currentIndex ? q.question : "").filter(Boolean);
    return SECURITY_QUESTIONS.filter(q => !selected.includes(q));
  };

  const handleSecuritySubmit = async () => {
    for (let i = 0; i < 3; i++) {
      if (!questions[i].question || !questions[i].answer.trim()) {
        toast({ title: "Incomplete", description: `Please complete question ${i + 1}.`, variant: "destructive" });
        return;
      }
    }
    const uniqueQs = new Set(questions.map(q => q.question));
    if (uniqueQs.size < 3) {
      toast({ title: "Duplicate questions", description: "Each question must be different.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    await supabase.from("security_questions").delete().eq("user_id", user.id);
    const { error } = await supabase.from("security_questions").insert(
      questions.map((q, i) => ({
        user_id: user.id,
        question_number: i + 1,
        question: q.question,
        answer: q.answer.trim(),
      }))
    );

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "All set!", description: "Your account is ready. Please log in with your new password." });
      clearMustChangePassword();
      await supabase.auth.signOut();
      navigate("/employee-login");
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {step === "password" ? (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-foreground">Set Your Password</h1>
              <p className="text-muted-foreground mt-2">Step 1 of 2 — Create a new password</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-8">
              <form onSubmit={handlePasswordSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" required minLength={8} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="confirm" type="password" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="pl-10" required minLength={8} />
                  </div>
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</> : "Set Password & Continue"}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <>
            <div className="text-center mb-8">
              <ShieldCheck className="w-10 h-10 text-accent mx-auto mb-3" />
              <h1 className="text-2xl font-bold text-foreground">Security Questions</h1>
              <p className="text-muted-foreground mt-2">Step 2 of 2 — Set up 3 questions for password recovery</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-8 space-y-5">
              {questions.map((q, i) => (
                <div key={i} className="space-y-2">
                  <Label className="text-sm font-medium">Question {i + 1}</Label>
                  <Select value={q.question} onValueChange={v => {
                    const updated = [...questions];
                    updated[i] = { ...updated[i], question: v };
                    setQuestions(updated);
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select a question..." /></SelectTrigger>
                    <SelectContent>
                      {getAvailableQuestions(i).map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Your answer"
                    value={q.answer}
                    onChange={e => {
                      const updated = [...questions];
                      updated[i] = { ...updated[i], answer: e.target.value };
                      setQuestions(updated);
                    }}
                  />
                </div>
              ))}
              <Button onClick={handleSecuritySubmit} className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Complete Setup"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ChangePassword;

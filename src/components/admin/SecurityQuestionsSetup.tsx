import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Loader2 } from "lucide-react";

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

const SecurityQuestionsSetup = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasQuestions, setHasQuestions] = useState(false);
  const [questions, setQuestions] = useState<{ question: string; answer: string }[]>([
    { question: "", answer: "" },
    { question: "", answer: "" },
    { question: "", answer: "" },
  ]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("security_questions")
        .select("*")
        .eq("user_id", user.id)
        .order("question_number");
      
      if (data && data.length === 3) {
        setHasQuestions(true);
        setQuestions(data.map((q: any) => ({ question: q.question, answer: q.answer })));
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const getAvailableQuestions = (currentIndex: number) => {
    const selected = questions.map((q, i) => i !== currentIndex ? q.question : "").filter(Boolean);
    return SECURITY_QUESTIONS.filter(q => !selected.includes(q));
  };

  const handleSave = async () => {
    if (!user) return;
    
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

    setSaving(true);

    // Delete existing then insert
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
      setHasQuestions(true);
      toast({ title: "Saved!", description: "Security questions updated." });
    }
    setSaving(false);
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="w-6 h-6 text-accent" />
        <div>
          <h2 className="text-xl font-bold text-foreground">Security Questions</h2>
          <p className="text-sm text-muted-foreground">
            {hasQuestions ? "Update your security questions for password recovery." : "Set up 3 security questions so you can reset your password."}
          </p>
        </div>
      </div>

      <div className="space-y-6 max-w-lg">
        {questions.map((q, i) => (
          <div key={i} className="space-y-2 bg-card border border-border rounded-xl p-4">
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

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : hasQuestions ? "Update Security Questions" : "Save Security Questions"}
        </Button>
      </div>
    </div>
  );
};

export default SecurityQuestionsSetup;

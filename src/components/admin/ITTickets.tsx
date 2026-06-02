import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2 } from "lucide-react";

type Ticket = {
  id: string;
  user_id: string;
  submitter_email: string;
  submitter_name: string | null;
  title: string;
  description: string;
  priority: string;
  status: string;
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-500/15 text-blue-500",
  high: "bg-orange-500/15 text-orange-500",
  urgent: "bg-red-500/15 text-red-500",
};

const statusColors: Record<string, string> = {
  open: "bg-yellow-500/15 text-yellow-500",
  in_progress: "bg-blue-500/15 text-blue-500",
  resolved: "bg-green-500/15 text-green-500",
  closed: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

export default function ITTickets() {
  const { user, effectiveRole } = useAuth();
  const { toast } = useToast();
  const isAdmin = effectiveRole === "admin" || effectiveRole === "owner";
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium" });
  const [filter, setFilter] = useState<"all" | "mine">(isAdmin ? "all" : "mine");
  const [funOpen, setFunOpen] = useState(false);
  const [funStep, setFunStep] = useState<string>("start");
  const [funTrail, setFunTrail] = useState(0);
  const [rudeJoke, setRudeJoke] = useState("");

  const [shuffledSuggestions, setShuffledSuggestions] = useState<string[]>([]);
  const [shuffledQuestions, setShuffledQuestions] = useState<string[]>([]);
  const [shuffledComplaining, setShuffledComplaining] = useState<string[]>([]);
  const [shuffledRealIssue, setShuffledRealIssue] = useState<string[]>([]);

  const suggestionResponses = [
    "Oh, a suggestion? Bold of you to assume we take those. 😏",
    "Hmm... is this the kind of suggestion that creates more work for IT?",
    "Fine. But if this is 'we should get standing desks shaped like motorcycles' again...",
    "Okay okay, the suspense is killing me. Spill it. 🎤",
    "A suggestion! Quick, someone write this down in the Book of Ideas We Ignored. 📕",
    "Let me guess — 'free lunch on Fridays'? Classic. 🍕",
    "Before you say it... no, we are not switching to Linux. 🐧",
    "Ooh, a suggestion. Is it about the printer? It's always about the printer. 🖨️",
    "We literally have a suggestion box. It's called /dev/null. 📦",
    "I hope this suggestion involves less work for me personally. 🤞",
    "Oh good, another idea from the 'Why Hasn't Anyone Thought of This Before' department. 🏢",
    "Is this suggestion approved by the Committee of Things That Will Never Happen? ✅",
    "Your suggestion has been noted and filed under 'S' for 'Sure, Jan.' 📁",
    "We love suggestions! We also love ignoring them. It's a balanced diet. 🥗",
    "If this suggestion is about nap pods, I'm way ahead of you. 😴",
    "Ooh! Is it about changing the company font to Comic Sans? Please say yes. 🎨",
    "Suggestions are like opinions. Everyone has one, and most are about the AC. 🥶",
    "Are you about to pitch a startup idea? Because I will pretend to listen. 🦄",
    "Did you know we have a process for suggestions? Step 1: You suggest. Step 2: We forget. It's very efficient. ⚡",
    "Suggestion received! Our team of highly trained pigeons will review it shortly. 🐦",
  ];
  const questionResponses = [
    "A question? Have you tried turning it off and on again first? 🔌",
    "Are you SURE Google can't answer this? Like, really sure?",
    "Okay, but if this is 'what's the wifi password' I will riot. 📶",
    "Alright, hit me with it. I'm bracing myself. 🧠",
    "Questions are just answers that haven't given up yet. Or whatever. 🤷",
    "Is this a 'how do I do my job' question or a real tech thing? 👀",
    "Go ahead. My PhD in Figuring Out Basic Stuff is ready. 🎓",
    "Did you try asking the Magic 8-Ball first? It's cheaper than IT. 🎱",
    "A question! My favorite. Unless it's about the copier. Then it's my least favorite. 📠",
    "Fire away. But if it's about resetting a password, I'm billing you. 💸",
    "Questions are like viruses. One leads to ten more. Please vaccinate me. 💉",
    "I have 99 problems and 98 of them are questions about Outlook. 📧",
    "Go on... but know that I can see your search history. Not really, but imagine the fear. 👻",
    "Is this about the weird noise your computer makes? It's called 'fans.' 🌬️",
    "Did you try blowing on it like an old Nintendo cartridge? 🎮",
    "Questions welcome! Answers... those cost extra. 💰",
    "Ah yes, the daily 'Is the server down?' ritual. No, Dave. It's just you. 🙃",
    "I hope this question comes with screenshots. I LOVE screenshots. 📸",
    "Ask away. I've already emotionally prepared myself for 'I deleted the internet.' 🌐",
    "If this is 'how do I rotate a PDF?' I'm going to need a minute. 📄",
    "Have you tried sacrificing a USB drive to the tech gods? Works 60% of the time. 🔮",
    "Is your Caps Lock on? Because your email reads like you're yelling at me. 📢",
    "Before I answer, what's your favorite color? Just kidding, that won't help either. 🌈",
    "I'm going to need you to submit this in triplicate. One for each of my personalities. 👥",
    "Is this question covered under warranty? Because my patience isn't. 📝",
    "Have you considered the problem might be between the keyboard and chair? 🪑",
    "My crystal ball says... 'Have you tried updating Chrome?' Balls are basically IT now. 🔮",
    "Did you know IT stands for 'I Tried'? Because that's what I'm about to do. 😅",
    "If I had a dollar for every time someone asked this, I'd fix the printer myself. 🖨️",
    "Is this about the email chain you accidentally replied-all to? We've all been there. 📬",
    "Have you tried whispering sweet nothings to your hard drive? They need love too. 💕",
    "I'm consulting the ancient scrolls... ah yes, 'Did you restart it?' Always restart. 📜",
    "Is your computer running? Then you better go catch it! ...Sorry, I had to. 🏃",
    "Before we begin, rate your panic: 1 to 'I deleted everything.' Be honest. 😰",
    "Are you calling from the bathroom again? We know the wifi is strongest there. 🚻",
    "Have you tried the classic unplug-plug-back-in dance? Very technical stuff. 💃",
    "My sources say the answer involves a sacrifice of one caramel macchiato. ☕",
    "Is this the same issue from yesterday? Because I left my time machine at home. ⏰",
    "Did you try Googling 'Google isn't working'? It's a real thing people do. 🔍",
    "I was about to take lunch, but sure, your PDF crisis is clearly more urgent. 🍔",
    "Have you checked if Mercury is in retrograde? Explains 90% of tech issues. 🪐",
    "Is this a 'the mouse is on the wrong side of the keyboard' situation? We've seen it. 🖱️",
    "My flowchart says: 1) Panic 2) Call IT 3) Realize it's unplugged. You're at step 2. 📊",
    "Are you sure you want the answer? Because once you know, you can't unknow it. 🧠",
    "Did you try threatening your computer? Sometimes fear is the best motivator. 😤",
    "Is this about the pop-up saying you won a free iPad? Spoiler: you didn't. 🍎",
    "I'm going to transfer you to advanced support... just kidding, that's also me. 🤡",
    "Have you tried the 'anger shake'? Like the salt shaker but for electronics. 🧂",
    "My diagnostic tool says you're experiencing what we call 'PEBKAC.' Look it up. 🛠️",
    "Is this urgent? Because my coffee is getting cold and that's pretty urgent too. ☕",
    "Did you try asking your teenager? They know more about tech than all of us combined. 🧑‍🎤",
  ];

  const rudeSuggestionJokes = [
    "You wouldn't ask Picasso to skip the painting and just take a picture. But fine, since you want to be rude, here you go. 🎨",
    "Michelangelo didn't rush the Sistine Chapel, but sure, let's rush your suggestion. 🏃",
    "Mozart spent years composing, but you want your idea processed in 30 seconds? Okay. 🎵",
    "Shakespeare didn't skip the soliloquies, but since you're in a hurry... 🎭",
    "Einstein took a decade on relativity, but your suggestion obviously deserves warp speed. 🚀",
    "Da Vinci didn't say 'just give me the Mona Lisa NOW,' but different strokes. 🖌️",
    "Beethoven didn't rush the symphonies. But your suggestion? Instant gratification it is. 🎼",
    "Hemingway would have rewritten this 47 times, but you want it submitted in one click. 📖",
    "Marie Curie didn't discover radium in a day, but your suggestion goes straight to the pile. ☢️",
    "The Wright Brothers crashed a few times first, but sure, your idea is definitely flawless. ✈️",
    "Tesla didn't invent AC in 5 minutes, but your suggestion will get exactly that much attention. ⚡",
    "Van Gogh painted 900+ works, but you want us to hear one idea and change everything? Okay. 🌻",
    "Edison failed 1000 times before the lightbulb. You can't handle 3 joke screens? 💡",
    "Julia Child didn't microwave a gourmet meal, but sure, let's fast-forward your feedback. 🍳",
    "Neil Armstrong trained for years. You trained for zero seconds. Bold. 🌑",
    "J.K. Rowling rewrote Chapter One 15 times. You won't even sit through 3 screens. 🧙",
    "Charles Darwin observed finches for 5 years. You observed... this app for 30 seconds. 🐦",
    "Beyoncé rehearses for months. You want your suggestion heard without any warm-up. 🎤",
    "Leonardo built a helicopter sketch in 1480, but you can't wait 30 seconds? 🚁",
    "Maya Angelou didn't write 'I Know Why' on a napkin, but your suggestion deserves less, apparently. ✍️",
    "Steve Jobs took 3 years for the first iPhone. You took 3 seconds to skip our fun. 📱",
    "Gordon Ramsay wouldn't serve a raw suggestion, but you want it served cold and fast. 🍽️",
    "Frida Kahlo painted her pain. You won't even sit through a mild inconvenience. 🖼️",
    "Roger Federer hits 10,000 practice serves. You hit 'skip' once and called it a day. 🎾",
    "Jane Austen wrote by candlelight. You write by rage-click. Impressive. 🕯️",
  ];
  const rudeQuestionJokes = [
    "You wouldn't ask Einstein to skip the theory and just give you the answer. But since you're rude, fine. 🧠",
    "Socrates asked questions for a living. You skipped mine in 5 seconds. Who's the philosopher now? 🤔",
    "Sherlock Holmes investigates before concluding. You investigate... nothing. Impressive detective work. 🕵️",
    "Aristotle didn't jump to conclusions. He had, like, 12 categories first. You have impatience. 🏛️",
    "Yoda trained Luke for 800 years. You lasted 2 joke screens. Strong with the force, you are not. 👽",
    "Confucius say: 'Man who skip questions will get answer he deserves.' And here it is. 📜",
    "Columbus took 2 months to find land. You found the 'skip' button in 2 seconds. Explorer of shortcuts. ⛵",
    "Marie Curie asked questions that changed science. You ask questions you refuse to earn. 🔬",
    "Alan Turing cracked Enigma. You cracked... our patience. Congrats. 🧩",
    "Neil deGrasse Tyson would explain the cosmos first. You want the TL;DR of the universe. 🌌",
    "Isaac Newton asked why the apple fell. You ask why you have to read. Big thinker. 🍎",
    "Sigmund Freud would analyze your need to skip. But that would take too long for you, wouldn't it? 🛋️",
    "Carl Sagan said billions and billions. You said 'just let me ask.' The cosmos weeps. 🌠",
    "Galileo spent years defending his findings. You spent 5 seconds avoiding ours. Revolutionary. 🔭",
    "Mark Twain said 'Never put off till tomorrow.' You put off jokes till never. Witty. 📚",
    "Nikola Tesla envisioned wireless power. You envisioned skipping our jokes. Visionary. 📡",
    "Watson and Crick took years for DNA. You took 0 years for our humor. Fair trade. 🧬",
    "Marco Polo explored for 24 years. You explored the 'Continue' button once. Traveler. 🗺️",
    "Alexander Graham Bell invented communication. You skip it entirely. Progress. ☎️",
    "Dr. Seuss rhymed for pages. You rage-quit in paragraphs. Rhyme-worthy. 🎩",
    "Plato had dialogs. You had 'nope.' Philosophically deep. 🏺",
    "Buzz Aldrin walked on the moon. You walked on our good time. One small step for man... 🌕",
    "Louis Pasteur didn't just guess germ theory. You just guessed the skip button. Scientist. 🦠",
    "Martin Luther King had a dream. You have a shortcut. Which is basically the same thing, right? ✊",
    "Thomas Jefferson drafted carefully. You draft... a ticket with zero patience. Founding father of skipping. 📜",
  ];
  const rudeReportJokes = [
    "You wouldn't ask a surgeon to skip the diagnosis and just cut. But since you're rude, the scalpel is yours. 🔪",
    "Firefighters assess before they spray. You assess... nothing. Hope that works out. 🚒",
    "Paramedics check vitals first. You skip straight to the ER. Bold strategy. 🚑",
    "A pilot does a pre-flight check. You do a pre-complaint skip. Smooth landing incoming. ✈️",
    "Mechanics diagnose before they fix. You diagnose 'broken' and hand it over. Good luck. 🔧",
    "Building inspectors look at the foundation. You look at your watch. Solid foundation. 🏗️",
    "Dentists X-ray before drilling. You want us to drill blind. Open wide. 🦷",
    "Electricians test circuits before touching. You test our patience. Shockingly effective. ⚡",
    "Coaches watch game tape. You watch the clock. Championship mentality. 🏆",
    "Scientists gather data first. You gather... grievances. Nobel Prize material. 🥼",
    "Architects draw blueprints. You draw conclusions. But hey, buildings collapse, so will this report. 🏢",
    "Programmers read logs before debugging. You read nothing. Let the chaos begin. 💻",
    "Veterinarians examine pets first. You examine your own patience limit. Already failed. 🐕",
    "Pilots file flight plans. You file complaints. Different kind of turbulence ahead. 🛫",
    "Teachers check homework first. You checked out. Straight to the principal's office with this one. 🍎",
    "Journalists verify sources. You verify... that you don't care. Pulitzer incoming. 📰",
    "Plumbers snake the drain before replacing the pipe. You snake past our questions. Drain away. 🪠",
    "Therapists listen before diagnosing. You don't listen. Self-diagnosis: chronic impatience. 🛋️",
    "Chefs taste before seasoning. You taste defeat. But here, season your report yourself. 👨‍🍳",
    "Farmers check the soil before planting. You check your temper. Seed of chaos planted. 🌱",
    "Botanists classify before naming. You classify as 'skipper.' Latin name: Impatienta reportus. 🌿",
    "Librarians catalog before shelving. You shelve everything. The book of your issue is lost. 📚",
    "Meteorologists model storms. You model... storming past our jokes. Category 5 rudeness. 🌪️",
    "Blacksmiths heat before hammering. You heat up over jokes. Time to hammer out this ticket. 🔨",
    "Park rangers observe wildlife. You observe the exit. Rare species: the unbothered reporter. 🐻",
  ];

  const shuffle = (arr: string[]) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const openFun = () => {
    setShuffledSuggestions(shuffle(suggestionResponses));
    const qCount = Math.floor(Math.random() * 2) + 2; // 2 or 3
    setShuffledQuestions(shuffle(questionResponses).slice(0, qCount));
    setFunStep("start");
    setFunTrail(0);
    setFunOpen(true);
  };

  const goToForm = () => {
    setFunOpen(false);
    setOpen(true);
  };

  const skipToForm = (jokes: string[]) => {
    const pick = jokes[Math.floor(Math.random() * jokes.length)];
    setRudeJoke(pick);
    setFunStep("rude");
  };

  const nextTrail = (max: number, finalStep: string) => {
    if (funTrail + 1 >= max) {
      setFunStep(finalStep);
    } else {
      setFunTrail(funTrail + 1);
    }
  };

  const load = async () => {
    setLoading(true);
    let query = supabase.from("it_tickets").select("*").order("created_at", { ascending: false });
    if (filter === "mine" && user) query = query.eq("user_id", user.id);
    const { data, error } = await query;
    if (error) toast({ title: "Failed to load tickets", description: error.message, variant: "destructive" });
    else setTickets((data || []) as Ticket[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [filter]);

  const handleSubmit = async () => {
    if (!user || !form.title.trim() || !form.description.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("it_tickets").insert({
      user_id: user.id,
      submitter_email: user.email ?? "",
      submitter_name: (user.user_metadata?.full_name as string) ?? null,
      title: form.title.trim(),
      description: form.description.trim(),
      priority: form.priority,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Could not submit", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Ticket submitted", description: "IT has been notified." });
    setForm({ title: "", description: "", priority: "medium" });
    setOpen(false);
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    const updates: any = { status };
    if (status === "resolved" || status === "closed") updates.resolved_at = new Date().toISOString();
    const { error } = await supabase.from("it_tickets").update(updates).eq("id", id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    else load();
  };

  const saveNotes = async (id: string, notes: string) => {
    const { error } = await supabase.from("it_tickets").update({ admin_notes: notes }).eq("id", id);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Notes saved" });
  };

  const deleteTicket = async (id: string) => {
    if (!confirm("Delete this ticket?")) return;
    const { error } = await supabase.from("it_tickets").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">IT Tickets</h1>
          <p className="text-sm text-muted-foreground">Report a problem or request IT help.</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tickets</SelectItem>
                <SelectItem value="mine">My Tickets</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button onClick={openFun}><Plus className="w-4 h-4 mr-2" /> New Ticket</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Submit IT Ticket</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Brief summary" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the issue or request in detail" />
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={submitting || !form.title.trim() || !form.description.trim()}>
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Submit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={funOpen} onOpenChange={setFunOpen}>
            <DialogContent>
              {funStep === "start" && (
                <>
                  <DialogHeader><DialogTitle>Before we begin... what brings you here? 👀</DialogTitle></DialogHeader>
                  <div className="grid gap-2 py-2">
                    <Button variant="outline" onClick={() => setFunStep("reporting")}>🐛 Issue Reporting</Button>
                    <Button variant="outline" onClick={() => { setFunTrail(0); setFunStep("suggestion"); }}>💡 Suggestion</Button>
                    <Button variant="outline" onClick={() => { setFunTrail(0); setFunStep("question"); }}>❓ Question</Button>
                  </div>
                </>
              )}

              {funStep === "reporting" && (
                <>
                  <DialogHeader><DialogTitle>Hold up. 🤨</DialogTitle></DialogHeader>
                  <p className="text-sm text-muted-foreground py-2">Is this really an issue... or are you just complaining?</p>
                  <div className="grid gap-2">
                    <Button variant="outline" onClick={() => setFunStep("complaining")}>😤 Just complaining</Button>
                    <Button variant="outline" onClick={() => setFunStep("realIssue")}>🔥 It's a REAL issue</Button>
                    <Button variant="ghost" onClick={() => skipToForm(rudeReportJokes)}>😠 Just let me report</Button>
                  </div>
                </>
              )}

              {funStep === "complaining" && (
                <>
                  <DialogHeader><DialogTitle>A word from Teddy 🇺🇸</DialogTitle></DialogHeader>
                  <blockquote className="border-l-4 border-primary pl-4 py-2 italic text-sm">
                    "Complaining about a problem without posing a solution is called whining."
                    <footer className="text-xs text-muted-foreground mt-2">— Theodore Roosevelt</footer>
                  </blockquote>
                  <div className="grid gap-2 pt-2">
                    <Button variant="outline" onClick={() => setFunStep("start")}>Take me back 🙃</Button>
                    <Button onClick={() => skipToForm(rudeReportJokes)}>😠 Just let me report</Button>
                  </div>
                </>
              )}

              {funStep === "realIssue" && (
                <>
                  <DialogHeader><DialogTitle>Deep question time 🧘</DialogTitle></DialogHeader>
                  <p className="text-sm text-muted-foreground py-2">
                    But like... how do you know <em>anything</em> is real? Are we even here right now? 🌀
                  </p>
                  <div className="grid gap-2">
                    <Button variant="outline" onClick={() => setFunStep("start")}>I need a moment 🤯</Button>
                    <Button onClick={() => skipToForm(rudeReportJokes)}>😠 Just let me report</Button>
                  </div>
                </>
              )}

              {funStep === "suggestion" && (
                <>
                  <DialogHeader><DialogTitle>Suggestion incoming 💡</DialogTitle></DialogHeader>
                  <p className="text-sm py-2">{shuffledSuggestions[funTrail]}</p>
                  <div className="grid gap-2">
                    {funTrail + 1 < Math.min(3, shuffledSuggestions.length) ? (
                      <>
                        <Button variant="outline" onClick={() => setFunTrail(funTrail + 1)}>Continue...</Button>
                        <Button variant="ghost" onClick={() => skipToForm(rudeSuggestionJokes)}>😠 Just let me suggest</Button>
                      </>
                    ) : (
                      <Button onClick={goToForm}>Okay, here it goes ✨</Button>
                    )}
                  </div>
                </>
              )}

              {funStep === "question" && (
                <>
                  <DialogHeader><DialogTitle>You have a question? 🤔</DialogTitle></DialogHeader>
                  <p className="text-sm py-2">{shuffledQuestions[funTrail]}</p>
                  <div className="grid gap-2">
                    {funTrail + 1 < shuffledQuestions.length ? (
                      <>
                        <Button variant="outline" onClick={() => setFunTrail(funTrail + 1)}>Continue...</Button>
                        <Button variant="ghost" onClick={() => skipToForm(rudeQuestionJokes)}>😠 Just let me ask</Button>
                      </>
                    ) : (
                      <Button onClick={goToForm}>Fine, ask away 🎤</Button>
                    )}
                  </div>
                </>
              )}

              {funStep === "rude" && (
                <>
                  <DialogHeader><DialogTitle>Well, aren't we impatient? 😒</DialogTitle></DialogHeader>
                  <p className="text-sm py-3 italic">{rudeJoke}</p>
                  <div className="grid gap-2">
                    <Button onClick={goToForm}>Fine, here's your form 📝</Button>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>


      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : tickets.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No tickets yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{t.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t.submitter_name || t.submitter_email} · {new Date(t.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={priorityColors[t.priority]}>{t.priority}</Badge>
                    <Badge className={statusColors[t.status]}>{statusLabels[t.status] || t.status}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm whitespace-pre-wrap">{t.description}</p>
                {isAdmin && (
                  <div className="space-y-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Label className="text-xs">Status:</Label>
                      <Select value={t.status} onValueChange={(v) => updateStatus(t.id, v)}>
                        <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" onClick={() => deleteTicket(t.id)} className="ml-auto text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs">Admin notes</Label>
                      <Textarea
                        rows={2}
                        defaultValue={t.admin_notes || ""}
                        onBlur={(e) => {
                          if ((e.target.value || "") !== (t.admin_notes || "")) saveNotes(t.id, e.target.value);
                        }}
                        placeholder="Internal notes (saved on blur)"
                      />
                    </div>
                  </div>
                )}
                {!isAdmin && t.admin_notes && (
                  <div className="pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-1">IT response:</p>
                    <p className="text-sm whitespace-pre-wrap">{t.admin_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

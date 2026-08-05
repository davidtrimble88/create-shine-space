import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowRight, GraduationCap, Gauge, Zap, BookOpen, Clock, Users, Award, Shield, AlertTriangle } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Seo from "@/components/Seo";
import IdRequirementNote from "@/components/IdRequirementNote";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";


const courses = [
  {
    id: "basic",
    icon: GraduationCap,
    title: "Motorcyclist Training Course",
    subtitle: "CMSP Motorcyclist Training Course",
    price: "From $395",
    duration: "2 Days (Weekend)",
    description:
      "Perfect for beginners with no riding experience. Learn to ride, get your CMSP DL389 Certificate, and waive the DMV riding skills test. Motorcycle and helmet provided.",
    highlights: ["No experience needed", "Bike & helmet provided", "DMV test waiver"],
    color: "from-accent/20 to-accent/5",
    borderColor: "border-accent/30",
  },
  {
    id: "premier",
    icon: BookOpen,
    title: "1-Day Premier Course",
    subtitle: "For experienced riders · Licensing for 21+",
    price: "From $300",
    duration: "1 Day (8 Hours)",
    description:
      "Designed for experienced but unlicensed riders. Offers licensing options for riders 21 and older. Includes entry skills test, classroom and riding instruction. Loaner bikes available.",
    highlights: ["For experienced riders", "Licensing for 21+", "Military recognized"],
    color: "from-secondary to-secondary/50",
    borderColor: "border-border",
  },
  {
    id: "intermediate",
    icon: Gauge,
    title: "Intermediate Course",
    subtitle: "IRC / CMSP Intermediate",
    price: "From $300",
    duration: "1 Day (8 Hours)",
    description:
      "Level up your skills with advanced throttle control, emergency braking, cornering, and evasive maneuvers. For licensed riders looking to improve.",
    highlights: ["For licensed riders", "Returning student discount", "Military recognized"],
    color: "from-secondary to-secondary/50",
    borderColor: "border-border",
  },
  {
    id: "advanced",
    icon: Zap,
    title: "Advanced Riding Clinic",
    subtitle: "Total Control ARC®",
    price: "Contact for Pricing",
    duration: "1 Day",
    description:
      "Master advanced cornering, traction management, body position, and suspension setup. Based on Lee Parks' best-selling book. Bring your own bike.",
    highlights: ["Professional coaching", "All bike types welcome", "Controlled environment"],
    color: "from-secondary to-secondary/50",
    borderColor: "border-border",
  },
];

const CardShell = ({
  intercept,
  to,
  onIntercept,
  children,
}: {
  intercept: boolean;
  to: string;
  onIntercept: () => void;
  children: React.ReactNode;
}) =>
  intercept ? (
    <button type="button" onClick={onIntercept} className="block h-full w-full text-left">
      {children}
    </button>
  ) : (
    <Link to={to} className="block h-full">
      {children}
    </Link>
  );

const ChooseCoursePage = () => {
  const navigate = useNavigate();
  const [m1Open, setM1Open] = useState(false);
  const [m1Step, setM1Step] = useState<"ask" | "premier">("ask");
  const [m1Ack, setM1Ack] = useState(false);
  const [premierTarget, setPremierTarget] = useState("/choose-location?course=intermediate&track=1dpc");
  const [premierDirect, setPremierDirect] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Seo title={"Book a Motorcycle Course — Learn to Ride VC"} description={"Choose your motorcycle training course and start registration. Beginner, premier, intermediate, and advanced options available."} path="/choose-course" />
      <Navbar />

      <section className="pt-32 pb-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent" />
        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span className="inline-block bg-accent/20 text-accent font-bold px-4 py-2 rounded-full text-sm mb-6 border border-accent/30">
              Step 1 of 4
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Choose Your <span className="text-accent">Course</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Select the course that matches your experience level to get started.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {courses.map((course, i) => {
              const Icon = course.icon;
              const isIntermediate = course.id === "intermediate";
              const isPremier = course.id === "premier";
              return (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <CardShell
                    intercept={isIntermediate || isPremier}
                    to={`/choose-location?course=${course.id}`}
                    onIntercept={() => {
                      setM1Ack(false);
                      setPremierDirect(isPremier);
                      if (isPremier) {
                        setPremierTarget("/choose-location?course=intermediate&track=1dpc");
                        setM1Step("premier");
                      } else {
                        setPremierTarget("/choose-location?course=intermediate&track=1dpc");
                        setM1Step("ask");
                      }
                      setM1Open(true);
                    }}
                  >
                    <div
                      className={`relative h-full bg-gradient-to-b ${course.color} border ${course.borderColor} rounded-2xl p-8 hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10 transition-all duration-300 group cursor-pointer flex flex-col`}
                    >
                      {i === 0 && (
                        <span className="absolute top-4 right-4 bg-accent text-accent-foreground text-xs font-bold px-3 py-1 rounded-full">
                          Most Popular
                        </span>
                      )}

                      <div className="w-14 h-14 rounded-2xl bg-accent/15 flex items-center justify-center mb-5 group-hover:bg-accent/25 transition-colors">
                        <Icon className="w-7 h-7 text-accent" />
                      </div>

                      <h2 className="text-xl font-bold text-foreground mb-1">{course.title}</h2>
                      <p className="text-sm text-muted-foreground mb-4">{course.subtitle}</p>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-accent" />
                          {course.duration}
                        </span>
                      </div>

                      <p className="text-sm text-foreground/80 leading-relaxed mb-6">
                        {course.description}
                      </p>

                      <ul className="space-y-2 mb-8 flex-grow">
                        {course.highlights.map((h, j) => (
                          <li key={j} className="flex items-center gap-2 text-sm text-foreground/85">
                            <Award className="w-4 h-4 text-accent flex-shrink-0" />
                            {h}
                          </li>
                        ))}
                      </ul>

                      <div className="mt-auto flex items-center justify-between">
                        <span className="text-lg font-bold text-accent">{course.price}</span>
                        <span className="flex items-center gap-1 text-sm text-accent font-medium group-hover:translate-x-1 transition-transform">
                          Book Now <ArrowRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </CardShell>
                </motion.div>
              );
            })}
          </div>

          <div className="max-w-6xl mx-auto mt-8">
            <IdRequirementNote />
          </div>


          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center text-sm text-muted-foreground mt-10"
          >
            Not sure which course is right for you?{" "}
            <a href="tel:+18058270075" className="text-accent hover:underline font-medium">Ventura: (805) 827-0075</a>
            {" | "}
            <a href="tel:+17609876652" className="text-accent hover:underline font-medium">High Desert: (760) 987-6652</a>
          </motion.p>
        </div>
      </section>

      <Dialog open={m1Open} onOpenChange={setM1Open}>
        <DialogContent className="max-w-2xl">
          {m1Step === "ask" ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">Do you have your M1?</DialogTitle>
                <DialogDescription>
                  The Intermediate Course (IRC) is for riders who already hold a California M1
                  motorcycle license. Your answer determines which course you'll be registered for.
                </DialogDescription>
              </DialogHeader>
              <div className="grid sm:grid-cols-2 gap-4 py-2">
                <Button
                  variant="hero"
                  size="lg"
                  className="h-auto py-4 px-4 flex-col items-start gap-1 text-left whitespace-normal"
                  onClick={() => navigate("/choose-location?course=intermediate&track=irc")}
                >
                  <span className="text-base font-bold whitespace-normal break-words">Yes — I have my M1</span>
                  <span className="text-xs font-normal opacity-80 whitespace-normal break-words leading-snug">
                    Continue as Intermediate (IRC). You'll provide your motorcycle information during registration.
                  </span>
                </Button>
                <Button
                  variant="heroOutline"
                  size="lg"
                  className="h-auto py-4 px-4 flex-col items-start gap-1 text-left whitespace-normal"
                  onClick={() => { setM1Ack(false); setM1Step("premier"); }}
                >
                  <span className="text-base font-bold whitespace-normal break-words">No — I don't have my M1</span>
                  <span className="text-xs font-normal opacity-80 whitespace-normal break-words leading-snug">
                    You'll be registered under the 1-Day Premier Course with Licensing.
                  </span>
                </Button>
              </div>

            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-accent" />
                  {premierDirect
                    ? "Entry Skills Test — Required"
                    : "You'll be registered under the 1-Day Premier Course"}
                </DialogTitle>
                <DialogDescription>
                  {premierDirect ? (
                    <>
                      The <span className="text-foreground font-semibold">1-Day Premier Course with Licensing</span>{" "}
                      requires an entry skills test. Please watch the video below and confirm you can pass
                      the entrance exam before continuing.
                    </>
                  ) : (
                    <>
                      Because you don't have your M1 yet, you'll be enrolled in the{" "}
                      <span className="text-foreground font-semibold">1-Day Premier Course with Licensing</span>.
                      This course requires an entry skills test. Please watch the video below and confirm
                      you can pass the entrance exam before continuing.
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="aspect-video w-full rounded-xl overflow-hidden border border-border bg-black">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/sTPMKDZ8Uw0"
                  title="1-Day Premier Course entrance skills test"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <label className="flex items-start gap-3 text-sm text-foreground/90 cursor-pointer">
                <Checkbox checked={m1Ack} onCheckedChange={(v) => setM1Ack(v === true)} className="mt-0.5" />
                <span>
                  I have watched the video and I am confident I can pass the entrance skills test.
                </span>
              </label>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  variant="ghost"
                  onClick={() =>
                    premierDirect ? setM1Open(false) : setM1Step("ask")
                  }
                >
                  {premierDirect ? "Cancel" : "Back"}
                </Button>
                <Button variant="hero" disabled={!m1Ack} onClick={() => navigate(premierTarget)}>
                  Continue to 1-Day Premier <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default ChooseCoursePage;

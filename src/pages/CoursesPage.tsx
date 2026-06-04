import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EditableText from "@/components/EditableText";
import {
  Check, ArrowRight, Clock, Users, Award, Shield, BookOpen,
  Gauge, Eye, Route, AlertTriangle, Bike, ChevronDown, Star,
  Target, Zap, Brain, FileCheck, BadgeCheck, GraduationCap, Phone
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";

import cmspLogo from "@/assets/cmsp-logo.jpg";
import basicRiders from "@/assets/basic-riders.jpg";
import premierCourse from "@/assets/premier-course.jpg";
import basicTraining from "@/assets/basic-training.jpg";
import intermediateRider from "@/assets/intermediate-rider.jpg";
import intermediateCornering from "@/assets/intermediate-cornering.jpg";
import throttleControl from "@/assets/throttle-control.jpg";
import totalControlLogo from "@/assets/total-control-logo.jpg";
import totalControlBook from "@/assets/total-control-book.jpg";

const tabs = [
  { id: "basic", label: "MTC", icon: GraduationCap, subtitle: "Learn to Ride" },
  { id: "premier", label: "1-Day Premier", icon: BookOpen, subtitle: "Get Licensed" },
  { id: "intermediate", label: "Intermediate", icon: Gauge, subtitle: "Level Up" },
  { id: "advanced", label: "Advanced", icon: Zap, subtitle: "Total Control ARC®" },
] as const;

type TabId = typeof tabs[number]["id"];

const intermediateSkills = [
  { icon: Gauge, title: "Throttle Control", desc: "Master the single most important control — affecting traction, suspension, weight transfer, and stability." },
  { icon: Shield, title: "Brake Control", desc: "Learn and practice emergency braking techniques to achieve short, safe stops when hazards appear." },
  { icon: Eye, title: "Vision", desc: "The most fundamental riding skill — learn to use your eyes for advantage and safety on every ride." },
  { icon: Route, title: "Line Selection", desc: "Plan and follow proper cornering lines for safe, smooth progression through every bend." },
  { icon: Bike, title: "Low Speed Turns", desc: "Conquer tight, low-speed turns with confidence and control in limited spaces." },
  { icon: AlertTriangle, title: "Evasive Maneuvers", desc: "Practice life-saving swerving techniques without exceeding your tire's traction limits." },
];

const advancedSkills = [
  { icon: Target, title: "Traction Management", desc: "Understand how cornering forces, tire design, and bike weight affect your grip on the road." },
  { icon: Gauge, title: "Throttle Mastery", desc: "Refine throttle application to influence traction, suspension, steering, and ground clearance." },
  { icon: Brain, title: "Mental State", desc: "Learn how fear and concentration affect your riding and achieve 'the zone' on every ride." },
  { icon: Eye, title: "Advanced Vision", desc: "Go beyond basics — train your eyes for corner entry, apex targeting, and hazard scanning." },
  { icon: Route, title: "Body Position", desc: "A 10-step technology for perfect body positioning that transforms cornering confidence." },
  { icon: Zap, title: "Suspension Setup", desc: "Understand and adjust your fork and shock for maximum control and comfort." },
];

const faqs = [
  { q: "Do I need any prior experience for the MTC?", a: "No! The Motorcycle Training Course is designed for complete beginners with no riding experience. You should however be able to balance and comfortably ride a two-wheeled bicycle." },
  { q: "Is the motorcycle provided?", a: "Yes — for the MTC, we provide the motorcycle and helmet. For the Advanced Course, you must bring your own motorcycle." },
  { q: "What happens if I don't pass?", a: "There are written and riding evaluations after the course. You must pass both to graduate and receive your DMV waiver. If you don't pass, contact us about rescheduling options." },
  { q: "What's the cancellation policy?", a: "You must notify us at least 5 business days before the start of class. If a class is cancelled by us, you'll be rescheduled at no extra cost. Classes are held rain or shine." },
  { q: "Can I get a discount?", a: "Returning students get $50 off the Intermediate Course ($300 vs $350) — call our office to receive the discounted rate. For new students, groups of 4+ friends receive a group discount — call our office for details." },
  { q: "Is the course required for licensing?", a: "If you're under 21, the MTC is mandatory before taking your motorcycle permit written test at the DMV. For 21 and over, it's recommended but not required — though you still get the DMV skills test waiver." },
];

/* ─── Basic Course Tab ─── */
const BasicCourse = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.4 }}
  >
    {/* Hero image banner */}
    <div className="relative rounded-3xl overflow-hidden mb-12">
      <img src={basicRiders} alt="Students on training motorcycles" className="w-full h-64 md:h-80 object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      <div className="absolute bottom-6 left-6 md:bottom-8 md:left-8 flex items-center gap-4">
        <img src={cmspLogo} alt="CMSP California Motorcyclist Safety Program" className="h-16 md:h-20 rounded-xl shadow-lg" />
          <div>
            <p className="text-accent font-bold text-lg md:text-2xl">Motorcycle Training Course</p>
            <p className="text-foreground/70 text-sm">CMSP Certified</p>
          </div>
      </div>
    </div>

    {/* Licensing highlight — the star feature */}
    <div className="bg-gradient-to-br from-accent/15 via-accent/8 to-transparent border-2 border-accent/30 rounded-3xl p-8 md:p-10 mb-12">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center flex-shrink-0">
          <FileCheck className="w-7 h-7 text-accent-foreground" />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-foreground mb-1">Get Licensed Through Our Course</h3>
          <p className="text-muted-foreground">Skip the DMV riding test — earn your CA motorcycle license the smart way</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-accent text-accent-foreground text-xs font-bold px-3 py-1 rounded-full">REQUIRED</span>
            <span className="text-foreground font-bold text-lg">Under 21</span>
          </div>
          <p className="text-3xl font-bold text-foreground mb-3"><EditableText contentKey="courses.mtc.price" fallback="$395" /></p>
          <ul className="space-y-2 text-sm text-foreground/80">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
              <span><strong>Mandatory</strong> before taking your permit written test at the DMV</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
              <span>Earn your <strong>CA DMV DL389 Certificate</strong> — required to proceed</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
              <span><strong>Waives the DMV riding skills test</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
              <span>Graduation card for <strong>insurance discounts</strong></span>
            </li>
          </ul>
        </div>

        <div className="bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-secondary text-secondary-foreground text-xs font-bold px-3 py-1 rounded-full">RECOMMENDED</span>
            <span className="text-foreground font-bold text-lg">21 and Over</span>
          </div>
          <p className="text-3xl font-bold text-accent mb-3"><EditableText contentKey="courses.mtc.priceAlt" fallback="$425" /></p>
          <ul className="space-y-2 text-sm text-foreground/80">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
              <span>Not required, but <strong>highly recommended</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
              <span>Earn your <strong>CA DMV DL389 Certificate</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
              <span><strong>Waives the DMV riding skills test</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
              <span>Graduation card for <strong>insurance discounts</strong></span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    {/* Course details */}
    <div className="grid lg:grid-cols-2 gap-12 mb-12">
      <div>
        <h3 className="text-2xl font-bold text-foreground mb-4">What You'll Learn</h3>
        <p className="text-muted-foreground leading-relaxed mb-6">
          The MTC is designed for novice riders with no or limited street-riding experience. 
          A typical class consists of <strong className="text-foreground">6½ hours of classroom instruction</strong> and{" "}
          <strong className="text-foreground">10 hours of riding practice</strong>. Topics include managing fear, 
          understanding how motorcycles turn, proper cornering strategies, and emergency crash avoidance skills.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-6">
          Even experienced riders who have taken the course report improving their riding skills considerably!
        </p>

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-6">
          <div className="flex items-center gap-2 bg-card border border-border rounded-full px-4 py-2">
            <Clock className="w-4 h-4 text-accent" />
            <span>2 Days (Weekend)</span>
          </div>
          <div className="flex items-center gap-2 bg-card border border-border rounded-full px-4 py-2">
            <Users className="w-4 h-4 text-accent" />
            <span>Small Groups</span>
          </div>
          <div className="flex items-center gap-2 bg-card border border-border rounded-full px-4 py-2">
            <BookOpen className="w-4 h-4 text-accent" />
            <span>Modern Curriculum</span>
          </div>
        </div>

        <Link to="/choose-location?course=basic">
          <Button variant="hero" size="lg" className="group">
            Enroll Now
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        <img src={basicTraining} alt="Motorcycle training course in progress" className="rounded-2xl w-full h-56 object-cover" />

        <div className="bg-card border border-border rounded-2xl p-6">
          <h4 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <BadgeCheck className="w-5 h-5 text-accent" />
            What's Included
          </h4>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              "No experience required",
              "Motorcycle provided",
              "Helmet included",
              "DMV test waiver",
              "CMSP DL389 Certificate",
              "Insurance discount card",
              "Small group instruction",
              "Safety-focused curriculum",
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-foreground/85">
                <Check className="w-4 h-4 text-accent flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
          <p className="text-sm text-foreground/80">
            <strong className="text-destructive">Important:</strong> Do not enroll if you are not able to balance 
            and comfortably ride a two-wheeled bicycle. Students must provide proper riding gear and be on time — 
            late arrivals will not be allowed to participate.
          </p>
        </div>
      </div>
    </div>
  </motion.div>
);

/* ─── 1-Day Premier Course Tab ─── */
const premierSkills = [
  { icon: Gauge, title: "Throttle Control", desc: "Master the single most important control — affecting traction, suspension, weight transfer, and stability." },
  { icon: Shield, title: "Brake Control", desc: "Learn emergency braking techniques to achieve short, safe stops when hazards appear." },
  { icon: Eye, title: "Vision", desc: "The most fundamental riding skill — learn why you go where you look and how to use your eyes for safety." },
  { icon: Route, title: "Line Selection", desc: "Plan and follow proper cornering lines for safe, smooth progression through every bend." },
  { icon: Bike, title: "Low Speed Turns", desc: "Reduce your minimum turning diameter by 30-40% in as little as five minutes of practice." },
  { icon: AlertTriangle, title: "Evasive Maneuvers", desc: "Practice life-saving swerving techniques without exceeding your tire's traction limits." },
  { icon: Target, title: "Road Speed Cornering", desc: "Combine throttle, vision, line selection and body position for safe turns at road speeds." },
];

const PremierCourse = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.4 }}
  >
    {/* Hero banner */}
    <div className="relative rounded-3xl overflow-hidden mb-12">
      <img src={premierCourse} alt="1-Day Premier Course rider training" className="w-full h-64 md:h-80 object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      <div className="absolute bottom-6 left-6 md:bottom-8 md:left-8">
        <p className="text-accent font-bold text-xl md:text-2xl">CMSP 1-Day Premier Course</p>
        <p className="text-foreground/70">With Licensing Option for 21+</p>
      </div>
    </div>

    <div className="grid lg:grid-cols-5 gap-12 mb-12">
      <div className="lg:col-span-3">
        <h3 className="text-2xl font-bold text-foreground mb-4">Get Licensed in One Day</h3>
        <p className="text-muted-foreground leading-relaxed mb-4">
          The CMSP 1-Day Premier Course is an intensive <strong className="text-foreground">8-hour</strong> program 
          designed for experienced riders with a licensing option for unlicensed riders aged <strong className="text-foreground">21 and over</strong> who 
          want to achieve intermediate-level skills along with their motorcycle license — all in a single day.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Developed by Total Control Training and based on the most current research in rider safety, this course 
          includes both classroom and riding instruction. It's challenging, fun, and proven to enhance student outcomes.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-8">
          You must pass a basic riding evaluation at the start of class, similar to the DMV Motorcycle Skills Test.
        </p>

        {/* Skills grid */}
        <h4 className="text-lg font-bold text-foreground mb-4">What You'll Master</h4>
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {premierSkills.map((skill, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 hover:border-accent/40 transition-colors group">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center group-hover:bg-accent/25 transition-colors">
                  <skill.icon className="w-4 h-4 text-accent" />
                </div>
                <h5 className="font-bold text-foreground text-sm">{skill.title}</h5>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{skill.desc}</p>
            </div>
          ))}
        </div>

        <Link to="/choose-location?course=premier">
          <Button variant="hero" size="lg" className="group">
            Enroll Now
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
      </div>

      <div className="lg:col-span-2 space-y-4">
        {/* Pricing */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h4 className="font-bold text-foreground mb-4">Course Fees</h4>
          <div className="space-y-4">
            <div className="bg-secondary/50 rounded-xl p-4">
              <p className="text-sm text-muted-foreground mb-1">New Student</p>
              <p className="text-3xl font-bold text-foreground">$350</p>
              <p className="text-xs text-muted-foreground mt-1">Group discount for 4+ friends</p>
            </div>
            <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 relative">
              <span className="absolute -top-2.5 right-3 bg-accent text-accent-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                SAVE $50
              </span>
              <p className="text-sm text-muted-foreground mb-1">Returning Student</p>
              <p className="text-3xl font-bold text-accent">$300</p>
              <p className="text-xs text-muted-foreground mt-1">Previous Learn to Ride VC student</p>
              <p className="text-[10px] text-accent font-medium mt-1">Call to receive discounted rate</p>
            </div>
          </div>
        </div>

        {/* Licensing details */}
        <div className="bg-gradient-to-br from-accent/15 to-transparent border-2 border-accent/30 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <Award className="w-5 h-5 text-accent" />
            <h4 className="font-bold text-foreground">Licensing Option</h4>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            Riders <strong className="text-foreground">21 and over</strong> who are not yet licensed can earn their 
            motorcycle license through this course. You must demonstrate fundamental riding skills by passing a basic 
            riding evaluation at the beginning of class.
          </p>
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 mt-3">
            <p className="text-xs text-foreground/80">
              <strong className="text-destructive">Important:</strong> Students with a license restricted due to 
              impairment convictions may not participate until all restrictions are lifted.
            </p>
          </div>
        </div>

        {/* Entry test video note */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <FileCheck className="w-5 h-5 text-accent" />
            <h4 className="font-bold text-foreground">Entry Skills Test</h4>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            Unlicensed students must pass a basic riding evaluation similar to the CA DMV Motorcycle Skills Test 
            at the start of class to continue.
          </p>
          <p className="text-xs text-muted-foreground">
            Licensed riders are <strong className="text-foreground">not</strong> required to pass this test.
          </p>
        </div>

        {/* Military note */}
        <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-4">
          <Shield className="w-5 h-5 text-accent flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Recognized by Army, Navy, Air Force, Marines & Coast Guard for Level 2 & Refresher training
          </p>
        </div>

        {/* Promises */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h4 className="font-bold text-foreground mb-4">Our Promises</h4>
          <ul className="space-y-3">
            {[
              "Specific, measurable improvement in your riding",
              "Better understanding of how your bike works",
              "Ability to self-diagnose riding problems",
              "High teacher-to-student ratio (6:1 max)",
              "Friendly, professional instruction",
            ].map((promise, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/85">
                <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                {promise}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </motion.div>
);

/* ─── Intermediate Course Tab ─── */
const IntermediateCourse = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.4 }}
  >
    {/* Hero banner */}
    <div className="relative rounded-3xl overflow-hidden mb-12">
      <img src={intermediateCornering} alt="Intermediate rider cornering" className="w-full h-64 md:h-80 object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      <div className="absolute bottom-6 left-6 md:bottom-8 md:left-8">
        <p className="text-foreground font-bold text-xl md:text-2xl">Intermediate Riding Clinic</p>
        <p className="text-foreground/70">CMSP 1-Day Premier Course (With Licensing Option)</p>
      </div>
    </div>

    <div className="grid lg:grid-cols-5 gap-12 mb-12">
      <div className="lg:col-span-3">
        <h3 className="text-2xl font-bold text-foreground mb-4">The Perfect Next Step</h3>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Developed by Total Control Training, the IRC/1DPC is the perfect next step for newer riders looking to improve 
          and returning riders getting back in the saddle. This course includes both classroom and riding instruction, 
          completed in one intensive <strong className="text-foreground">8-hour day</strong>.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-8">
          Based on the most current research in rider safety, this course utilizes modern training methods proven to enhance 
          student outcomes. It's also challenging and fun!
        </p>

        {/* Skills grid */}
        <h4 className="text-lg font-bold text-foreground mb-4">What You'll Master</h4>
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {intermediateSkills.map((skill, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 hover:border-accent/40 transition-colors group">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center group-hover:bg-accent/25 transition-colors">
                  <skill.icon className="w-4 h-4 text-accent" />
                </div>
                <h5 className="font-bold text-foreground text-sm">{skill.title}</h5>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{skill.desc}</p>
            </div>
          ))}
        </div>

        <Link to="/choose-location?course=intermediate">
          <Button variant="hero" size="lg" className="group">
            Enroll Now
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
      </div>

      <div className="lg:col-span-2 space-y-4">
        {/* Pricing */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h4 className="font-bold text-foreground mb-4">Course Fees</h4>
          <div className="space-y-4">
            <div className="bg-secondary/50 rounded-xl p-4">
              <p className="text-sm text-muted-foreground mb-1">New Student</p>
              <p className="text-3xl font-bold text-foreground">$350</p>
              <p className="text-xs text-muted-foreground mt-1">Group discount for 4+ friends</p>
            </div>
            <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 relative">
              <span className="absolute -top-2.5 right-3 bg-accent text-accent-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                SAVE $50
              </span>
              <p className="text-sm text-muted-foreground mb-1">Returning Student</p>
              <p className="text-3xl font-bold text-accent">$300</p>
              <p className="text-xs text-muted-foreground mt-1">Previous Learn to Ride VC student</p>
              <p className="text-[10px] text-accent font-medium mt-1">Call to receive discounted rate</p>
            </div>
          </div>
        </div>

        {/* Licensing option */}
        <div className="bg-card border border-accent/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <Award className="w-5 h-5 text-accent" />
            <h4 className="font-bold text-foreground">Licensing Option</h4>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            Not yet licensed? Riders <strong className="text-foreground">21+</strong> can achieve intermediate-level 
            skills along with their motorcycle license. You must pass a basic riding evaluation at the start, similar to the DMV skills test.
          </p>
        </div>

        <img src={intermediateRider} alt="Rider training on course" className="rounded-2xl w-full h-48 object-cover" />

        {/* Military note */}
        <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-4">
          <Shield className="w-5 h-5 text-accent flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Recognized by Army, Navy, Air Force, Marines & Coast Guard for Level 2 & Refresher training
          </p>
        </div>
      </div>
    </div>
  </motion.div>
);

/* ─── Advanced Course Tab ─── */
const AdvancedCourse = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.4 }}
  >
    {/* Hero banner */}
    <div className="relative rounded-3xl overflow-hidden mb-12">
      <img src={throttleControl} alt="Advanced riding technique" className="w-full h-64 md:h-80 object-cover object-center" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      <div className="absolute bottom-6 left-6 md:bottom-8 md:left-8 flex items-center gap-4">
        <img src={totalControlLogo} alt="Total Control Training" className="h-12 md:h-16 rounded-lg shadow-lg" />
        <div>
          <p className="text-foreground font-bold text-xl md:text-2xl">Total Control ARC®</p>
          <p className="text-foreground/70">Advanced Riding Clinic</p>
        </div>
      </div>
    </div>

    <div className="grid lg:grid-cols-2 gap-12 mb-12">
      <div>
        <h3 className="text-2xl font-bold text-foreground mb-4">Master Advanced Techniques</h3>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Whether you want to become a more proficient and safer rider on the street — or a faster rider on the track — 
          mastering advanced riding techniques is crucial. Unlike typical advanced courses held at high-speed racetracks, 
          every drill in our ARC is performed <strong className="text-foreground">one at a time</strong>, 
          in a controlled environment.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-6">
          After each run, you'll receive professional, concise coaching on the specific skills you need. 
          Cornering speeds never exceed 25 mph — but in a tight enough corner, 25 is <em>very, very fast</em>. 
          From cruisers to sportbikes, all types welcome.
        </p>

        <div className="flex items-center gap-4 mb-8">
          <img src={totalControlBook} alt="Total Control book by Lee Parks" className="h-28 rounded-lg shadow-md" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            Based on the best-selling book <em className="text-foreground">"Total Control: High Performance Street Riding Techniques"</em> by Lee Parks — Second Edition.
          </p>
        </div>

        <a href="tel:+18058270075">
          <Button variant="hero" size="lg" className="group">
            Register for ARC — Call Now
            <Phone className="ml-2 w-5 h-5 group-hover:scale-110 transition-transform" />
          </Button>
        </a>
      </div>

      <div className="space-y-4">
        {/* Skills */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h4 className="font-bold text-foreground mb-4">What It Covers</h4>
          <div className="space-y-4">
            {advancedSkills.map((skill, i) => (
              <div key={i} className="flex items-start gap-3 group">
                <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0 group-hover:bg-accent/25 transition-colors">
                  <skill.icon className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <h5 className="font-bold text-foreground text-sm">{skill.title}</h5>
                  <p className="text-xs text-muted-foreground leading-relaxed">{skill.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Am I Ready */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
            <Star className="w-5 h-5 text-accent" />
            Am I Ready for ARC?
          </h4>
          <p className="text-xs text-muted-foreground mb-3">Answer YES to all three:</p>
          <ul className="space-y-2">
            {[
              "Do you feel confident riding through curvy roads at regular speeds?",
              "Can you swerve around an unexpected obstacle at road speed?",
              "Can you make your motorcycle stop in a very short distance?",
            ].map((q, i) => (
              <li key={i} className="flex items-start gap-2">
                <div className="mt-0.5 w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-accent text-xs font-bold">{i + 1}</span>
                </div>
                <span className="text-sm text-foreground/85">{q}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground mt-3">
            If NO to any, consider the Intermediate Course first.
          </p>
        </div>

        {/* Requirements */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent" />
            Requirements
          </h4>
          <ul className="space-y-2 text-sm text-foreground/85">
            {[
              "Your own motorcycle or scooter in proper working order",
              "DOT-approved helmet (full-face recommended)",
              "Motorcycle jacket, pants, gloves & ankle-covering boots",
              "Kevlar jeans accepted — regular jeans & fingerless gloves are not",
              "No race tires, race compound tires, or car tires",
              "Max 24 students, 6:1 student-to-instructor ratio",
            ].map((req, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>

    {/* ARC Promises */}
    <div className="bg-accent/10 border border-accent/20 rounded-2xl p-8 mb-8">
      <h4 className="font-bold text-foreground text-lg mb-6 text-center">The Total Control ARC® Promises</h4>
      <div className="grid sm:grid-cols-3 gap-6">
        {[
          { title: "Measurable Improvement", desc: "No matter your skill level, ARC will make a recognizable difference in your bike control." },
          { title: "Understand Your Bike", desc: "Learn how your actions affect traction, suspension, and overall control." },
          { title: "Self-Diagnose Skills", desc: "Coach yourself in the future with the knowledge and materials provided." },
        ].map((promise, i) => (
          <div key={i} className="text-center">
            <p className="font-semibold text-foreground text-sm mb-1">{promise.title}</p>
            <p className="text-xs text-muted-foreground">{promise.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </motion.div>
);

const CoursesPage = () => {
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabId) || "basic";
  const [activeTab, setActiveTab] = useState<TabId>(tabs.some(t => t.id === initialTab) ? initialTab : "basic");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/8 via-accent/3 to-transparent" />
        <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl" />
        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-center max-w-4xl mx-auto"
          >
            {activeTab === "basic" && (
              <span className="inline-block bg-accent/20 text-accent font-bold px-4 py-2 rounded-full text-sm mb-6 border border-accent/30">
                <EditableText contentKey="coursespage.badge" fallback="CMSP Certified Training" />
              </span>
            )}
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              <EditableText contentKey="coursespage.title.a" fallback="Find Your Perfect" /> <span className="text-accent"><EditableText contentKey="coursespage.title.b" fallback="Riding Course" /></span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              <EditableText contentKey="coursespage.subtitle" fallback="From first-time riders to seasoned veterans — our CMSP certified programs build real-world skills at every level." multiline />
            </p>
          </motion.div>
        </div>
      </section>

      {/* Tab Navigation */}
      <section className="sticky top-20 z-40 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex justify-center">
            <div className="flex gap-1 p-1.5 bg-card rounded-2xl border border-border my-4">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-2 px-5 md:px-8 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                      isActive
                        ? "bg-accent text-accent-foreground shadow-lg shadow-accent/25"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Course Content */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <AnimatePresence mode="wait">
            {activeTab === "basic" && <BasicCourse key="basic" />}
            {activeTab === "premier" && <PremierCourse key="premier" />}
            {activeTab === "intermediate" && <IntermediateCourse key="intermediate" />}
            {activeTab === "advanced" && <AdvancedCourse key="advanced" />}
          </AnimatePresence>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-card/50">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-3xl font-bold">
              <EditableText contentKey="coursespage.faq.title" fallback="Frequently Asked Questions" />
            </h2>
          </motion.div>


          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                viewport={{ once: true }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left bg-card border border-border rounded-xl p-5 hover:border-accent/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium text-foreground">{faq.q}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${
                        openFaq === i ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                  {openFaq === i && (
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                  )}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-accent/15 via-accent/5 to-transparent border border-accent/20 rounded-3xl p-12 text-center max-w-3xl mx-auto"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <EditableText contentKey="coursespage.cta.title" fallback="Ready to Ride?" />
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              <EditableText contentKey="coursespage.cta.desc" fallback="Choose your course and take the first step toward confident, skilled riding." multiline />
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to={`/choose-location?course=${activeTab}`}>
                <Button variant="hero" size="lg" className="group w-full sm:w-auto">
                  <EditableText contentKey="coursespage.cta.btn.primary" fallback="Enroll Now" />
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link to="/contact">
                <Button variant="heroOutline" size="lg" className="w-full sm:w-auto">
                  <EditableText contentKey="coursespage.cta.btn.secondary" fallback="Contact Us" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CoursesPage;

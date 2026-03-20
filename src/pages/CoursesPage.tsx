import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Check, ArrowRight, Clock, Users, Award, Shield, BookOpen,
  Gauge, Eye, Route, AlertTriangle, Bike, ChevronDown, Star,
  Target, Zap, Brain
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

const basicCourseFeatures = [
  "No experience required — start from zero",
  "Motorcycle & helmet provided",
  "6.5 hours classroom + 10 hours riding",
  "DMV riding test waiver on completion",
  "CMSP DL389 Certificate",
  "Insurance discount eligibility",
  "Small group instruction",
  "Modern safety-focused curriculum",
];

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

const CoursesPage = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    { q: "Do I need any prior experience for the Basic Course?", a: "No! The Basic Motorcyclist Training Course is designed for complete beginners with no riding experience. You should however be able to balance and comfortably ride a two-wheeled bicycle." },
    { q: "Is the motorcycle provided?", a: "Yes — for the Basic Course, we provide the motorcycle, helmet, and gear. For the Intermediate Course, you can use our loaner bikes or bring your own. The Advanced Course requires your own motorcycle." },
    { q: "What happens if I don't pass?", a: "There are written and riding evaluations after the course. You must pass both to graduate and receive your DMV waiver. If you don't pass, contact us about rescheduling options." },
    { q: "What's the cancellation policy?", a: "You must notify us at least 5 business days before the start of class. If a class is cancelled by us, you'll be rescheduled at no extra cost. Classes are held rain or shine." },
    { q: "Can I get a discount?", a: "Returning students get $50 off the Intermediate Course ($300 vs $350). For new students, groups of 4+ friends receive a group discount — call our office for details." },
    { q: "Is the course required for licensing?", a: "If you're under 21, the Basic Course is mandatory before taking your motorcycle permit written test at the DMV. For 21 and over, it's recommended but not required — though you still get the DMV skills test waiver." },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/8 via-accent/3 to-transparent" />
        <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl" />
        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-center max-w-4xl mx-auto"
          >
            <span className="inline-block bg-accent/20 text-accent font-bold px-4 py-2 rounded-full text-sm mb-6 border border-accent/30">
              CMSP Certified Training
            </span>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Find Your Perfect <span className="text-accent">Riding Course</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From first-time riders to seasoned veterans — our CMSP certified programs
              build real-world skills at every level. All courses may waive the DMV riding skills test.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ===================== BASIC COURSE ===================== */}
      <section className="py-20 relative" id="basic">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <span className="text-accent font-semibold tracking-wider uppercase text-sm">Beginner</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">
                Motorcyclist Training Course
              </h2>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                The MTC is designed for novice riders with no or limited street-riding experience.
                Learn fundamental motorcycle operation and progress to street riding skills and strategies
                based on the most current research in rider safety.
              </p>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Topics include managing fear, understanding how motorcycles turn, proper cornering strategies,
                and emergency crash avoidance skills. Even experienced riders report significant skill improvement!
              </p>

              <div className="bg-card border border-border rounded-2xl p-6 mb-6">
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-1">Under 21</p>
                    <p className="text-3xl font-bold text-foreground">$395</p>
                    <p className="text-xs text-muted-foreground mt-1">Required for permit test</p>
                  </div>
                  <div className="w-px bg-border hidden sm:block" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-1">21 and Over</p>
                    <p className="text-3xl font-bold text-accent">$425</p>
                    <p className="text-xs text-muted-foreground mt-1">Recommended, not required</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-8">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-accent" />
                  <span>2 Days (Weekend)</span>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-accent" />
                  <span>6.5hrs Classroom + 10hrs Riding</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-accent" />
                  <span>Small Groups</span>
                </div>
              </div>

              <Button variant="hero" size="lg" className="group">
                Enroll in Basic Course
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <div className="bg-card border border-border rounded-2xl p-8">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Check className="w-5 h-5 text-accent" />
                  What's Included
                </h3>
                <ul className="space-y-4">
                  {basicCourseFeatures.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="mt-1 w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-accent" />
                      </div>
                      <span className="text-foreground/90">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8 p-4 rounded-xl bg-accent/10 border border-accent/20">
                  <div className="flex items-start gap-3">
                    <Award className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground text-sm">DMV Test Waiver</p>
                      <p className="text-muted-foreground text-sm mt-1">
                        Successfully complete the course and skip the DMV riding skills test. 
                        You'll receive your CA DMV DL389 Certificate.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-4 rounded-xl bg-secondary/50 border border-border">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground text-sm">Under 21 — Mandatory</p>
                      <p className="text-muted-foreground text-sm mt-1">
                        This course is required before taking your motorcycle permit written test at the DMV.
                        You'll earn your DL389 Certificate to proceed.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="container mx-auto px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* ===================== INTERMEDIATE COURSE ===================== */}
      <section className="py-20 relative" id="intermediate">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-accent font-semibold tracking-wider uppercase text-sm">Intermediate</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">
              Intermediate Riding Clinic / CMSP 1-Day Premier
            </h2>
            <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
              The perfect next step for newer riders looking to improve and returning riders 
              getting back in the saddle. Includes both classroom and on-cycle instruction 
              — completed in one intensive 8-hour day.
            </p>
          </motion.div>

          {/* Pricing cards */}
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-2xl p-6 text-center"
            >
              <p className="text-sm text-muted-foreground mb-2">New Student</p>
              <p className="text-4xl font-bold text-foreground mb-2">$350</p>
              <p className="text-sm text-muted-foreground">Group discount for 4+ friends</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
              className="bg-accent/10 border border-accent/30 rounded-2xl p-6 text-center relative"
            >
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground text-xs font-bold px-3 py-1 rounded-full">
                Returning Student
              </span>
              <p className="text-sm text-muted-foreground mb-2">Previous Learn to Ride VC student</p>
              <p className="text-4xl font-bold text-accent mb-2">$300</p>
              <p className="text-sm text-muted-foreground">$50 loyalty discount</p>
            </motion.div>
          </div>

          {/* Licensing option callout */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="bg-card border border-border rounded-2xl p-6 max-w-3xl mx-auto mb-16"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                <Award className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-2">Licensing Option Available</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Not yet licensed? Riders 21+ can achieve intermediate-level skills along with their 
                  motorcycle license through this course. You'll need to pass a basic riding evaluation 
                  at the beginning, similar to the DMV skills test. Use our loaner bikes or bring your own.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Skills grid */}
          <h3 className="text-2xl font-bold text-center mb-10">What You'll Master</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
            {intermediateSkills.map((skill, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                viewport={{ once: true }}
                className="bg-card border border-border rounded-2xl p-6 hover:border-accent/40 transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center mb-4 group-hover:bg-accent/25 transition-colors">
                  <skill.icon className="w-5 h-5 text-accent" />
                </div>
                <h4 className="font-bold text-foreground mb-2">{skill.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{skill.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="text-center">
            <Button variant="hero" size="lg" className="group">
              Enroll in Intermediate Course
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Military note */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            viewport={{ once: true }}
            className="mt-10 text-center"
          >
            <div className="inline-flex items-center gap-2 bg-card border border-border rounded-full px-5 py-2.5">
              <Shield className="w-4 h-4 text-accent" />
              <span className="text-sm text-muted-foreground">
                Recognized by Army, Navy, Air Force, Marines & Coast Guard for Level 2 & Refresher training
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Divider */}
      <div className="container mx-auto px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* ===================== ADVANCED COURSE ===================== */}
      <section className="py-20 relative" id="advanced">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/3 to-transparent" />
        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-accent font-semibold tracking-wider uppercase text-sm">Advanced</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">
              Total Control Advanced Riding Clinic
            </h2>
            <p className="text-muted-foreground text-lg max-w-3xl mx-auto mb-4">
              Master advanced riding techniques at street-legal speeds in a controlled environment. 
              Based on the best-selling book <em className="text-foreground/80">"Total Control: High Performance Street Riding Techniques"</em> by Lee Parks.
            </p>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Every drill is performed one at a time with professional coaching after each run. 
              Cornering speeds never exceed 25 mph — but in a tight enough corner, 25 is very, very fast.
            </p>
          </motion.div>

          {/* Skills grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
            {advancedSkills.map((skill, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                viewport={{ once: true }}
                className="bg-card border border-border rounded-2xl p-6 hover:border-accent/40 transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center mb-4 group-hover:bg-accent/25 transition-colors">
                  <skill.icon className="w-5 h-5 text-accent" />
                </div>
                <h4 className="font-bold text-foreground mb-2">{skill.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{skill.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Am I Ready + Requirements */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-12">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-2xl p-6"
            >
              <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-accent" />
                Am I Ready for ARC?
              </h3>
              <p className="text-sm text-muted-foreground mb-4">Answer YES to all three to enroll:</p>
              <ul className="space-y-3">
                {[
                  "Do you feel confident riding through curvy roads at regular speeds?",
                  "Can you swerve around an unexpected obstacle at road speed?",
                  "Can you make your motorcycle stop in a very short distance?",
                ].map((q, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="mt-1 w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-accent text-xs font-bold">{i + 1}</span>
                    </div>
                    <span className="text-sm text-foreground/85">{q}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-4">
                If you answered NO to any, consider the Intermediate Course first.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-2xl p-6"
            >
              <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-accent" />
                Requirements
              </h3>
              <ul className="space-y-3 text-sm text-foreground/85">
                {[
                  "Your own motorcycle or scooter in proper working order",
                  "DOT-approved helmet (full-face recommended)",
                  "Motorcycle jacket, pants, gloves & ankle-covering boots",
                  "Kevlar jeans accepted — regular jeans & fingerless gloves are not",
                  "No race tires, race compound tires, or car tires",
                  "Max 24 students, 6:1 student-to-instructor ratio",
                ].map((req, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          {/* ARC Promises */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="bg-accent/10 border border-accent/20 rounded-2xl p-8 max-w-3xl mx-auto mb-10"
          >
            <h3 className="font-bold text-foreground text-lg mb-4 text-center">The Total Control ARC® Promises</h3>
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
          </motion.div>

          <div className="text-center">
            <Button variant="hero" size="lg" className="group">
              Register for Advanced Course
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="container mx-auto px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* ===================== FAQ ===================== */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold">Frequently Asked Questions</h2>
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Ride?</h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              Choose your course and take the first step toward confident, skilled riding. 
              Call us to book your spot today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="tel:+17604038091">
                <Button variant="hero" size="lg" className="group w-full sm:w-auto">
                  Call (760) 403-8091
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </a>
              <Link to="/#contact">
                <Button variant="heroOutline" size="lg" className="w-full sm:w-auto">
                  Contact Us
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

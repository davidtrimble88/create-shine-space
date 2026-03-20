import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowRight, GraduationCap, Gauge, Zap, Clock, Users, Award, Shield } from "lucide-react";
import { Link } from "react-router-dom";

const courses = [
  {
    id: "basic",
    icon: GraduationCap,
    title: "Basic Riding Course",
    subtitle: "CMSP Motorcyclist Training Course",
    price: "From $395",
    duration: "2 Days (Weekend)",
    description:
      "Perfect for beginners with no riding experience. Learn to ride, get your CMSP DL389 Certificate, and waive the DMV riding skills test. Motorcycle, helmet & gear provided.",
    highlights: ["No experience needed", "Bike & gear provided", "DMV test waiver"],
    color: "from-accent/20 to-accent/5",
    borderColor: "border-accent/30",
  },
  {
    id: "intermediate",
    icon: Gauge,
    title: "Intermediate Course",
    subtitle: "IRC / CMSP 1-Day Premier",
    price: "From $300",
    duration: "1 Day (8 Hours)",
    description:
      "Level up your skills with advanced throttle control, emergency braking, cornering, and evasive maneuvers. Includes licensing option for unlicensed riders 21+.",
    highlights: ["Licensing option available", "Returning student discount", "Military recognized"],
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
      "Master advanced cornering, traction management, body position, and suspension setup at street-legal speeds. Based on Lee Parks' best-selling book. Bring your own bike.",
    highlights: ["Street-legal speeds", "Professional coaching", "All bike types welcome"],
    color: "from-secondary to-secondary/50",
    borderColor: "border-border",
  },
];

const ChooseCoursePage = () => {
  return (
    <div className="min-h-screen bg-background">
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
              Step 1 of 3
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Choose Your <span className="text-accent">Course</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Select the course that matches your experience level to get started.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {courses.map((course, i) => {
              const Icon = course.icon;
              return (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <Link to={`/choose-location?course=${course.id}`} className="block h-full">
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

                      <ul className="space-y-2 mb-8">
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
                  </Link>
                </motion.div>
              );
            })}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center text-sm text-muted-foreground mt-10"
          >
            Not sure which course is right for you?{" "}
            <a href="tel:+17604038091" className="text-accent hover:underline font-medium">
              Call us at (760) 403-8091
            </a>
          </motion.p>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ChooseCoursePage;

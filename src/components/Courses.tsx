import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Clock, Users, Award } from "lucide-react";
import { Link } from "react-router-dom";

const courses = [
  {
    name: "Motorcycle Training Course",
    subtitle: "Perfect for beginners",
    price: "$425",
    duration: "2 Days (Weekend)",
    tab: "basic",
    features: [
      "No experience required",
      "Motorcycle provided",
      "Helmet included",
      "DMV test waiver upon completion",
      "CMSP certificate",
      "Insurance discount eligibility",
    ],
    popular: true,
  },
  {
    name: "1-Day Premier Course",
    subtitle: "Get licensed in one day",
    price: "$350",
    duration: "1 Day (8 Hours)",
    tab: "premier",
    features: [
      "For unlicensed riders 21+",
      "Licensing option included",
      "Loaner bikes available",
      "Entry skills test required",
      "Military recognized",
      "6:1 student-instructor ratio",
    ],
    popular: false,
  },
  {
    name: "Intermediate Course",
    subtitle: "Level up your skills",
    price: "$350",
    duration: "1 Day",
    tab: "intermediate",
    features: [
      "For licensed riders",
      "Advanced techniques",
      "Emergency maneuvers",
      "Cornering mastery",
      "Risk management",
      "Personalized feedback",
    ],
    popular: false,
  },
  {
    name: "Advanced Riding Clinic",
    subtitle: "Total Control ARC®",
    price: "Contact for Pricing",
    duration: "1 Day",
    tab: "advanced",
    features: [
      "Bring your own motorcycle",
      "Advanced cornering techniques",
      "Traction management",
      "Body position mastery",
      "Suspension setup guidance",
      "Professional coaching",
    ],
    popular: false,
  },
];

const Courses = () => {
  return (
    <section className="py-24 bg-background" id="courses">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-accent font-semibold tracking-wider uppercase text-sm">
            Our Courses
          </span>
          <h2 className="text-4xl md:text-5xl font-bold mt-4 mb-6">
            Choose Your <span className="text-accent">Path</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Whether you're a complete beginner or looking to sharpen your skills, 
            we have the perfect course for you
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {courses.map((course, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`relative rounded-2xl border flex flex-col ${
                course.popular
                  ? "border-accent bg-gradient-to-b from-accent/10 to-background"
                  : "border-border bg-card"
              } p-8 overflow-hidden`}
            >
              {course.popular && (
                <div className="absolute top-4 right-4">
                  <span className="bg-accent text-accent-foreground text-xs font-semibold px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className={`text-2xl font-bold mb-2 ${course.popular ? "text-accent" : "text-foreground"}`}>{course.name}</h3>
                <p className="text-muted-foreground">{course.subtitle}</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold text-foreground">{course.price}</span>
                {course.price !== "Contact for Pricing" && (
                  <span className="text-muted-foreground ml-2">per person</span>
                )}
              </div>

              <div className="flex items-center gap-4 mb-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-accent" />
                  <span>{course.duration}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-accent" />
                  <span>Small Groups</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8 flex-grow">
                {course.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-accent flex-shrink-0" />
                    <span className="text-foreground/90">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link to={`/courses?tab=${course.tab}`}>
                <Button
                  variant={course.popular ? "hero" : "heroOutline"}
                  className="w-full group"
                  size="lg"
                >
                  Learn More
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Group rates banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="mt-10 max-w-6xl mx-auto"
        >
          <div className="bg-gradient-to-r from-accent/10 via-accent/5 to-accent/10 border border-accent/20 rounded-2xl px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <Users className="w-6 h-6 text-accent flex-shrink-0" />
              <p className="text-foreground font-medium">
                Looking for group rates? Contact us for special pricing on group bookings.
              </p>
            </div>
            <Link to="/contact">
              <Button variant="hero" className="group whitespace-nowrap">
                Contact Us
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </motion.div>

      </div>
    </section>
  );
};

export default Courses;

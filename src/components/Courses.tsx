import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Clock, Users, Award } from "lucide-react";

const courses = [
  {
    name: "Basic Rider Course",
    subtitle: "Perfect for beginners",
    price: "$425",
    duration: "2 Days (Weekend)",
    features: [
      "No experience required",
      "Motorcycle provided",
      "Helmet & gear included",
      "DMV test waiver upon completion",
      "CMSP certificate",
      "Insurance discount eligibility",
    ],
    popular: true,
  },
  {
    name: "Intermediate Course",
    subtitle: "Level up your skills",
    price: "$350",
    duration: "1 Day",
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

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {courses.map((course, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`relative rounded-2xl border ${
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
                <h3 className="text-2xl font-bold text-foreground mb-2">{course.name}</h3>
                <p className="text-muted-foreground">{course.subtitle}</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold text-foreground">{course.price}</span>
                <span className="text-muted-foreground ml-2">per person</span>
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

              <ul className="space-y-3 mb-8">
                {course.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-accent flex-shrink-0" />
                    <span className="text-foreground/90">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={course.popular ? "hero" : "heroOutline"}
                className="w-full group"
                size="lg"
              >
                Enroll Now
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </motion.div>
          ))}
        </div>

        {/* Additional info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-2 bg-card border border-border rounded-full px-6 py-3">
            <Award className="w-5 h-5 text-accent" />
            <span className="text-muted-foreground">
              All courses include official CMSP certification
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Courses;

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Award, Users } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-motorcycle.jpg";
import EditableText from "@/components/EditableText";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src={heroImage}
          alt="Motorcycle riding"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-background/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="inline-block bg-accent/20 text-accent font-bold px-4 py-2 rounded-full text-sm mb-6 border border-accent/30">
              <EditableText contentKey="hero.badge" fallback="California's Premier Motorcycle Training" />
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold leading-tight mb-6"
          >
            <EditableText contentKey="hero.title" fallback="Master the Art of">
              {(text) => <>{text}{" "}<span className="text-accent">Riding</span></>}
            </EditableText>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl text-foreground mb-8 max-w-2xl leading-relaxed"
          >
            <EditableText
              contentKey="hero.description"
              fallback="CMSP certified courses designed to transform beginners into confident riders. Skip the DMV test and ride with skill, safety, and freedom."
              as="p"
              multiline
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 mb-12"
          >
            <Link to="/choose-course">
              <Button size="lg" variant="hero" className="group text-lg px-8">
                Start Your Journey
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/courses">
              <Button size="lg" variant="heroOutline" className="text-lg px-8">
                View Courses
              </Button>
            </Link>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-wrap gap-6"
          >
            {[
              { icon: Shield, key: "hero.badge1", fallback: "DMV Waiver" },
              { icon: Award, key: "hero.badge2", fallback: "CMSP Certified" },
              { icon: Users, key: "hero.badge3", fallback: "10,000+ Trained" },
            ].map((badge, index) => (
              <div key={index} className="flex items-center gap-2 text-muted-foreground">
                <badge.icon className="w-5 h-5 text-accent" />
                <span className="text-sm font-medium">
                  <EditableText contentKey={badge.key} fallback={badge.fallback} />
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;

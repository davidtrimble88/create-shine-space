import { motion } from "framer-motion";
import { Shield, Award, Clock, Bike, GraduationCap, Users } from "lucide-react";
import EditableText from "@/components/EditableText";

const benefitIcons = [Shield, Award, Bike, GraduationCap, Clock, Users];

const defaultBenefits = [
  { title: "DMV Test Waiver", description: "Pass our course and skip the DMV riding test. Walk out ready to get your license." },
  { title: "CMSP Certified", description: "Official California Motorcyclist Safety Program certification recognized statewide." },
  { title: "Bikes Provided", description: "We provide well-maintained motorcycles for training." },
  { title: "Expert Instructors", description: "Learn from certified professionals with thousands of hours of teaching experience." },
  { title: "Weekend Classes", description: "Complete your training in just one weekend. Flexible scheduling available." },
  { title: "Small Class Sizes", description: "Maximum attention with our intimate group sizes. Never feel lost in the crowd." },
];

const Benefits = () => {
  return (
    <section className="py-24 bg-card" id="about">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-accent font-semibold tracking-wider uppercase text-sm">
            <EditableText contentKey="benefits.label" fallback="Why Choose Us" />
          </span>
          <h2 className="text-4xl md:text-5xl font-bold mt-4 mb-6">
            The <span className="text-accent"><EditableText contentKey="benefits.highlight" fallback="Smart Way" /></span> to Learn
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            <EditableText contentKey="benefits.subtitle" fallback="Everything you need to become a confident, safe rider — all in one place" />
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {defaultBenefits.map((benefit, index) => {
            const Icon = benefitIcons[index];
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="group p-8 rounded-2xl bg-background border border-border hover:border-accent/50 transition-all duration-300"
              >
                <div className="w-14 h-14 bg-accent/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-accent/20 transition-colors">
                  <Icon className="w-7 h-7 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">
                  <EditableText contentKey={`benefits.${index}.title`} fallback={benefit.title} />
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  <EditableText contentKey={`benefits.${index}.desc`} fallback={benefit.description} />
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Benefits;

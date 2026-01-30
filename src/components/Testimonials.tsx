import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Marcus J.",
    location: "Ventura County",
    rating: 5,
    text: "Absolutely fantastic experience! The instructors were patient and knowledgeable. I went from never riding to confidently handling a motorcycle in just one weekend.",
    course: "Basic Rider Course"
  },
  {
    name: "Sarah T.",
    location: "High Desert",
    rating: 5,
    text: "Best decision I ever made. The CMSP certification process was smooth, and I walked away with my license endorsement. Highly recommend!",
    course: "Basic Rider Course"
  },
  {
    name: "David R.",
    location: "Ventura County",
    rating: 5,
    text: "The intermediate course really leveled up my riding skills. Professional instruction in a safe environment. Worth every penny.",
    course: "Intermediate Course"
  }
];

const Testimonials = () => {
  return (
    <section className="py-24 bg-background relative overflow-hidden">
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-card/50 to-transparent" />
      
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-accent font-semibold tracking-wider uppercase text-sm">
            Success Stories
          </span>
          <h2 className="text-4xl md:text-5xl font-bold mt-4 mb-6">
            What Our <span className="text-gradient">Riders Say</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Join thousands of satisfied riders who started their journey with us
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="relative group"
            >
              <div className="bg-card border border-border rounded-2xl p-8 h-full transition-all duration-300 hover:border-accent/50 hover:shadow-glow">
                {/* Quote icon */}
                <Quote className="w-10 h-10 text-accent/30 mb-4" />
                
                {/* Rating */}
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-accent text-accent" />
                  ))}
                </div>
                
                {/* Testimonial text */}
                <p className="text-foreground/90 mb-6 leading-relaxed">
                  "{testimonial.text}"
                </p>
                
                {/* Author info */}
                <div className="mt-auto">
                  <p className="font-semibold text-foreground">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.location}</p>
                  <span className="inline-block mt-2 text-xs bg-accent/10 text-accent px-3 py-1 rounded-full">
                    {testimonial.course}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 bg-card/50 backdrop-blur border border-border rounded-2xl p-8"
        >
          {[
            { number: "10,000+", label: "Riders Trained" },
            { number: "15+", label: "Years Experience" },
            { number: "98%", label: "Pass Rate" },
            { number: "4.9/5", label: "Average Rating" }
          ].map((stat, index) => (
            <div key={index} className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-gradient">{stat.number}</p>
              <p className="text-muted-foreground text-sm mt-1">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Testimonials;

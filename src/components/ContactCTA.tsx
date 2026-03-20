import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Phone, Mail, Calendar, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const ContactCTA = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-background to-background" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-accent/10 rounded-full blur-3xl" />
      
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center"
        >
          <span className="text-accent font-semibold tracking-wider uppercase text-sm">
            Get Started Today
          </span>
          <h2 className="text-4xl md:text-6xl font-bold mt-4 mb-6">
            Ready to <span className="text-gradient">Hit the Road?</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Take the first step toward motorcycle freedom. Our friendly team is here to 
            answer your questions and help you find the perfect course.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link to="/choose-course">
              <Button size="lg" className="hero group text-lg px-8">
                <Calendar className="w-5 h-5 mr-2" />
                Book Your Course
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="lg" variant="heroOutline" className="text-lg px-8">
                <Phone className="w-5 h-5 mr-2" />
                Contact Us
              </Button>
            </Link>
          </div>

          {/* Contact cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <motion.a
              href="tel:+17604038091"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
              className="flex items-center gap-4 bg-card/80 backdrop-blur border border-border rounded-xl p-6 hover:border-accent/50 transition-all group"
            >
              <div className="w-14 h-14 bg-accent/10 rounded-xl flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                <Phone className="w-6 h-6 text-accent" />
              </div>
              <div className="text-left">
                <p className="text-sm text-muted-foreground">Call or Text</p>
                <p className="text-lg font-semibold text-foreground">(760) 403-8091</p>
              </div>
            </motion.a>

            <motion.a
              href="mailto:info@learntoridevc.com"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              viewport={{ once: true }}
              className="flex items-center gap-4 bg-card/80 backdrop-blur border border-border rounded-xl p-6 hover:border-accent/50 transition-all group"
            >
              <div className="w-14 h-14 bg-accent/10 rounded-xl flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                <Mail className="w-6 h-6 text-accent" />
              </div>
              <div className="text-left">
                <p className="text-sm text-muted-foreground">Email Us</p>
                <p className="text-lg font-semibold text-foreground">info@learntoridevc.com</p>
              </div>
            </motion.a>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ContactCTA;

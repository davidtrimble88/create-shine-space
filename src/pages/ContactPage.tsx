import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Phone, Mail, MapPin, Clock, Instagram, Facebook } from "lucide-react";

const contactMethods = [
  {
    icon: Phone,
    label: "Phone / Text",
    value: "(760) 403-8091",
    href: "tel:+17604038091",
    description: "Call or text us anytime for questions about courses and scheduling.",
  },
  {
    icon: Mail,
    label: "Email",
    value: "office@learntoridevc.com",
    href: "mailto:office@learntoridevc.com",
    description: "Send us an email and we'll get back to you within 24 hours.",
  },
];

const locations = [
  {
    name: "High Desert",
    area: "Hesperia & Wrightwood, CA",
    hours: "Sat-Sun: 7:00 AM - 5:00 PM",
    note: "Training site rotates based on seasonal weather conditions.",
  },
  {
    name: "Ventura County",
    area: "Somis, CA",
    hours: "Sat-Sun: 7:00 AM - 5:00 PM",
    note: "Coastal location with year-round riding conditions.",
  },
];

const socialLinks = [
  {
    icon: Instagram,
    name: "Instagram",
    href: "https://www.instagram.com/learntoridevc/",
    handle: "@learntoridevc",
  },
  {
    icon: Facebook,
    name: "Facebook",
    href: "https://www.facebook.com/people/Learn-to-Ride-VC/100063684781788/",
    handle: "Learn to Ride VC",
  },
];

const ContactPage = () => {
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
            <span className="text-accent font-semibold tracking-wider uppercase text-sm">
              Get In Touch
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mt-4 mb-4">
              Contact <span className="text-accent">Us</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Have questions? We're here to help you start your riding journey.
            </p>
          </motion.div>

          {/* Contact Methods */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-16">
            {contactMethods.map((method, i) => {
              const Icon = method.icon;
              return (
                <motion.a
                  key={method.label}
                  href={method.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="bg-card border border-border rounded-2xl p-8 hover:border-accent/50 transition-all group"
                >
                  <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-accent/20 transition-colors">
                    <Icon className="w-7 h-7 text-accent" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{method.label}</p>
                  <p className="text-xl font-bold text-foreground mb-2">{method.value}</p>
                  <p className="text-sm text-muted-foreground">{method.description}</p>
                </motion.a>
              );
            })}
          </div>

          {/* Locations */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="max-w-4xl mx-auto mb-16"
          >
            <h2 className="text-2xl font-bold text-foreground mb-6 text-center">
              Training <span className="text-accent">Locations</span>
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {locations.map((loc, i) => (
                <div
                  key={loc.name}
                  className="bg-card border border-border rounded-2xl p-8"
                >
                  <h3 className="text-lg font-bold text-foreground mb-3">{loc.name}</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-accent flex-shrink-0" />
                      <span className="text-foreground text-sm">{loc.area}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-accent flex-shrink-0" />
                      <span className="text-foreground text-sm">{loc.hours}</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">{loc.note}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Social Media */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="max-w-4xl mx-auto"
          >
            <h2 className="text-2xl font-bold text-foreground mb-6 text-center">
              Follow <span className="text-accent">Us</span>
            </h2>
            <div className="flex flex-wrap justify-center gap-6">
              {socialLinks.map((social, i) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-card border border-border rounded-2xl p-6 hover:border-accent/50 transition-all group flex items-center gap-4"
                  >
                    <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center group-hover:bg-accent/20 transition-colors flex-shrink-0">
                      <Icon className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{social.name}</p>
                      <p className="text-sm text-muted-foreground">{social.handle}</p>
                    </div>
                  </a>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ContactPage;

import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EditableText from "@/components/EditableText";
import { Phone, Mail, MapPin, Clock, Instagram, Facebook } from "lucide-react";

const contactMethods = [
  {
    icon: Phone,
    keyPrefix: "contact.method.vc",
    label: "Ventura County",
    value: "(805) 827-0075",
    href: "tel:+18058270075",
    description: "Call or text for Ventura County courses and scheduling.",
  },
  {
    icon: Phone,
    keyPrefix: "contact.method.hd",
    label: "High Desert",
    value: "(760) 987-6652",
    href: "tel:+17609876652",
    description: "Call or text for High Desert courses and scheduling.",
  },
  {
    icon: Mail,
    keyPrefix: "contact.method.email",
    label: "Email",
    value: "office@learntoridevc.com",
    href: "mailto:office@learntoridevc.com",
    description: "Send us an email and we'll get back to you within 24 hours.",
  },
];

const locations = [
  {
    keyPrefix: "contact.loc.hd",
    name: "High Desert",
    area: "Hesperia & Wrightwood, CA",
    hours: "Sat-Sun: 7:00 AM - 5:00 PM",
    note: "Training site rotates based on seasonal weather conditions.",
  },
  {
    keyPrefix: "contact.loc.vc",
    name: "Ventura County",
    area: "Somis, CA",
    hours: "Sat-Sun: 7:00 AM - 5:00 PM",
    note: "Coastal location with year-round riding conditions.",
  },
];

const socialLinks = [
  {
    icon: Instagram,
    keyPrefix: "contact.social.ig",
    name: "Instagram",
    href: "https://www.instagram.com/learntoridevc/",
    handle: "@learntoridevc",
  },
  {
    icon: Facebook,
    keyPrefix: "contact.social.fb",
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
              <EditableText contentKey="contact.hero.label" fallback="Get In Touch" />
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mt-4 mb-4">
              <EditableText contentKey="contact.hero.title.a" fallback="Contact" /> <span className="text-accent"><EditableText contentKey="contact.hero.title.b" fallback="Us" /></span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              <EditableText contentKey="contact.hero.subtitle" fallback="Have questions? We're here to help you start your riding journey." multiline />
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
                  <p className="text-sm text-muted-foreground mb-1">
                    <EditableText contentKey={`${method.keyPrefix}.label`} fallback={method.label} />
                  </p>
                  <p className="text-xl font-bold text-foreground mb-2">
                    <EditableText contentKey={`${method.keyPrefix}.value`} fallback={method.value} />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <EditableText contentKey={`${method.keyPrefix}.desc`} fallback={method.description} multiline />
                  </p>
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
              <EditableText contentKey="contact.locations.title.a" fallback="Training" /> <span className="text-accent"><EditableText contentKey="contact.locations.title.b" fallback="Locations" /></span>
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {locations.map((loc) => (
                <div
                  key={loc.name}
                  className="bg-card border border-border rounded-2xl p-8"
                >
                  <h3 className="text-lg font-bold text-foreground mb-3">
                    <EditableText contentKey={`${loc.keyPrefix}.name`} fallback={loc.name} />
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-accent flex-shrink-0" />
                      <span className="text-foreground text-sm">
                        <EditableText contentKey={`${loc.keyPrefix}.area`} fallback={loc.area} />
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-accent flex-shrink-0" />
                      <span className="text-foreground text-sm">
                        <EditableText contentKey={`${loc.keyPrefix}.hours`} fallback={loc.hours} />
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">
                    <EditableText contentKey={`${loc.keyPrefix}.note`} fallback={loc.note} multiline />
                  </p>
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
              <EditableText contentKey="contact.social.title.a" fallback="Follow" /> <span className="text-accent"><EditableText contentKey="contact.social.title.b" fallback="Us" /></span>
            </h2>
            <div className="flex flex-wrap justify-center gap-6">
              {socialLinks.map((social) => {
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
                      <p className="font-semibold text-foreground">
                        <EditableText contentKey={`${social.keyPrefix}.name`} fallback={social.name} />
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <EditableText contentKey={`${social.keyPrefix}.handle`} fallback={social.handle} />
                      </p>
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

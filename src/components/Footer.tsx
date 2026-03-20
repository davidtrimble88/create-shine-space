import { motion } from "framer-motion";
import { Facebook, Instagram, MapPin, Phone, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import cmspLogo from "@/assets/cmsp-logo.png";
import logo from "@/assets/logo.png";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-4 gap-12">
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="md:col-span-1"
          >
            <img src={logo} alt="Learn to Ride VC" className="h-16 mb-4" />
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              California's premier motorcycle training school. CMSP certified instruction 
              for riders of all skill levels.
            </p>
            <div className="flex gap-4">
              <a href="https://www.facebook.com/people/Learn-to-Ride-VC/100063684781788/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center hover:bg-accent/20 hover:text-accent transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="https://www.instagram.com/learntoridevc/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center hover:bg-accent/20 hover:text-accent transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
            </div>
          </motion.div>

          {/* Quick Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
          >
            <h4 className="font-semibold text-foreground mb-4">Quick Links</h4>
            <ul className="space-y-3">
              {[
                { name: "Home", href: "/" },
                { name: "Courses", href: "/#courses" },
                { name: "Locations", href: "/#locations" },
                { name: "About Us", href: "/about" },
                { name: "Contact", href: "/contact" },
              ].map((link) => (
                <li key={link.name}>
                  <a href={link.href} className="text-muted-foreground hover:text-accent transition-colors text-sm">
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Courses */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <h4 className="font-semibold text-foreground mb-4">Our Courses</h4>
            <ul className="space-y-3">
              {[
                { name: "Basic Rider Course", link: "/courses?tab=basic" },
                { name: "Intermediate Course", link: "/courses?tab=intermediate" },
                { name: "Advanced Riding Clinic", link: "/courses?tab=advanced" },
              ].map((course) => (
                <li key={course.name}>
                  <a href={course.link} className="text-muted-foreground hover:text-accent transition-colors text-sm">
                    {course.name}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Contact */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            viewport={{ once: true }}
          >
            <h4 className="font-semibold text-foreground mb-4">Contact Us</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-accent mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone / Text</p>
                  <a href="tel:+17604038091" className="text-foreground hover:text-accent transition-colors">
                    (760) 403-8091
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-accent mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <a href="mailto:info@learntoridevc.com" className="text-foreground hover:text-accent transition-colors">
                    info@learntoridevc.com
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-accent mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Locations</p>
                  <p className="text-foreground">High Desert & Ventura County</p>
                </div>
              </li>
            </ul>
          </motion.div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © {currentYear} Learn to Ride VC. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link to="/privacy-policy" className="text-sm text-muted-foreground hover:text-accent transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms-of-service" className="text-sm text-muted-foreground hover:text-accent transition-colors">
                Terms of Service
              </Link>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-sm text-muted-foreground">CMSP Certified</span>
              <img 
                src={cmspLogo}
                alt="California Motorcyclist Safety Program" 
                className="h-16"
              />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

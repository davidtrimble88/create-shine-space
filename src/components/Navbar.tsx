import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Phone } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

const navLinks = [
  { name: "Home", href: "/", isRoute: true },
  { name: "Courses", href: "/courses", isRoute: true },
  { name: "Locations", href: "/choose-location", isRoute: true },
  { name: "About", href: "/about", isRoute: true },
  { name: "Contact", href: "/contact", isRoute: true },
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleHomeClick = (e: React.MouseEvent) => {
    if (location.pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate("/");
    }
  };

  const NavItem = ({ link, className, onClick }: { link: typeof navLinks[0]; className?: string; onClick?: () => void }) => {
    if (link.href === "/") {
      return (
        <a href="/" className={className} onClick={(e) => { handleHomeClick(e); onClick?.(); }}>
          {link.name}
        </a>
      );
    }
    if (link.isRoute) {
      return (
        <Link to={link.href} className={className} onClick={onClick}>
          {link.name}
        </Link>
      );
    }
    return (
      <a href={link.href} className={className} onClick={onClick}>
        {link.name}
      </a>
    );
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          <a href="/" onClick={handleHomeClick} className="flex items-center">
            <img src={logo} alt="Learn to Ride VC" className="h-14 w-auto" />
          </a>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <NavItem
                key={link.name}
                link={link}
                className="text-muted-foreground hover:text-foreground transition-colors font-medium"
              />
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <a href="tel:+18058270075" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <Phone className="w-4 h-4" />
              <span>(805) 827-0075</span>
            </a>
            <Link to="/choose-course"><Button variant="hero">Book Now</Button></Link>
          </div>

          <button className="md:hidden p-2" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-card border-b border-border"
          >
            <div className="container mx-auto px-4 py-6 space-y-4">
              {navLinks.map((link) => (
                <NavItem
                  key={link.name}
                  link={link}
                  className="block text-foreground hover:text-accent transition-colors font-medium py-2"
                  onClick={() => setIsOpen(false)}
                />
              ))}
              <Link to="/choose-course"><Button variant="hero" className="w-full mt-4">Book Now</Button></Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;

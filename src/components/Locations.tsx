import { motion } from "framer-motion";
import { MapPin, Phone, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const locations = [
  {
    name: "High Desert — Hesperia & Wrightwood",
    address: "Hesperia & Wrightwood, CA",
    phone: "(760) 403-8091",
    hours: "Sat-Sun: 7:00 AM - 5:00 PM",
    mapLink: "https://maps.google.com/?q=Hesperia,CA",
    description: "Training site rotates between Hesperia and Wrightwood based on seasonal weather conditions.",
  },
  {
    name: "Ventura County",
    address: "Somis, CA",
    phone: "(760) 403-8091",
    hours: "Sat-Sun: 7:00 AM - 5:00 PM",
    mapLink: "https://maps.google.com/?q=Somis,CA",
    description: "Coastal location with perfect riding conditions and scenic surroundings.",
  },
];

const Locations = () => {
  return (
    <section className="py-24 bg-card" id="locations">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-accent font-semibold tracking-wider uppercase text-sm">
            Our Locations
          </span>
          <h2 className="text-4xl md:text-5xl font-bold mt-4 mb-6">
            Train <span className="text-accent">Near You</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Two convenient locations serving Southern California riders
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {locations.map((location, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-background border border-border rounded-2xl p-8 hover:border-accent/50 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">{location.name}</h3>
                  <p className="text-muted-foreground">{location.description}</p>
                </div>
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-accent" />
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-accent" />
                  <span className="text-foreground">{location.address}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-accent" />
                  <a href={`tel:${location.phone.replace(/[^0-9]/g, '')}`} className="text-foreground hover:text-accent transition-colors">
                    {location.phone}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-accent" />
                  <span className="text-foreground">{location.hours}</span>
                </div>
              </div>

              <Button variant="heroOutline" className="w-full group" asChild>
                <a href="/choose-course">
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Book Now
                </a>
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Locations;

import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { MapPin, ArrowRight, Mountain, Waves } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

const locations = [
  {
    id: "high-desert",
    icon: Mountain,
    name: "High Desert",
    area: "Hesperia & Wrightwood, CA",
    description:
      "Training site rotates between Hesperia and Wrightwood based on seasonal weather conditions. Wide open terrain perfect for learning.",
    highlights: ["Weekend classes", "Spacious training grounds", "Mountain scenery"],
  },
  {
    id: "ventura-county",
    icon: Waves,
    name: "Ventura County",
    area: "Somis, CA",
    description:
      "Coastal location with perfect riding conditions and scenic surroundings year-round.",
    highlights: ["Weekend classes", "Coastal climate", "Easy freeway access"],
  },
];

const ChooseLocationPage = () => {
  const [searchParams] = useSearchParams();
  const course = searchParams.get("course") || "basic";
  const filteredLocations = course === "basic" ? locations : locations.filter(l => l.id === "ventura-county");

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
            <span className="inline-block bg-accent/20 text-accent font-bold px-4 py-2 rounded-full text-sm mb-6 border border-accent/30">
              Step 2 of 4
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Choose Your <span className="text-accent">Location</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Select the training location nearest to you.
            </p>
          </motion.div>

          <div className={`grid ${filteredLocations.length > 1 ? 'md:grid-cols-2' : 'md:grid-cols-1 max-w-lg'} gap-8 max-w-4xl mx-auto`}>
            {filteredLocations.map((loc, i) => {
              const Icon = loc.icon;
              return (
                <motion.div
                  key={loc.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <Link to={`/choose-schedule?course=${course}&location=${loc.id}`} className="block h-full">
                    <div className="relative h-full bg-gradient-to-b from-accent/20 to-accent/5 border border-accent/30 rounded-2xl p-8 hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10 transition-all duration-300 group cursor-pointer">
                      <div className="w-14 h-14 rounded-2xl bg-accent/15 flex items-center justify-center mb-5 group-hover:bg-accent/25 transition-colors">
                        <Icon className="w-7 h-7 text-accent" />
                      </div>

                      <h2 className="text-2xl font-bold text-foreground mb-1">{loc.name}</h2>
                      <p className="text-sm text-muted-foreground mb-4 flex items-center gap-1">
                        <MapPin className="w-4 h-4 text-accent" />
                        {loc.area}
                      </p>

                      <p className="text-sm text-foreground/80 leading-relaxed mb-6">
                        {loc.description}
                      </p>

                      <ul className="space-y-2 mb-8">
                        {loc.highlights.map((h, j) => (
                          <li key={j} className="flex items-center gap-2 text-sm text-foreground/85">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                            {h}
                          </li>
                        ))}
                      </ul>

                      <span className="flex items-center gap-1 text-sm text-accent font-medium group-hover:translate-x-1 transition-transform">
                        Select Location <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ChooseLocationPage;

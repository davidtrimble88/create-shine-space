import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CalendarDays } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const ChooseSchedulePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const course = searchParams.get("course") || "basic";
  const location = searchParams.get("location") || "ventura-county";

  const courseLabels: Record<string, string> = {
    basic: "Basic Riding Course",
    intermediate: "Intermediate Course",
    advanced: "Advanced Riding Clinic",
  };

  const locationLabels: Record<string, string> = {
    "high-desert": "High Desert — Hesperia & Wrightwood",
    "ventura-county": "Ventura County — Somis",
  };

  const handleTempScheduleSelect = () => {
    navigate(`/register?course=${course}&location=${location}&schedule=2026-04-04`);
  };

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
              Step 3 of 4
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Pick Your <span className="text-accent">Schedule</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-2">
              Select a class date for your course.
            </p>
            <p className="text-sm text-muted-foreground">
              {courseLabels[course] || course} · {locationLabels[location] || location}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="max-w-2xl mx-auto"
          >
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <CalendarDays className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Schedule Coming Soon</h2>
              <p className="text-muted-foreground mb-6">
                Available class dates will be listed here. In the meantime, contact us to reserve your spot.
              </p>
              <a
                href="tel:+17604038091"
                className="text-accent hover:underline font-medium"
              >
                Call (760) 403-8091
              </a>
              <div className="mt-8 pt-6 border-t border-border">
                <p className="text-xs text-muted-foreground mb-3 italic">Temporary — for testing only</p>
                <Button variant="hero" size="lg" onClick={handleTempScheduleSelect}>
                  Simulate Schedule Selection →
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ChooseSchedulePage;

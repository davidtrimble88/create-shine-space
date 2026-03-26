import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CalendarDays, Clock, MapPin, Users, ArrowRight, Loader2 } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Schedule = Tables<"schedules">;

const ChooseSchedulePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const course = searchParams.get("course") || "basic";
  const location = searchParams.get("location") || "ventura-county";
  const [classes, setClasses] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  const courseLabels: Record<string, string> = {
    basic: "Motorcycle Training Course",
    intermediate: "Intermediate Course",
    advanced: "Advanced Riding Clinic",
  };

  const locationLabels: Record<string, string> = {
    "high-desert": "High Desert — Hesperia & Wrightwood",
    "ventura-county": "Ventura County — Somis",
  };

  useEffect(() => {
    const fetchClasses = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("schedules")
        .select("*")
        .eq("course", course)
        .eq("location", location)
        .gte("date", today)
        .order("date", { ascending: true });
      setClasses(data ?? []);
      setLoading(false);
    };
    fetchClasses();
  }, [course, location]);

  const handleSelectClass = (classId: string) => {
    sessionStorage.setItem("selectedScheduleId", classId);
    navigate(`/register?course=${course}&location=${location}`);
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

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : classes.length > 0 ? (
            <div className="max-w-3xl mx-auto space-y-4">
              {classes.map((entry, i) => {
                const dateObj = parseISO(entry.date);
                const isFull = entry.spots_available === 0;

                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.08 }}
                    className={`relative border rounded-2xl p-6 transition-all duration-300 ${
                      isFull
                        ? "border-border bg-card/50 opacity-60"
                        : "border-accent/30 bg-gradient-to-r from-accent/10 to-accent/5 hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10 cursor-pointer"
                    }`}
                    onClick={() => !isFull && handleSelectClass(entry.id)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
                            <CalendarDays className="w-6 h-6 text-accent" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-foreground">
                              {format(dateObj, "EEEE, MMMM d, yyyy")}
                            </h3>
                            {entry.group_name && (
                              <span className="text-xs font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                                {entry.group_name}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-accent" />
                            {entry.schedule}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-accent" />
                            {entry.location_label}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className="text-lg font-bold text-foreground">{entry.price}</span>
                        {isFull ? (
                          <span className="text-sm font-semibold text-destructive bg-destructive/10 px-3 py-1 rounded-full">
                            Class Full
                          </span>
                        ) : (
                          <>
                            <span className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Users className="w-4 h-4 text-accent" />
                              {entry.spots_available} spots left
                            </span>
                            <span className="flex items-center gap-1 text-sm text-accent font-medium">
                              Select <ArrowRight className="w-4 h-4" />
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
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
                <h2 className="text-xl font-bold text-foreground mb-2">No Classes Scheduled</h2>
                <p className="text-muted-foreground mb-6">
                  There are currently no upcoming classes for this course and location. Contact us to learn about future availability.
                </p>
                <a href="tel:+17604038091" className="text-accent hover:underline font-medium">
                  Call (760) 403-8091
                </a>
              </div>
            </motion.div>
          )}

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center text-sm text-muted-foreground mt-10"
          >
            Need help choosing?{" "}
            <a href="tel:+17604038091" className="text-accent hover:underline font-medium">
              Call us at (760) 403-8091
            </a>
          </motion.p>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ChooseSchedulePage;

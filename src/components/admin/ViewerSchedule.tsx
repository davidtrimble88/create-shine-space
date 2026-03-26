import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Clock, MapPin, Hand, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Schedule = Tables<"schedules">;

const courseLabels: Record<string, string> = {
  basic: "Basic Rider Course",
  intermediate: "Intermediate Course",
  advanced: "Advanced Riding Clinic",
};

const ViewerSchedule = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [myAvailability, setMyAvailability] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [filterLocation, setFilterLocation] = useState<string>("all");

  const fetchData = async () => {
    const today = new Date().toISOString().split("T")[0];

    const [schedRes, availRes] = await Promise.all([
      supabase.from("schedules").select("*").gte("date", today).order("date", { ascending: true }),
      user
        ? supabase.from("instructor_availability").select("schedule_id").eq("user_id", user.id)
        : Promise.resolve({ data: [] }),
    ]);

    setSchedules(schedRes.data ?? []);
    setMyAvailability(new Set((availRes.data ?? []).map((a: any) => a.schedule_id)));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const toggleAvailability = async (scheduleId: string) => {
    if (!user) return;
    setToggling(scheduleId);

    if (myAvailability.has(scheduleId)) {
      const { error } = await supabase
        .from("instructor_availability")
        .delete()
        .eq("schedule_id", scheduleId)
        .eq("user_id", user.id);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setMyAvailability(prev => {
          const next = new Set(prev);
          next.delete(scheduleId);
          return next;
        });
        toast({ title: "Removed", description: "You've removed your availability for this class." });
      }
    } else {
      const { error } = await supabase
        .from("instructor_availability")
        .insert({ schedule_id: scheduleId, user_id: user.id });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setMyAvailability(prev => new Set(prev).add(scheduleId));
        toast({ title: "Submitted!", description: "Your availability has been noted. A manager will follow up." });
      }
    }

    setToggling(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Upcoming Classes</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review the schedule and mark which classes you're available to teach.
        </p>
      </div>

      <div className="flex gap-4 mb-6">
        <Select value={filterLocation} onValueChange={setFilterLocation}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All Locations" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            <SelectItem value="high-desert">High Desert — Hesperia</SelectItem>
            <SelectItem value="ventura-county">Ventura County — Somis</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(() => {
        const filtered = filterLocation === "all" ? schedules : schedules.filter(s => s.location === filterLocation);
        return filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No upcoming classes found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const dateObj = parseISO(s.date);
            const isAvailable = myAvailability.has(s.id);
            const isToggling = toggling === s.id;

            return (
              <div
                key={s.id}
                className={`border rounded-xl p-5 transition-all ${
                  isAvailable
                    ? "border-green-500/40 bg-green-500/5"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isAvailable ? "bg-green-500/15" : "bg-accent/15"
                      }`}>
                        <CalendarDays className={`w-5 h-5 ${isAvailable ? "text-green-400" : "text-accent"}`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground">
                          {format(dateObj, "EEEE, MMMM d, yyyy")}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            s.course === "basic" ? "bg-accent/10 text-accent" :
                            s.course === "intermediate" ? "bg-blue-500/10 text-blue-400" :
                            "bg-purple-500/10 text-purple-400"
                          }`}>
                            {courseLabels[s.course] || s.course}
                          </span>
                          {s.group_name && (
                            <span className="text-xs text-muted-foreground">{s.group_name}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground ml-13">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-accent" />
                        {s.schedule}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-accent" />
                        {s.location_label}
                      </span>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <Button
                      variant={isAvailable ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleAvailability(s.id)}
                      disabled={isToggling}
                      className={isAvailable
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : ""
                      }
                    >
                      {isToggling ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : isAvailable ? (
                        <Check className="w-4 h-4 mr-2" />
                      ) : (
                        <Hand className="w-4 h-4 mr-2" />
                      )}
                      {isAvailable ? "I'm Available" : "Mark Available"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
      })()}
    </div>
  );
};

export default ViewerSchedule;

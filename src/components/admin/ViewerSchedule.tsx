import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Clock, MapPin, Hand, Check, Loader2, CalendarPlus, X, History, ArrowLeft, Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, parseISO, addDays } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import { useDefaultLocation } from "@/lib/defaultLocation";

type Schedule = Tables<"schedules">;

const courseLabels: Record<string, string> = {
  basic: "Motorcycle Training Course",
  intermediate: "Intermediate Course",
  advanced: "Advanced Riding Clinic",
};

const locationOptions = [
  { value: "high-desert-hesperia", label: "High Desert — Hesperia" },
  { value: "high-desert-wrightwood", label: "High Desert — Wrightwood" },
  { value: "ventura-county", label: "Ventura County — Somis" },
];

// Placeholder cards are generated per location per week using each location's actual
// class day pattern. Instructors can then mark availability for each individual day.
// Day numbers use JS getDay(): Sun=0, Wed=3, Fri=5, Sat=6.
const placeholderLocationOptions = [
  { value: "high-desert-hesperia", label: "High Desert — Hesperia", filterKey: "high-desert-hesperia", days: [3, 6, 0] },
  { value: "high-desert-wrightwood", label: "High Desert — Wrightwood", filterKey: "high-desert-wrightwood", days: [6, 0] },
  { value: "ventura-county-a", label: "Ventura — Group A (Sat/Sun)", filterKey: "ventura-county", days: [6, 0] },
  { value: "ventura-county-b", label: "Ventura — Group B (Fri/Sat/Sun)", filterKey: "ventura-county", days: [5, 6, 0] },
];

type PlaceholderLocation = typeof placeholderLocationOptions[number];

interface PlaceholderEntry {
  type: "placeholder";
  date: Date;
  dates: Date[];
  dateStr: string;
  location: PlaceholderLocation;
}

interface ScheduleEntry {
  type: "schedule";
  data: Schedule;
}

type DisplayEntry = PlaceholderEntry | ScheduleEntry;


const ViewerSchedule = () => {
  const { user, effectiveRole } = useAuth();
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [myAvailability, setMyAvailability] = useState<Map<string, string[] | null>>(new Map());
  const [myDateAvailability, setMyDateAvailability] = useState<Map<string, Set<string>>>(new Map());
  const [dismissedDates, setDismissedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [view, setView] = useState<"upcoming" | "past">("upcoming");
  const { defaultLocation, setDefaultLocation, loaded: prefLoaded } = useDefaultLocation();
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (prefLoaded && !initialized) {
      if (defaultLocation && defaultLocation !== "all") setFilterLocation(defaultLocation);
      setInitialized(true);
    }
  }, [prefLoaded, defaultLocation, initialized]);

  const canDismiss = effectiveRole === "owner" || effectiveRole === "admin";
  const canViewPast = effectiveRole !== "employee";

  const fetchData = async () => {
    const today = new Date().toISOString().split("T")[0];

    const schedQueryBuilder = supabase.from("schedules").select("*");
    const schedPromise = view === "past"
      ? schedQueryBuilder.lt("date", today).order("date", { ascending: false })
      : schedQueryBuilder.gte("date", today).is("cancelled_at", null).order("date", { ascending: true });

    const [schedRes, dismissedRes] = await Promise.all([
      schedPromise,
      (supabase as any).from("dismissed_weekends").select("date").gte("date", today),
    ]);

    let availData: any[] = [];
    let dateAvailData: any[] = [];

    if (user) {
      const [availRes, dateAvailRes] = await Promise.all([
        (supabase as any).from("instructor_availability").select("schedule_id, parts").eq("user_id", user.id),
        (supabase as any).from("instructor_date_availability").select("date, location").eq("user_id", user.id).gte("date", today),
      ]);
      availData = availRes.data ?? [];
      dateAvailData = dateAvailRes.data ?? [];
    }

    setSchedules(schedRes.data ?? []);
    setDismissedDates(new Set((dismissedRes.data ?? []).map((d: any) => d.date)));
    const availMap = new Map<string, string[] | null>();
    availData.forEach((a: any) => availMap.set(a.schedule_id, a.parts ?? null));
    setMyAvailability(availMap);

    const dateMap = new Map<string, Set<string>>();
    dateAvailData.forEach((a: any) => {
      if (!dateMap.has(a.date)) dateMap.set(a.date, new Set());
      dateMap.get(a.date)!.add(a.location);
    });
    setMyDateAvailability(dateMap);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 300000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [user, view]);

  const setAvailability = async (scheduleId: string, parts: string[] | null) => {
    if (!user) return;
    setToggling(scheduleId);

    // Remove any existing row, then insert fresh (simplest upsert without unique constraint assumptions)
    const { error: delErr } = await supabase
      .from("instructor_availability")
      .delete()
      .eq("schedule_id", scheduleId)
      .eq("user_id", user.id);

    if (delErr) {
      toast({ title: "Error", description: delErr.message, variant: "destructive" });
      setToggling(null);
      return;
    }

    const { error } = await (supabase as any)
      .from("instructor_availability")
      .insert({ schedule_id: scheduleId, user_id: user.id, parts });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setMyAvailability(prev => {
        const next = new Map(prev);
        next.set(scheduleId, parts);
        return next;
      });
      toast({ title: "Submitted!", description: parts === null ? "Marked available for full class." : `Marked available for ${parts.length} part(s).` });
    }
    setToggling(null);
  };

  const clearAvailability = async (scheduleId: string) => {
    if (!user) return;
    setToggling(scheduleId);
    const { error } = await supabase
      .from("instructor_availability")
      .delete()
      .eq("schedule_id", scheduleId)
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setMyAvailability(prev => {
        const next = new Map(prev);
        next.delete(scheduleId);
        return next;
      });
      toast({ title: "Removed", description: "Availability cleared for this class." });
    }
    setToggling(null);
  };

  const toggleDateAvailability = async (dateStr: string, location: string) => {
    if (!user) return;
    const key = `${dateStr}-${location}`;
    setToggling(key);

    const isAvailable = myDateAvailability.get(dateStr)?.has(location);

    if (isAvailable) {
      const { error } = await (supabase as any)
        .from("instructor_date_availability")
        .delete()
        .eq("user_id", user.id)
        .eq("date", dateStr)
        .eq("location", location);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setMyDateAvailability(prev => {
          const next = new Map(prev);
          const locs = new Set(next.get(dateStr) ?? []);
          locs.delete(location);
          if (locs.size === 0) next.delete(dateStr);
          else next.set(dateStr, locs);
          return next;
        });
        toast({ title: "Removed", description: "Availability removed for this date." });
      }
    } else {
      const { error } = await (supabase as any)
        .from("instructor_date_availability")
        .insert({ user_id: user.id, date: dateStr, location });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setMyDateAvailability(prev => {
          const next = new Map(prev);
          const locs = new Set(next.get(dateStr) ?? []);
          locs.add(location);
          next.set(dateStr, locs);
          return next;
        });
        toast({ title: "Submitted!", description: "Your availability has been noted." });
      }
    }

    setToggling(null);
  };

  const dismissWeekend = async (dates: Date[]) => {
    if (!user || !canDismiss) return;
    const dateStrs = dates.map(d => format(d, "yyyy-MM-dd"));
    const key = dateStrs.join(",");
    setDismissing(key);

    const rows = dateStrs.map(date => ({ date, dismissed_by: user.id }));
    const { error } = await (supabase as any)
      .from("dismissed_weekends")
      .upsert(rows, { onConflict: "date" });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setDismissedDates(prev => {
        const next = new Set(prev);
        dateStrs.forEach(d => next.add(d));
        return next;
      });
      toast({ title: "Dismissed", description: "Weekend removed from the list." });
    }

    setDismissing(null);
  };

  const generateWeekendPlaceholders = (): PlaceholderEntry[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = today.getMonth();
    const endDate = currentMonth === 11
      ? new Date(today.getFullYear() + 1, 5, 30)
      : new Date(today.getFullYear(), 11, 31);

    // Build per-location scheduled-date sets so a location's placeholder only hides
    // when that same location already has a class on one of the pattern days.
    const schedByLoc = new Map<string, Set<string>>();
    schedules.forEach(s => {
      if (!schedByLoc.has(s.location)) schedByLoc.set(s.location, new Set());
      schedByLoc.get(s.location)!.add(s.date);
    });

    // Enumerate Saturdays across the range as the anchor for each week.
    const saturdays: Date[] = [];
    const cursor = new Date(today);
    while (cursor.getDay() !== 6) cursor.setDate(cursor.getDate() + 1);
    while (cursor <= endDate) {
      saturdays.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 7);
    }

    // Offset from that week's Saturday for each supported class day.
    const dayOffsetsFromSat: Record<number, number> = { 3: -3, 5: -1, 6: 0, 0: 1 };

    const results: PlaceholderEntry[] = [];
    saturdays.forEach(sat => {
      placeholderLocationOptions.forEach(loc => {
        const dates = loc.days
          .map(d => {
            const dt = new Date(sat);
            dt.setDate(sat.getDate() + dayOffsetsFromSat[d]);
            dt.setHours(0, 0, 0, 0);
            return dt;
          })
          .filter(d => d >= today)
          .sort((a, b) => a.getTime() - b.getTime());
        if (dates.length === 0) return;

        const dateStrs = dates.map(d => format(d, "yyyy-MM-dd"));
        const locSchedDates = schedByLoc.get(loc.filterKey) ?? new Set();
        // Hide the placeholder if this location already has a real class on any of these days.
        if (dateStrs.some(ds => locSchedDates.has(ds))) return;
        // Hide if every day in the pattern has been dismissed.
        if (dateStrs.every(ds => dismissedDates.has(ds))) return;

        results.push({
          type: "placeholder",
          date: dates[0],
          dates,
          dateStr: `${format(sat, "yyyy-MM-dd")}-${loc.value}`,
          location: loc,
        });
      });
    });

    return results;
  };


  const buildDisplayList = (): DisplayEntry[] => {
    const scheduleEntries: ScheduleEntry[] = schedules.map(s => ({ type: "schedule", data: s }));
    // Past view: just show actual scheduled classes (no weekend placeholders)
    if (view === "past") {
      return scheduleEntries;
    }
    const placeholders = generateWeekendPlaceholders();
    const all: DisplayEntry[] = [...scheduleEntries, ...placeholders];

    all.sort((a, b) => {
      const dateA = a.type === "schedule" ? a.data.date : a.dateStr;
      const dateB = b.type === "schedule" ? b.data.date : b.dateStr;
      return dateA.localeCompare(dateB);
    });

    return all;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const displayList = buildDisplayList();
  const filtered = filterLocation === "all"
    ? displayList
    : displayList.filter(entry => {
        if (entry.type === "schedule") return entry.data.location === filterLocation;
        return entry.location.filterKey === filterLocation;
      });


  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {view === "past" ? "Past Classes" : "Upcoming Classes"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {view === "past"
              ? "Review classes that have already taken place."
              : "Review the schedule and mark which classes you're available to teach."}
          </p>
        </div>
        {canViewPast && (view === "upcoming" ? (
          <Button variant="outline" onClick={() => setView("past")}>
            <History className="w-4 h-4 mr-2" /> Past Classes
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setView("upcoming")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Upcoming
          </Button>
        ))}
      </div>

      <div className="flex gap-4 mb-6">
        <Select value={filterLocation} onValueChange={setFilterLocation}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All Locations" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            <SelectItem value="high-desert-hesperia">High Desert — Hesperia</SelectItem>
            <SelectItem value="high-desert-wrightwood">High Desert — Wrightwood</SelectItem>
            <SelectItem value="ventura-county">Ventura County — Somis</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No upcoming classes found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => {
            if (entry.type === "schedule") {
              const hasEntry = myAvailability.has(entry.data.id);
              const parts = myAvailability.get(entry.data.id) ?? null;
              return <ScheduleCard
                key={entry.data.id}
                schedule={entry.data}
                hasAvailability={hasEntry}
                selectedParts={parts}
                isToggling={toggling === entry.data.id}
                onSetAvailability={(p) => setAvailability(entry.data.id, p)}
                onClear={() => clearAvailability(entry.data.id)}
              />;
            } else {
              return <PlaceholderCard
                key={entry.dateStr}
                dates={entry.dates}
                location={entry.location}
                myDateAvailability={myDateAvailability}
                toggling={toggling}
                onToggle={toggleDateAvailability}
                canDismiss={canDismiss}
                isDismissing={dismissing === entry.dates.map(d => format(d, "yyyy-MM-dd")).join(",")}
                onDismiss={() => dismissWeekend(entry.dates)}
              />;
            }

          })}
        </div>
      )}
    </div>
  );
};

const parsePartsFromSchedule = (scheduleText: string): string[] => {
  return scheduleText
    .split(/[,;]|\s\|\s/)
    .map(s => s.trim())
    .filter(Boolean);
};

const DAY_ABBR_TO_NUM: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

const getPartDates = (startDate: string, scheduleText: string): { part: string; dateStr: string }[] => {
  const parts = parsePartsFromSchedule(scheduleText);
  const start = parseISO(startDate);
  const startDay = start.getDay();

  return parts.map(part => {
    const dayAbbr = part.trim().split(" ")[0];
    const targetDay = DAY_ABBR_TO_NUM[dayAbbr];
    if (targetDay === undefined) return { part, dateStr: "" };

    const offset = (targetDay - startDay + 7) % 7;
    const partDate = addDays(start, offset);
    return { part, dateStr: format(partDate, "EEE, MMM d") };
  });
};

const ScheduleCard = ({
  schedule: s,
  hasAvailability,
  selectedParts,
  isToggling,
  onSetAvailability,
  onClear,
}: {
  schedule: Schedule;
  hasAvailability: boolean;
  selectedParts: string[] | null;
  isToggling: boolean;
  onSetAvailability: (parts: string[] | null) => void;
  onClear: () => void;
}) => {
  const dateObj = parseISO(s.date);
  const parts = parsePartsFromSchedule(s.schedule);
  const hasMultipleParts = parts.length > 1;
  const isFullAvailable = hasAvailability && selectedParts === null;
  const isPartialAvailable = hasAvailability && Array.isArray(selectedParts);

  const [showPartialPicker, setShowPartialPicker] = useState(false);
  const [draftParts, setDraftParts] = useState<string[]>(selectedParts ?? []);

  useEffect(() => {
    setDraftParts(selectedParts ?? []);
  }, [selectedParts]);

  const togglePart = (p: string) => {
    setDraftParts(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const savePartial = () => {
    if (draftParts.length === 0) return;
    onSetAvailability(draftParts);
    setShowPartialPicker(false);
  };

  return (
    <div
      className={`border rounded-xl p-5 transition-all ${
        hasAvailability
          ? "border-green-500/40 bg-green-500/5"
          : "border-border bg-card"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
              hasAvailability ? "bg-green-500/15" : "bg-accent/15"
            }`}>
              <CalendarDays className={`w-5 h-5 ${hasAvailability ? "text-green-400" : "text-accent"}`} />
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

          {isPartialAvailable && selectedParts && selectedParts.length > 0 && (
            <div className="ml-13 mt-2 flex flex-wrap gap-1.5">
              <span className="text-xs text-muted-foreground">Available for:</span>
              {(() => {
                const partDates = getPartDates(s.date, s.schedule);
                return selectedParts.map(p => {
                  const match = partDates.find(pd => pd.part === p);
                  return (
                    <span key={p} className="text-xs bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full">
                      {match?.dateStr ? `${match.dateStr} — ` : ""}{p}
                    </span>
                  );
                });
              })()}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 flex-shrink-0 min-w-[200px]">
          <Button
            variant={isFullAvailable ? "default" : "outline"}
            size="sm"
            onClick={() => {
              if (isFullAvailable) onClear();
              else onSetAvailability(null);
              setShowPartialPicker(false);
            }}
            disabled={isToggling}
            className={isFullAvailable ? "bg-green-600 hover:bg-green-700 text-white" : ""}
          >
            {isToggling && isFullAvailable ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : isFullAvailable ? (
              <Check className="w-4 h-4 mr-2" />
            ) : (
              <Hand className="w-4 h-4 mr-2" />
            )}
            {isFullAvailable ? "Available — Full Class" : "Available for Full Class"}
          </Button>

          {hasMultipleParts && (
            <Button
              variant={isPartialAvailable ? "default" : "outline"}
              size="sm"
              onClick={() => {
                if (isPartialAvailable && !showPartialPicker) {
                  setShowPartialPicker(true);
                } else if (showPartialPicker) {
                  setShowPartialPicker(false);
                } else {
                  setShowPartialPicker(true);
                }
              }}
              disabled={isToggling}
              className={isPartialAvailable ? "bg-green-600 hover:bg-green-700 text-white" : ""}
            >
              {isPartialAvailable ? (
                <Check className="w-4 h-4 mr-2" />
              ) : (
                <Hand className="w-4 h-4 mr-2" />
              )}
              {isPartialAvailable ? "Available — Partial" : "Available for Partial"}
            </Button>
          )}
        </div>
      </div>

      {showPartialPicker && hasMultipleParts && (
        <div className="mt-4 ml-13 p-4 bg-background/50 border border-border rounded-lg">
          <p className="text-sm font-medium text-foreground mb-3">Select the parts you're available for:</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {(() => {
              const partDates = getPartDates(s.date, s.schedule);
              return partDates.map(({ part, dateStr }) => {
                const checked = draftParts.includes(part);
                return (
                  <button
                    key={part}
                    type="button"
                    onClick={() => togglePart(part)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      checked
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-card text-foreground border-border hover:border-accent/50"
                    }`}
                  >
                    {checked && <Check className="w-3 h-3 inline mr-1" />}
                    {dateStr ? `${dateStr} — ` : ""}{part}
                  </button>
                );
              });
            })()}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={savePartial}
              disabled={isToggling || draftParts.length === 0}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isToggling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Save Selection
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowPartialPicker(false);
                setDraftParts(selectedParts ?? []);
              }}
              disabled={isToggling}
            >
              Cancel
            </Button>
            {isPartialAvailable && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  onClear();
                  setShowPartialPicker(false);
                }}
                disabled={isToggling}
                className="text-destructive hover:text-destructive"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const PlaceholderCard = ({
  dates,
  location,
  myDateAvailability,
  toggling,
  onToggle,
  canDismiss,
  isDismissing,
  onDismiss,
}: {
  dates: Date[];
  location: { value: string; label: string };
  myDateAvailability: Map<string, Set<string>>;
  toggling: string | null;
  onToggle: (dateStr: string, location: string) => void;
  canDismiss: boolean;
  isDismissing: boolean;
  onDismiss: () => void;
}) => {
  const hasAnyAvailability = dates.some(d => {
    const ds = format(d, "yyyy-MM-dd");
    return myDateAvailability.get(ds)?.has(location.value);
  });

  const dateLabel = dates.length === 1
    ? format(dates[0], "EEEE, MMMM d, yyyy")
    : `${format(dates[0], "EEE, MMM d")} – ${format(dates[dates.length - 1], "EEE, MMM d, yyyy")}`;

  return (
    <div
      className={`border rounded-xl p-5 transition-all border-dashed ${
        hasAnyAvailability
          ? "border-green-500/30 bg-green-500/5"
          : "border-border/50 bg-card/50"
      }`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            hasAnyAvailability ? "bg-green-500/15" : "bg-muted/50"
          }`}>
            <CalendarPlus className={`w-5 h-5 ${hasAnyAvailability ? "text-green-400" : "text-muted-foreground"}`} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              {location.label}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{dateLabel}</p>
            <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              No class scheduled — pick the days you can teach
            </span>
          </div>
          {canDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              disabled={isDismissing}
              className="text-muted-foreground hover:text-destructive flex-shrink-0"
              title="Dismiss this week"
            >
              {isDismissing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <X className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 ml-13">
          {dates.map(d => {
            const dateStr = format(d, "yyyy-MM-dd");
            const dayLabel = format(d, "EEE, MMM d");
            const isAvail = myDateAvailability.get(dateStr)?.has(location.value) ?? false;
            const key = `${dateStr}-${location.value}`;
            const isToggling = toggling === key;

            return (
              <Button
                key={dateStr}
                variant={isAvail ? "default" : "outline"}
                size="sm"
                onClick={() => onToggle(dateStr, location.value)}
                disabled={isToggling}
                className={isAvail ? "bg-green-600 hover:bg-green-700 text-white" : ""}
              >
                {isToggling ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : isAvail ? (
                  <Check className="w-4 h-4 mr-2" />
                ) : (
                  <Hand className="w-4 h-4 mr-2" />
                )}
                {dayLabel}
                <span className="ml-1.5 opacity-80">
                  {isAvail ? "— Available" : "— Mark"}
                </span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
};


export default ViewerSchedule;

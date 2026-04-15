import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Users, CalendarDays, MapPin } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Schedule = Tables<"schedules">;
type Booking = Tables<"bookings">;

const courseLabels: Record<string, string> = {
  basic: "Motorcycle Training Course",
  intermediate: "Intermediate Course",
  advanced: "Advanced Riding Clinic",
};

const locationLabels: Record<string, string> = {
  "high-desert-hesperia": "High Desert — Hesperia",
  "high-desert-wrightwood": "High Desert — Wrightwood",
  "ventura-county": "Ventura County — Somis",
};

const ClassRosters = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [locationFilter, setLocationFilter] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSchedules = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("schedules")
        .select("*")
        .gte("date", today)
        .order("date");
      if (data) setSchedules(data);
    };
    fetchSchedules();
  }, []);

  useEffect(() => {
    if (!selectedScheduleId) {
      setBookings([]);
      return;
    }
    const fetchBookings = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("bookings")
        .select("*")
        .eq("schedule_id", selectedScheduleId)
        .order("last_name");
      if (data) setBookings(data);
      setLoading(false);
    };
    fetchBookings();
  }, [selectedScheduleId]);

  const selectedSchedule = schedules.find(s => s.id === selectedScheduleId);

  const filteredSchedules = schedules.filter(
    s => !locationFilter || locationFilter === "all" || s.location === locationFilter
  );

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Class Roster</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            .meta { font-size: 13px; color: #555; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; }
            th { background: #f3f3f3; font-weight: 600; }
            .count { font-size: 13px; margin-bottom: 12px; font-weight: 600; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          ${printRef.current.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Class Rosters</h1>
        {selectedSchedule && bookings.length > 0 && (
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> Print Roster
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Select value={locationFilter} onValueChange={v => { setLocationFilter(v); setSelectedScheduleId(""); }}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="All Locations" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {Object.entries(locationLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedScheduleId} onValueChange={setSelectedScheduleId}>
          <SelectTrigger className="w-[400px]"><SelectValue placeholder="Select a class to view roster" /></SelectTrigger>
          <SelectContent>
            {filteredSchedules.map(s => (
              <SelectItem key={s.id} value={s.id}>
                {s.date} — {courseLabels[s.course] || s.course} — {s.location_label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Roster */}
      {loading && <p className="text-muted-foreground">Loading roster...</p>}

      {selectedSchedule && !loading && (
        <>
          {/* On-screen display */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-4 mb-1">
              <h2 className="text-lg font-bold text-foreground">
                {courseLabels[selectedSchedule.course] || selectedSchedule.course}
              </h2>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
              <span className="flex items-center gap-1"><CalendarDays className="w-4 h-4" /> {selectedSchedule.date}</span>
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {selectedSchedule.location_label}</span>
              <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {bookings.length} student{bookings.length !== 1 ? "s" : ""} enrolled</span>
            </div>

            {bookings.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center">No students enrolled in this class yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="text-left p-3 font-medium text-muted-foreground">#</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Phone</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Gender</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">DOB</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b, i) => (
                      <tr key={b.id} className="border-b border-border/50 hover:bg-secondary/30">
                        <td className="p-3 text-muted-foreground">{i + 1}</td>
                        <td className="p-3 font-medium text-foreground">{b.last_name}, {b.first_name}</td>
                        <td className="p-3 text-muted-foreground">{b.email}</td>
                        <td className="p-3 text-muted-foreground">{b.phone}</td>
                        <td className="p-3 text-muted-foreground capitalize">{b.gender || "—"}</td>
                        <td className="p-3 text-muted-foreground">{b.date_of_birth || "—"}</td>
                        <td className="p-3">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                            b.payment_status === "paid" ? "bg-green-500/20 text-green-400" :
                            b.payment_status === "partial" ? "bg-yellow-500/20 text-yellow-400" :
                            "bg-red-500/20 text-red-400"
                          }`}>{b.payment_status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Hidden printable roster */}
          <div className="hidden">
            <div ref={printRef}>
              <h1>{courseLabels[selectedSchedule.course] || selectedSchedule.course}</h1>
              <div className="meta">
                {selectedSchedule.date} &nbsp;|&nbsp; {selectedSchedule.location_label} &nbsp;|&nbsp; Schedule: {selectedSchedule.schedule}
              </div>
              <div className="count">{bookings.length} Student{bookings.length !== 1 ? "s" : ""} Enrolled</div>
              {bookings.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Gender</th>
                      <th>DOB</th>
                      <th>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b, i) => (
                      <tr key={b.id}>
                        <td>{i + 1}</td>
                        <td>{b.last_name}, {b.first_name}</td>
                        <td>{b.email}</td>
                        <td>{b.phone}</td>
                        <td style={{ textTransform: "capitalize" }}>{b.gender || "—"}</td>
                        <td>{b.date_of_birth || "—"}</td>
                        <td>{b.payment_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {!selectedScheduleId && !loading && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Select a class above to view its roster.</p>
        </div>
      )}
    </div>
  );
};

export default ClassRosters;

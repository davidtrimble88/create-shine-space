import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Search } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Booking = Tables<"bookings">;
type Schedule = Tables<"schedules">;

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

const referralOptions = [
  "Google", "Learn To Ride VC Website", "Yelp", "Facebook", "Instagram",
  "Chopperfest", "Cal Coast Motorsports", "Word of Mouth / Friend", "DMV",
  "CHP", "Cycle Gear", "Ventura Fair", "Ventura Harley Davidson",
  "Thousand Oaks Powersports", "Santa Barbara Motorsports", "My Garage Ventura",
  "The Shop Ventura", "BBB (Better Business Bureau)", "Overland Outdoor Expo",
  "Phone Call", "Walk-in", "Other",
];

const AdminBookings = () => {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [form, setForm] = useState({
    schedule_id: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    gender: "",
    date_of_birth: "",
    referral_source: "",
    payment_status: "pending",
  });

  const fetchData = async () => {
    const today = new Date().toISOString().split("T")[0];
    const [bookRes, schedRes] = await Promise.all([
      supabase.from("bookings").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("schedules").select("*").gte("date", today).order("date"),
    ]);
    if (bookRes.data) setBookings(bookRes.data);
    if (schedRes.data) setSchedules(schedRes.data);
  };

  useEffect(() => { fetchData(); }, []);

  const selectedSchedule = schedules.find(s => s.id === form.schedule_id);

  const handleSubmit = async () => {
    if (!form.first_name || !form.last_name || !form.email || !form.phone || !form.schedule_id) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    const sched = schedules.find(s => s.id === form.schedule_id);
    if (!sched) return;

    const { error } = await supabase.from("bookings").insert({
      schedule_id: form.schedule_id,
      course: sched.course,
      location: sched.location,
      location_label: sched.location_label,
      schedule_date: sched.date,
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email,
      phone: form.phone,
      gender: form.gender || null,
      date_of_birth: form.date_of_birth || null,
      referral_source: form.referral_source || "Phone Call",
      fee: sched.price,
      payment_status: form.payment_status,
      booking_status: "confirmed",
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Student Added", description: `${form.first_name} ${form.last_name} has been booked.` });
      setForm({ schedule_id: "", first_name: "", last_name: "", email: "", phone: "", gender: "", date_of_birth: "", referral_source: "", payment_status: "pending" });
      setDialogOpen(false);
      fetchData();
    }
  };

  const filtered = bookings.filter(b =>
    `${b.first_name} ${b.last_name} ${b.email} ${b.course}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Bookings</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="w-4 h-4 mr-2" /> Add Student</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manually Add Student</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Location</Label>
                <Select value={locationFilter} onValueChange={v => { setLocationFilter(v); setForm(f => ({ ...f, schedule_id: "" })); }}>
                  <SelectTrigger><SelectValue placeholder="All locations" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {Object.entries(locationLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Class *</Label>
                <Select value={form.schedule_id} onValueChange={v => setForm(f => ({ ...f, schedule_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                  <SelectContent>
                    {schedules
                      .filter(s => !locationFilter || locationFilter === "all" || s.location === locationFilter)
                      .map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {courseLabels[s.course] || s.course} — {s.location_label} — {s.date} ({s.spots_available} spots)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSchedule && selectedSchedule.spots_available <= 0 && (
                  <p className="text-xs text-destructive mt-1">⚠ This class is full</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>First Name *</Label>
                  <Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
                </div>
                <div>
                  <Label>Last Name *</Label>
                  <Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <Label>Phone *</Label>
                <Input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Gender</Label>
                  <Select value={form.gender} onValueChange={v => setForm(f => ({ ...f, gender: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <Input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>How did they hear about us?</Label>
                <Select value={form.referral_source} onValueChange={v => setForm(f => ({ ...f, referral_source: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {referralOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Status</Label>
                <Select value={form.payment_status} onValueChange={v => setForm(f => ({ ...f, payment_status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSubmit} className="w-full">Add Student to Class</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search bookings..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Student</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Course</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Location</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Payment</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Referral</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No bookings found</td></tr>
              ) : filtered.map(b => (
                <tr key={b.id} className="border-b border-border/50 hover:bg-secondary/30">
                  <td className="p-3 font-medium text-foreground">{b.first_name} {b.last_name}<br /><span className="text-xs text-muted-foreground">{b.email}</span></td>
                  <td className="p-3 text-muted-foreground">{courseLabels[b.course] || b.course}</td>
                  <td className="p-3 text-muted-foreground">{b.location_label}</td>
                  <td className="p-3 text-muted-foreground">{b.schedule_date || "—"}</td>
                  <td className="p-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      b.payment_status === "paid" ? "bg-green-500/20 text-green-400" :
                      b.payment_status === "partial" ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-red-500/20 text-red-400"
                    }`}>{b.payment_status}</span>
                  </td>
                  <td className="p-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      b.booking_status === "confirmed" ? "bg-green-500/20 text-green-400" :
                      "bg-accent/20 text-accent"
                    }`}>{b.booking_status}</span>
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">{b.referral_source || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminBookings;

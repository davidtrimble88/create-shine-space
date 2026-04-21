import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Search, Eye, X, DollarSign, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
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

const FALLBACK_REFERRALS = [
  "Google", "Learn To Ride VC Website", "Yelp", "Facebook", "Instagram",
  "Word of Mouth / Friend", "Phone Call", "Walk-in", "Other",
];

const AdminBookings = () => {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [referralOptions, setReferralOptions] = useState<string[]>(FALLBACK_REFERRALS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [retestDialogOpen, setRetestDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [filterCourse, setFilterCourse] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [form, setForm] = useState({
    schedule_id: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    gender: "",
    date_of_birth: "",
    referral_source: "",
  });
  const [studentPaymentCollected, setStudentPaymentCollected] = useState(false);
  const [studentPaymentMethod, setStudentPaymentMethod] = useState("cash");
  const [retestForm, setRetestForm] = useState({
    schedule_id: "",
    first_name: "",
    last_name: "",
    phone: "",
    license_number: "",
    date_of_birth: "",
  });
  const [retestPaymentCollected, setRetestPaymentCollected] = useState(false);
  const [retestPaymentMethod, setRetestPaymentMethod] = useState("cash");

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
      payment_status: studentPaymentCollected ? "paid" : "unpaid",
      booking_status: "confirmed",
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Student Added", description: `${form.first_name} ${form.last_name} has been booked.` });
      setForm({ schedule_id: "", first_name: "", last_name: "", email: "", phone: "", gender: "", date_of_birth: "", referral_source: "" });
      setStudentPaymentCollected(false);
      setStudentPaymentMethod("cash");
      setDialogOpen(false);
      fetchData();
    }
  };

  const handleRetestSubmit = async () => {
    if (!retestForm.first_name || !retestForm.last_name || !retestForm.phone || !retestForm.schedule_id) {
      toast({ title: "Missing fields", description: "First name, last name, phone, and class are required.", variant: "destructive" });
      return;
    }
    const sched = schedules.find(s => s.id === retestForm.schedule_id);
    if (!sched) return;

    const { error } = await supabase.from("bookings").insert({
      schedule_id: retestForm.schedule_id,
      course: sched.course,
      location: sched.location,
      location_label: sched.location_label,
      schedule_date: sched.date,
      first_name: retestForm.first_name,
      last_name: retestForm.last_name,
      email: "retest@placeholder.com",
      phone: retestForm.phone,
      license_number: retestForm.license_number || null,
      date_of_birth: retestForm.date_of_birth || null,
      payment_status: retestPaymentCollected ? "paid" : "unpaid",
      booking_status: "confirmed",
      is_retest: true,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Retest Student Added", description: `${retestForm.first_name} ${retestForm.last_name} added for retest.` });
      setRetestForm({ schedule_id: "", first_name: "", last_name: "", phone: "", license_number: "", date_of_birth: "" });
      setRetestPaymentCollected(false);
      setRetestPaymentMethod("cash");
      setRetestDialogOpen(false);
      fetchData();
    }
  };

  const activeCourse = filterCourse && filterCourse !== "all" ? filterCourse : "";
  const activeLocation = filterLocation && filterLocation !== "all" ? filterLocation : "";
  const hasFilters = !!activeCourse || !!activeLocation || !!filterDate;

  type SortKey = "student" | "course" | "location" | "date" | "payment" | "status" | "referral";
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = bookings.filter(b => {
    if (search && !`${b.first_name} ${b.last_name} ${b.email} ${b.course}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (activeCourse && b.course !== activeCourse) return false;
    if (activeLocation && b.location !== activeLocation) return false;
    if (filterDate && b.schedule_date !== filterDate) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    const getVal = (row: Booking): string => {
      switch (sortKey) {
        case "student": return `${row.last_name} ${row.first_name}`.toLowerCase();
        case "course": return (courseLabels[row.course] || row.course).toLowerCase();
        case "location": return (row.location_label || "").toLowerCase();
        case "date": return row.schedule_date || "";
        case "payment": return row.payment_status || "";
        case "status": return row.booking_status || "";
        case "referral": return (row.referral_source || "").toLowerCase();
      }
    };
    const av = getVal(a);
    const bv = getVal(b);
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-accent" /> : <ArrowDown className="w-3 h-3 text-accent" />;
  };

  const clearFilters = () => {
    setFilterCourse("");
    setFilterLocation("");
    setFilterDate("");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Bookings</h1>
        <div className="flex items-center gap-2">
        <Dialog open={retestDialogOpen} onOpenChange={setRetestDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline"><UserPlus className="w-4 h-4 mr-2" /> Add Retest Student</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Retest Student</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Location</Label>
                <Select value={locationFilter} onValueChange={v => { setLocationFilter(v); setRetestForm(f => ({ ...f, schedule_id: "" })); }}>
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
                <Select value={retestForm.schedule_id} onValueChange={v => setRetestForm(f => ({ ...f, schedule_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                  <SelectContent>
                    {schedules
                      .filter(s => !locationFilter || locationFilter === "all" || s.location === locationFilter)
                      .map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {courseLabels[s.course] || s.course} — {s.location_label} — {s.date}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>First Name *</Label>
                  <Input value={retestForm.first_name} onChange={e => setRetestForm(f => ({ ...f, first_name: e.target.value }))} />
                </div>
                <div>
                  <Label>Last Name *</Label>
                  <Input value={retestForm.last_name} onChange={e => setRetestForm(f => ({ ...f, last_name: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Phone *</Label>
                <Input type="tel" value={retestForm.phone} onChange={e => setRetestForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>DL #</Label>
                  <Input value={retestForm.license_number} onChange={e => setRetestForm(f => ({ ...f, license_number: e.target.value }))} />
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <Input type="date" value={retestForm.date_of_birth} onChange={e => setRetestForm(f => ({ ...f, date_of_birth: e.target.value }))} />
                </div>
              </div>
              <div className="border border-border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <Label className="mb-0">Payment Collected</Label>
                  </div>
                  <Switch checked={retestPaymentCollected} onCheckedChange={setRetestPaymentCollected} />
                </div>
                {retestPaymentCollected && (
                  <div>
                    <Label className="text-xs">Payment Method</Label>
                    <Select value={retestPaymentMethod} onValueChange={setRetestPaymentMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="check">Check</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="square">Square</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {!retestPaymentCollected && (
                  <p className="text-xs text-muted-foreground">Student will be marked as <span className="font-semibold text-destructive">unpaid</span></p>
                )}
              </div>
              <Button onClick={handleRetestSubmit} className="w-full">Add to Retest Roster</Button>
            </div>
          </DialogContent>
        </Dialog>
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
              <div className="border border-border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <Label className="mb-0">Payment Collected</Label>
                  </div>
                  <Switch checked={studentPaymentCollected} onCheckedChange={setStudentPaymentCollected} />
                </div>
                {studentPaymentCollected && (
                  <div>
                    <Label className="text-xs">Payment Method</Label>
                    <Select value={studentPaymentMethod} onValueChange={setStudentPaymentMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="check">Check</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="square">Square</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {!studentPaymentCollected && (
                  <p className="text-xs text-muted-foreground">Student will be marked as <span className="font-semibold text-destructive">unpaid</span></p>
                )}
              </div>
              <Button onClick={handleSubmit} className="w-full">Add Student to Class</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="relative max-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCourse} onValueChange={setFilterCourse}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Courses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Courses</SelectItem>
            {Object.entries(courseLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterLocation} onValueChange={setFilterLocation}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="All Locations" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {Object.entries(locationLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          className="w-[170px]"
          placeholder="Filter by date"
        />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <X className="w-4 h-4 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {([
                  ["student", "Student"],
                  ["course", "Course"],
                  ["location", "Location"],
                  ["date", "Date"],
                  ["payment", "Payment"],
                  ["status", "Status"],
                  ["referral", "Referral"],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <th key={key} className="text-left p-3 font-medium text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => toggleSort(key)}
                      className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                    >
                      {label}
                      <SortIcon k={key} />
                    </button>
                  </th>
                ))}
                <th className="text-left p-3 font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No bookings found</td></tr>
              ) : sorted.map(b => (
                <tr key={b.id} className="border-b border-border/50 hover:bg-secondary/30">
                  <td className="p-3 font-medium text-foreground">
                    {b.first_name} {b.last_name}
                    {b.is_retest && <span className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded bg-accent/20 text-accent">Retest</span>}
                    <br /><span className="text-xs text-muted-foreground">{b.is_retest ? "Retest" : b.email}</span>
                  </td>
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
                  <td className="p-3">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedBooking(b)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Detail Dialog */}
      <Dialog open={!!selectedBooking} onOpenChange={(open) => { if (!open) setSelectedBooking(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Student Details</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-3 text-sm">
              {/* Personal Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground text-xs">First Name</p>
                  <p className="font-medium text-foreground">{selectedBooking.first_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Last Name</p>
                  <p className="font-medium text-foreground">{selectedBooking.last_name}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Email</p>
                <p className="font-medium text-foreground">{selectedBooking.email}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Phone</p>
                <p className="font-medium text-foreground">{selectedBooking.phone}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground text-xs">Gender</p>
                  <p className="font-medium text-foreground capitalize">{selectedBooking.gender || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Date of Birth</p>
                  <p className="font-medium text-foreground">{selectedBooking.date_of_birth || "—"}</p>
                </div>
              </div>

              {/* Address */}
              <div className="border-t border-border pt-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Address</h3>
                <div>
                  <p className="font-medium text-foreground">{(selectedBooking as any).address || "—"}</p>
                  <p className="font-medium text-foreground">
                    {[(selectedBooking as any).city, (selectedBooking as any).state, (selectedBooking as any).zip].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
              </div>

              {/* Driver License */}
              <div className="border-t border-border pt-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Driver License</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-muted-foreground text-xs">License Number</p>
                    <p className="font-medium text-foreground">{(selectedBooking as any).license_number || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Expiration</p>
                    <p className="font-medium text-foreground">{(selectedBooking as any).license_expiration || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Issuing Country</p>
                    <p className="font-medium text-foreground">{(selectedBooking as any).issuing_country || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Issuing State</p>
                    <p className="font-medium text-foreground">{(selectedBooking as any).issuing_state || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Booking Info */}
              <div className="border-t border-border pt-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Booking Info</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-muted-foreground text-xs">Course</p>
                    <p className="font-medium text-foreground">{courseLabels[selectedBooking.course] || selectedBooking.course}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Location</p>
                    <p className="font-medium text-foreground">{selectedBooking.location_label}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <p className="text-muted-foreground text-xs">Class Date</p>
                    <p className="font-medium text-foreground">{selectedBooking.schedule_date || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Fee</p>
                    <p className="font-medium text-foreground">{selectedBooking.fee || "—"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <p className="text-muted-foreground text-xs">Payment Status</p>
                    <p className="font-medium text-foreground capitalize">{selectedBooking.payment_status}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Booking Status</p>
                    <p className="font-medium text-foreground capitalize">{selectedBooking.booking_status}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <p className="text-muted-foreground text-xs">Referral Source</p>
                    <p className="font-medium text-foreground">{selectedBooking.referral_source || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Booked On</p>
                    <p className="font-medium text-foreground">{new Date(selectedBooking.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Roster Comment */}
              <div className="border-t border-border pt-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Roster Comment</h3>
                <Textarea
                  placeholder="Add a comment that will appear on the class roster..."
                  value={selectedBooking.roster_comment || ""}
                  onChange={e => {
                    const val = e.target.value;
                    setSelectedBooking(prev => prev ? { ...prev, roster_comment: val } : prev);
                  }}
                  className="text-sm"
                  rows={2}
                />
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={async () => {
                    const { error } = await supabase
                      .from("bookings")
                      .update({ roster_comment: selectedBooking.roster_comment?.trim() || null })
                      .eq("id", selectedBooking.id);
                    if (error) {
                      toast({ title: "Error", description: "Failed to save comment.", variant: "destructive" });
                    } else {
                      toast({ title: "Saved", description: "Roster comment updated." });
                      setBookings(prev => prev.map(b => b.id === selectedBooking.id ? { ...b, roster_comment: selectedBooking.roster_comment?.trim() || null } : b));
                    }
                  }}
                >
                  Save Comment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBookings;

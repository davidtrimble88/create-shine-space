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
import { UserPlus, Search, Eye, X, DollarSign, ArrowUp, ArrowDown, ArrowUpDown, AlertTriangle, CreditCard, Banknote, Mail, Link2, Wallet } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import AdminCancellations from "./AdminCancellations";
import PendingCashPayments from "./PendingCashPayments";
import DepositPayments from "./DepositPayments";
import { PaymentDialog, type PaymentProvider } from "@/components/PaymentDialog";
import type { SquareRegion } from "@/components/SquarePaymentDialog";
import { formatPSTDate } from "@/lib/formatDate";
import { sendRegistrationConfirmation } from "@/lib/registrationEmail";
import { useAuth } from "@/contexts/AuthContext";
import PaymentHistoryDialog from "./PaymentHistoryDialog";

const regionFor = (location: string): SquareRegion =>
  location.startsWith("high-desert") ? "high_desert" : "ventura";

const parseFeeCents = (price: string | null | undefined): number => {
  if (!price) return 0;
  const n = Number(String(price).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

/** Age on the class date (or today when no class date is known). */
const ageOnDate = (dob?: string | null, classDate?: string | null): number | null => {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const ref = classDate ? new Date(classDate) : new Date();
  if (isNaN(ref.getTime())) return null;
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--;
  return age;
};

const UNDER_21_CENTS = 39500;
const ADULT_DEFAULT_CENTS = 42500;

/**
 * Price a manual booking the same way the public site does: riders under 21 on
 * the class date never pay more than the under-21 fee ($395).
 */
const feeCentsForRider = (
  price: string | null | undefined,
  dob?: string | null,
  classDate?: string | null,
): number => {
  const scheduleCents = parseFeeCents(price);
  const age = ageOnDate(dob, classDate);
  const isUnder21 = age !== null && age < 21;
  if (scheduleCents > 0) return isUnder21 ? Math.min(scheduleCents, UNDER_21_CENTS) : scheduleCents;
  return isUnder21 ? UNDER_21_CENTS : ADULT_DEFAULT_CENTS;
};

/** Balance on a deposit is due 7 days before the class start date. */
export const depositDueDate = (classDate: string | null | undefined): string => {
  if (!classDate) return new Date().toISOString().split("T")[0];
  const d = new Date(`${classDate}T00:00:00`);
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
};

const centsToLabel = (cents: number) =>
  cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;


type Booking = Tables<"bookings">;
type Schedule = Tables<"schedules">;

const courseLabels: Record<string, string> = {
  basic: "Motorcyclist Training Course",
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
  const { effectiveRole, user } = useAuth();
  const isOwner = effectiveRole === "owner";
  const [financeBooking, setFinanceBooking] = useState<Booking | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [referralOptions, setReferralOptions] = useState<string[]>(FALLBACK_REFERRALS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [retestDialogOpen, setRetestDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [view, setView] = useState<"bookings" | "cancellations" | "pending-cash" | "deposits">("bookings");
  const [depositCount, setDepositCount] = useState(0);
  const [depositAmount, setDepositAmount] = useState("");
  const [chargeFeeToken, setChargeFeeToken] = useState<string | undefined>(undefined);
  const [pendingDepositId, setPendingDepositId] = useState<string | null>(null);
  const [pendingCashCount, setPendingCashCount] = useState(0);
  const [pendingRescheduleCount, setPendingRescheduleCount] = useState(0);
  
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [filterCourse, setFilterCourse] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [form, setForm] = useState({
    schedule_id: "",
    rider_track: "irc",
    bike_year: "",
    bike_make: "",
    bike_model: "",
    first_name: "",
    middle_name: "",
    last_name: "",
    preferred_name: "",
    email: "",
    phone: "",
    gender: "",
    date_of_birth: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    license_number: "",
    issuing_country: "US",
    issuing_state: "",
    license_expiration: "",
    referral_source: "",
    emergency_contact_name: "",
    emergency_contact_relationship: "",
    emergency_contact_phone: "",
    guardian_name: "",
    guardian_relationship: "",
    guardian_phone: "",
    guardian_email: "",
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

  // Charge-card dialog state (for taking actual payment via Square)
  const [chargeOpen, setChargeOpen] = useState(false);
  const [chargePayload, setChargePayload] = useState<Record<string, unknown> | null>(null);
  const [chargeRegion, setChargeRegion] = useState<SquareRegion>("ventura");
  const [chargeAmountCents, setChargeAmountCents] = useState(0);
  const [chargeAmountLabel, setChargeAmountLabel] = useState("$0");

  const fetchData = async () => {
    const today = new Date().toISOString().split("T")[0];
    const [bookRes, schedRes, refRes] = await Promise.all([
      supabase.from("bookings").select("*").eq("pending_payment", false).order("created_at", { ascending: false }).limit(200),
      supabase.from("schedules").select("*").gte("date", today).order("date"),
      supabase.from("referral_sources").select("name").eq("is_active", true).order("sort_order").order("name"),
    ]);
    if (bookRes.data) setBookings(bookRes.data);
    if (schedRes.data) setSchedules(schedRes.data);
    if (refRes.data && refRes.data.length > 0) setReferralOptions(refRes.data.map(r => r.name));
  };

  const fetchPendingCount = async () => {
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("needs_reschedule", true);
    setPendingRescheduleCount(count ?? 0);

    const { count: cashCount } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("pending_payment", true)
      .eq("archived", false);
    setPendingCashCount(cashCount ?? 0);

    const { count: depCount } = await (supabase as any)
      .from("booking_deposits")
      .select("id", { count: "exact", head: true })
      .in("status", ["awaiting_deposit", "open"]);
    setDepositCount(depCount ?? 0);
  };

  useEffect(() => { fetchData(); fetchPendingCount(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel("admin-bookings-reschedule-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => fetchPendingCount())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const selectedSchedule = schedules.find(s => s.id === form.schedule_id);
  const [overbook, setOverbook] = useState(false);
  const [overbookReason, setOverbookReason] = useState("");

  // Send the same registration confirmation students get when booking online.
  // Retest bookings are skipped for now; a dedicated retest email will be built later.
  const sendConfirmationForBooking = async (payload: Record<string, unknown>) => {
    if (payload.is_retest) return;
    const email = String(payload.email || "").trim();
    if (!email || email.toLowerCase() === "retest@placeholder.com") return;
    const sched = schedules.find(s => s.id === payload.schedule_id);
    const guardianEmail = String(payload.guardian_email || "").trim();
    const additionalRecipients =
      guardianEmail && guardianEmail.toLowerCase() !== email.toLowerCase() ? [guardianEmail] : [];
    const course = String(payload.course || "");
    const location = String(payload.location || "");
    await sendRegistrationConfirmation({
      email,
      firstName: String(payload.first_name || ""),
      lastName: String(payload.last_name || ""),
      // 1DPC shares the intermediate class but has its own confirmation email.
      courseKey: String(payload.rider_track || "") === "1dpc" ? "1dpc" : course,
      courseLabel: courseLabels[course] || course,
      locationLabel: String(payload.location_label || locationLabels[location] || location),
      location,
      groupName: sched?.group_name ?? null,
      scheduleDate: (payload.schedule_date as string) || sched?.date || null,
      scheduleDetail: sched?.schedule ?? null,
      fee: String(payload.fee || sched?.price || ""),
      additionalRecipients,
    });
  };

  const [resendingId, setResendingId] = useState<string | null>(null);
  const [formsLinkPrompt, setFormsLinkPrompt] = useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });

  const handleResend = async (b: Booking) => {
    setResendingId(b.id);
    try {
      await sendConfirmationForBooking(b as unknown as Record<string, unknown>);
      toast({ title: "Email sent", description: `Registration confirmation resent to ${b.email}.` });
    } catch (e) {
      toast({ title: "Send failed", description: e instanceof Error ? e.message : "Could not resend email.", variant: "destructive" });
    } finally {
      setResendingId(null);
    }
  };

  const promptSendFormsLink = (booking: Booking) => {
    setFormsLinkPrompt({ open: true, booking });
  };

  // Emails the student a secure link where they can e-sign the CMSP registration
  // form, waiver, and photo release. Submissions attach to their booking exactly
  // like an online registration.
  const [formsLinkId, setFormsLinkId] = useState<string | null>(null);

  const handleSendFormsLink = async (b: Booking) => {
    setFormsLinkId(b.id);
    try {
      const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
      const { error: tokErr } = await supabase
        .from("booking_form_tokens")
        .insert({ booking_id: b.id, token, created_by: user?.id ?? null });
      if (tokErr) throw tokErr;

      const formsLink = `${window.location.origin}/complete-forms?token=${token}`;
      const guardianEmail = (b.guardian_email || "").trim();
      const { error } = await supabase.functions.invoke("send-auto-email", {
        body: {
          trigger_event: "forms_link",
          recipientEmail: b.email,
          location: b.location,
          course: b.rider_track === "1dpc" ? "1dpc" : b.course,
          additionalRecipients:
            guardianEmail && guardianEmail.toLowerCase() !== b.email.toLowerCase() ? [guardianEmail] : [],
          variables: {
            firstName: b.first_name,
            lastName: b.last_name,
            course: courseLabels[b.course] || b.course,
            locationLabel: b.location_label,
            scheduleDate: b.schedule_date || "",
            formsLink,
            email: b.email,
          },
        },
      });
      if (error) throw error;
      toast({ title: "Forms link sent", description: `${b.email} can now e-sign their forms online.` });
    } catch (e) {
      toast({ title: "Send failed", description: e instanceof Error ? e.message : "Could not send forms link.", variant: "destructive" });
    } finally {
      setFormsLinkId(null);
    }
  };



  const handleSubmit = async () => {
    if (!form.first_name || !form.last_name || !form.email || !form.phone || !form.schedule_id) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    const sched = schedules.find(s => s.id === form.schedule_id);
    if (!sched) return;

    const isIntermediate = sched.course === "intermediate";
    const is1dpc = isIntermediate && form.rider_track === "1dpc";
    const isIrc = isIntermediate && form.rider_track === "irc";
    if (isIrc && (!form.bike_year.trim() || !form.bike_make.trim() || !form.bike_model.trim())) {
      toast({ title: "Bike info required", description: "IRC students ride their own bike — year, make, and model are required.", variant: "destructive" });
      return;
    }

    // Minors (under 18 on the class date) must have emergency contact + guardian info.
    const riderAge = ageOnDate(form.date_of_birth || null, sched.date);
    if (riderAge !== null && riderAge < 18) {
      const missing: string[] = [];
      if (!form.emergency_contact_name.trim()) missing.push("emergency contact name");
      if (!form.emergency_contact_phone.trim()) missing.push("emergency contact phone");
      if (!form.guardian_name.trim()) missing.push("parent/guardian name");
      if (!form.guardian_phone.trim()) missing.push("parent/guardian phone");
      if (!form.guardian_email.trim()) missing.push("parent/guardian email");
      if (missing.length) {
        toast({
          title: "Required for minors",
          description: `This student is ${riderAge} on the class date. Please provide: ${missing.join(", ")}.`,
          variant: "destructive",
        });
        return;
      }
    }


    const basePayload: Record<string, unknown> = {

      id: crypto.randomUUID(),
      schedule_id: form.schedule_id,
      course: sched.course,
      location: sched.location,
      location_label: sched.location_label,
      schedule_date: sched.date,
      first_name: form.first_name,
      middle_name: form.middle_name || null,
      last_name: form.last_name,
      preferred_name: form.preferred_name || null,
      email: form.email,
      phone: form.phone,
      gender: form.gender || null,
      date_of_birth: form.date_of_birth || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      zip: form.zip || null,
      license_number: form.license_number || null,
      issuing_country: form.issuing_country || null,
      issuing_state: form.issuing_state || null,
      license_expiration: form.license_expiration || null,
      referral_source: form.referral_source || "Phone Call",
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_relationship: form.emergency_contact_relationship || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
      guardian_name: form.guardian_name || null,
      guardian_relationship: form.guardian_relationship || null,
      guardian_phone: form.guardian_phone || null,
      guardian_email: form.guardian_email || null,
      fee: centsToLabel(feeCentsForRider(sched.price, form.date_of_birth || null, sched.date)),

      rider_track: isIntermediate ? form.rider_track : null,
      bike_info: isIrc
        ? [form.bike_year, form.bike_make, form.bike_model].map(v => v.trim()).filter(Boolean).join(" ")
        : is1dpc
          ? "Provided bike"
          : null,
      roster_comment: is1dpc ? "1DPC" : null,
      manually_added: true,
      overbook_override: overbook,
      overbook_reason: overbook ? overbookReason.trim() : null,
    };

    if (selectedSchedule && selectedSchedule.spots_available <= 0 && !overbook) {
      toast({ title: "Class is full", description: "Check \"Overbook this class\" and give a reason to add anyway.", variant: "destructive" });
      return;
    }
    if (overbook && !overbookReason.trim()) {
      toast({ title: "Reason required", description: "Please explain why this class is being overbooked.", variant: "destructive" });
      return;
    }




    // Take real card payment via Square.
    // The student is saved FIRST as an unpaid booking so a payment dialog crash,
    // webview reload, or abandoned checkout can never erase the registration.
    if (studentPaymentCollected && studentPaymentMethod === "charge_card") {
      const cents = feeCentsForRider(sched.price, form.date_of_birth || null, sched.date);
      if (cents <= 0) {
        toast({ title: "Invalid fee", description: "This class has no price set.", variant: "destructive" });
        return;
      }

      const { error: preErr } = await supabase.from("bookings").insert({
        ...basePayload,
        payment_status: "unpaid",
        payment_provider: "square",
        booking_status: "confirmed",
      } as any);
      if (preErr) {
        toast({ title: "Error", description: preErr.message, variant: "destructive" });
        return;
      }

      setChargePayload(basePayload);
      setChargeRegion(regionFor(sched.location));
      setChargeAmountCents(cents);
      setChargeAmountLabel(centsToLabel(cents));
      setChargeFeeToken(undefined);
      setPendingDepositId(null);

      setDialogOpen(false);
      setChargeOpen(true);
      fetchData();
      return;
    }

    // Deposit: register the student now, charge a custom partial amount, and
    // track the remaining balance (due 7 days before class).
    if (studentPaymentCollected && studentPaymentMethod === "deposit") {
      const total = feeCentsForRider(sched.price, form.date_of_birth || null, sched.date);
      const depositCents = Math.round((Number(depositAmount.replace(/[^0-9.]/g, "")) || 0) * 100);
      if (total <= 0) {
        toast({ title: "Invalid fee", description: "This class has no price set.", variant: "destructive" });
        return;
      }
      if (depositCents <= 0 || depositCents >= total) {
        toast({ title: "Invalid deposit", description: `Enter a deposit between $0.01 and ${centsToLabel(total - 1)}.`, variant: "destructive" });
        return;
      }

      const { error: insErr } = await supabase.from("bookings").insert({
        ...basePayload,
        fee: centsToLabel(total),
        payment_status: "partial",
        payment_provider: "square",
        booking_status: "confirmed",
      } as any);
      if (insErr) {
        toast({ title: "Error", description: insErr.message, variant: "destructive" });
        return;
      }

      const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
      const { error: feeErr } = await (supabase as any).from("fee_payment_requests").insert({
        booking_id: basePayload.id,
        token,
        fee_type: "deposit",
        amount_cents: depositCents,
        note: "Course deposit",
        created_by: user?.id ?? null,
      });
      const { data: depRow, error: depErr } = await (supabase as any)
        .from("booking_deposits")
        .insert({
          booking_id: basePayload.id,
          total_amount_cents: total,
          deposit_amount_cents: depositCents,
          balance_cents: total - depositCents,
          due_date: depositDueDate(sched.date),
          status: "awaiting_deposit",
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();

      if (feeErr || depErr) {
        toast({ title: "Error", description: (feeErr || depErr)?.message ?? "Could not set up the deposit", variant: "destructive" });
        return;
      }

      setChargePayload(basePayload);
      setChargeRegion(regionFor(sched.location));
      setChargeAmountCents(depositCents);
      setChargeAmountLabel(centsToLabel(depositCents));
      setChargeFeeToken(token);
      setPendingDepositId(depRow.id as string);
      setDialogOpen(false);
      setChargeOpen(true);
      fetchData();
      return;
    }

    const { error } = await supabase.from("bookings").insert({
      ...basePayload,
      payment_status: studentPaymentCollected ? "paid" : "unpaid",
      payment_provider: studentPaymentCollected ? studentPaymentMethod : null,
      booking_status: "confirmed",
    } as any);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      void sendConfirmationForBooking(basePayload);
      toast({ title: "Student Added", description: `${form.first_name} ${form.last_name} has been booked.` });
      setForm({ schedule_id: "", rider_track: "irc", bike_year: "", bike_make: "", bike_model: "", first_name: "", middle_name: "", last_name: "", preferred_name: "", email: "", phone: "", gender: "", date_of_birth: "", address: "", city: "", state: "", zip: "", license_number: "", issuing_country: "US", issuing_state: "", license_expiration: "", referral_source: "", emergency_contact_name: "", emergency_contact_relationship: "", emergency_contact_phone: "", guardian_name: "", guardian_relationship: "", guardian_phone: "", guardian_email: "" });
      setStudentPaymentCollected(false);
      setStudentPaymentMethod("cash");
      setDialogOpen(false);
      promptSendFormsLink(basePayload as unknown as Booking);
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

    const basePayload: Record<string, unknown> = {
      id: crypto.randomUUID(),
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
      is_retest: true,
      fee: sched.price,
      manually_added: true,
    };


    if (retestPaymentCollected && retestPaymentMethod === "charge_card") {
      const cents = parseFeeCents(sched.price);
      if (cents <= 0) {
        toast({ title: "Invalid fee", description: "This class has no price set.", variant: "destructive" });
        return;
      }
      // Save first as unpaid so an interrupted checkout can't lose the student.
      const { error: preErr } = await supabase.from("bookings").insert({
        ...basePayload,
        payment_status: "unpaid",
        payment_provider: "square",
        booking_status: "confirmed",
      } as any);
      if (preErr) {
        toast({ title: "Error", description: preErr.message, variant: "destructive" });
        return;
      }
      setChargePayload(basePayload);
      setChargeRegion(regionFor(sched.location));
      setChargeAmountCents(cents);
      setChargeAmountLabel(sched.price);
      setRetestDialogOpen(false);
      setChargeOpen(true);
      fetchData();
      return;
    }

    const { error } = await supabase.from("bookings").insert({
      ...basePayload,
      payment_status: retestPaymentCollected ? "paid" : "unpaid",
      payment_provider: retestPaymentCollected ? retestPaymentMethod : null,
      booking_status: "confirmed",
    } as any);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      void sendConfirmationForBooking(basePayload);
      toast({ title: "Retest Student Added", description: `${retestForm.first_name} ${retestForm.last_name} added for retest.` });
      setRetestForm({ schedule_id: "", first_name: "", last_name: "", phone: "", license_number: "", date_of_birth: "" });
      setRetestPaymentCollected(false);
      setRetestPaymentMethod("cash");
      setRetestDialogOpen(false);
      fetchData();
    }
  };

  const handleChargeSuccess = (paymentId: string, _provider: PaymentProvider) => {
    if (pendingDepositId) {
      void (async () => {
        await (supabase as any)
          .from("booking_deposits")
          .update({ status: "open", deposit_paid_at: new Date().toISOString(), deposit_payment_id: paymentId })
          .eq("id", pendingDepositId);
        fetchPendingCount();
      })();
      toast({ title: "Deposit received", description: "Student is registered. The remaining balance is now tracked in the Deposits tab." });
    } else {
      toast({ title: "Payment received", description: "Student has been booked and marked paid." });
    }
    if (chargePayload) {
      void sendConfirmationForBooking(chargePayload);
      promptSendFormsLink(chargePayload as unknown as Booking);
    }
    setChargeOpen(false);
    setChargePayload(null);
    setChargeFeeToken(undefined);
    setPendingDepositId(null);
    setDepositAmount("");
    setForm({ schedule_id: "", rider_track: "irc", bike_year: "", bike_make: "", bike_model: "", first_name: "", middle_name: "", last_name: "", preferred_name: "", email: "", phone: "", gender: "", date_of_birth: "", address: "", city: "", state: "", zip: "", license_number: "", issuing_country: "US", issuing_state: "", license_expiration: "", referral_source: "", emergency_contact_name: "", emergency_contact_relationship: "", emergency_contact_phone: "", guardian_name: "", guardian_relationship: "", guardian_phone: "", guardian_email: "" });
    setStudentPaymentCollected(false);
    setStudentPaymentMethod("cash");
    setRetestForm({ schedule_id: "", first_name: "", last_name: "", phone: "", license_number: "", date_of_birth: "" });
    setRetestPaymentCollected(false);
    setRetestPaymentMethod("cash");
    fetchData();
  };


  const activeCourse = filterCourse && filterCourse !== "all" ? filterCourse : "";
  const activeLocation = filterLocation && filterLocation !== "all" ? filterLocation : "";
  const hasFilters = !!activeCourse || !!activeLocation || !!filterDate;

  type SortKey = "student" | "course" | "location" | "date" | "dob" | "registered" | "payment" | "status" | "referral";
  const [sortKey, setSortKey] = useState<SortKey>("registered");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const isMinorBooking = (dob?: string | null, classDate?: string | null): boolean => {
    if (!dob) return false;
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return false;
    const ref = classDate ? new Date(classDate) : new Date();
    if (isNaN(ref.getTime())) return false;
    let age = ref.getFullYear() - birth.getFullYear();
    const m = ref.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--;
    return age < 18;
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
        case "dob": return row.date_of_birth || "";
        case "registered": return row.created_at || "";
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

  if (view === "cancellations") {
    return <AdminCancellations onBack={() => { setView("bookings"); fetchPendingCount(); }} />;
  }

  if (view === "pending-cash") {
    return <PendingCashPayments onBack={() => { setView("bookings"); fetchData(); fetchPendingCount(); }} />;
  }

  if (view === "deposits") {
    return <DepositPayments onBack={() => { setView("bookings"); fetchData(); fetchPendingCount(); }} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Bookings</h1>
        <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => setView("deposits")} className={depositCount > 0 ? "border-accent text-accent" : ""}>
          <Wallet className="w-4 h-4 mr-2" />
          Deposits
          {depositCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-accent-foreground text-xs font-semibold">
              {depositCount}
            </span>
          )}
        </Button>
        <Button variant="outline" onClick={() => setView("pending-cash")} className={pendingCashCount > 0 ? "border-accent text-accent" : ""}>
          <Banknote className="w-4 h-4 mr-2" />
          Pending Payment (Cash)
          {pendingCashCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-accent-foreground text-xs font-semibold">
              {pendingCashCount}
            </span>
          )}
        </Button>
        <Button variant="outline" onClick={() => setView("cancellations")} className={pendingRescheduleCount > 0 ? "border-accent text-accent" : ""}>
          <AlertTriangle className="w-4 h-4 mr-2" />
          Cancellations &amp; Rescheduling
          {pendingRescheduleCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-accent-foreground text-xs font-semibold">
              {pendingRescheduleCount}
            </span>
          )}
        </Button>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Legal First Name *</Label>
                  <Input value={retestForm.first_name} onChange={e => setRetestForm(f => ({ ...f, first_name: e.target.value }))} />
                </div>
                <div>
                  <Label>Legal Last Name *</Label>
                  <Input value={retestForm.last_name} onChange={e => setRetestForm(f => ({ ...f, last_name: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Phone *</Label>
                <Input type="tel" value={retestForm.phone} onChange={e => setRetestForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        <SelectItem value="charge_card">💳 Take Square Payment</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="check">Check</SelectItem>
                        <SelectItem value="card">Card (recorded only)</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {!retestPaymentCollected && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Student will be marked as <span className="font-semibold text-destructive">unpaid</span></p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => { setRetestPaymentCollected(true); setRetestPaymentMethod("charge_card"); }}
                    >
                      <CreditCard className="w-4 h-4 mr-2" /> Take Square Payment (phone / in person)
                    </Button>
                  </div>
                )}

              </div>
              <Button onClick={handleRetestSubmit} className="w-full">
                {retestPaymentCollected && retestPaymentMethod === "charge_card" ? (
                  <><CreditCard className="w-4 h-4 mr-2" />Charge Card &amp; Add to Retest</>
                ) : "Add to Retest Roster"}
              </Button>
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
                  <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 space-y-2">
                    <p className="text-xs font-semibold text-destructive">⚠ This class is full — bookings are blocked unless you override.</p>
                    <label className="flex items-center gap-2 text-xs text-foreground">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[hsl(var(--destructive))]"
                        checked={overbook}
                        onChange={e => { setOverbook(e.target.checked); if (!e.target.checked) setOverbookReason(""); }}
                      />
                      Overbook this class (reason required)
                    </label>
                    {overbook && (
                      <Input
                        value={overbookReason}
                        onChange={e => setOverbookReason(e.target.value)}
                        placeholder="Why is this student being added to a full class?"
                      />
                    )}
                  </div>
                )}
              </div>
              {selectedSchedule?.course === "intermediate" && (
                <div className="space-y-3 rounded-md border border-border p-3">
                  <div>
                    <Label>Course Track *</Label>
                    <Select value={form.rider_track} onValueChange={v => setForm(f => ({ ...f, rider_track: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="irc">Intermediate Riding Clinic (IRC) — has M1, own bike</SelectItem>
                        <SelectItem value="1dpc">1-Day Premier Course with Licensing (1DPC) — no M1, provided bike</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      IRC and 1DPC share the same class and seats. Selecting 1DPC adds a "1DPC" note to the roster.
                    </p>
                  </div>
                  {form.rider_track === "irc" && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label>Bike Year *</Label>
                        <Input value={form.bike_year} onChange={e => setForm(f => ({ ...f, bike_year: e.target.value }))} maxLength={4} />
                      </div>
                      <div>
                        <Label>Bike Make *</Label>
                        <Input value={form.bike_make} onChange={e => setForm(f => ({ ...f, bike_make: e.target.value }))} maxLength={50} />
                      </div>
                      <div>
                        <Label>Bike Model *</Label>
                        <Input value={form.bike_model} onChange={e => setForm(f => ({ ...f, bike_model: e.target.value }))} maxLength={50} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label>Legal First Name *</Label>
                  <Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
                </div>
                <div>
                  <Label>Middle Name</Label>
                  <Input value={form.middle_name} onChange={e => setForm(f => ({ ...f, middle_name: e.target.value }))} />
                </div>
                <div>
                  <Label>Legal Last Name *</Label>
                  <Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Preferred Name</Label>
                <Input value={form.preferred_name} onChange={e => setForm(f => ({ ...f, preferred_name: e.target.value }))} />
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <Label>Phone *</Label>
                <Input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              {/* Address */}
              <div className="pt-2 border-t border-border/40">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Address</p>
                <div className="space-y-3">
                  <div>
                    <Label>Street Address</Label>
                    <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label>City</Label>
                      <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                    </div>
                    <div>
                      <Label>State</Label>
                      <Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} maxLength={50} />
                    </div>
                    <div>
                      <Label>ZIP</Label>
                      <Input value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} maxLength={10} />
                    </div>
                  </div>
                </div>
              </div>

              {/* ID / License */}
              <div className="pt-2 border-t border-border/40">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Driver's License / ID</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label>ID / License Number</Label>
                      <Input value={form.license_number} onChange={e => setForm(f => ({ ...f, license_number: e.target.value }))} maxLength={50} />
                    </div>
                    <div>
                      <Label>Expiration</Label>
                      <Input type="date" value={form.license_expiration} onChange={e => setForm(f => ({ ...f, license_expiration: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Issuing Country</Label>
                      <Input value={form.issuing_country} onChange={e => setForm(f => ({ ...f, issuing_country: e.target.value }))} maxLength={50} />
                    </div>
                    <div>
                      <Label>Issuing State</Label>
                      <Input value={form.issuing_state} onChange={e => setForm(f => ({ ...f, issuing_state: e.target.value }))} maxLength={50} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Emergency Contact — required for minors */}
              {(() => {
                const schedSel = schedules.find(s => s.id === form.schedule_id);
                const age = ageOnDate(form.date_of_birth || null, schedSel?.date || null);
                const isMinor = age !== null && age < 18;
                const req = isMinor ? <span className="text-destructive"> *</span> : null;
                return (
                  <>
                    <div className="pt-2 border-t border-border/40">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Emergency Contact{" "}
                        <span className={`normal-case font-normal tracking-normal ${isMinor ? "text-destructive" : ""}`}>
                          {isMinor ? "(required — student is a minor)" : "(optional)"}
                        </span>
                      </p>
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label>Contact Name{req}</Label>
                            <Input value={form.emergency_contact_name} onChange={e => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))} maxLength={100} />
                          </div>
                          <div>
                            <Label>Relationship</Label>
                            <Input value={form.emergency_contact_relationship} onChange={e => setForm(f => ({ ...f, emergency_contact_relationship: e.target.value }))} maxLength={50} />
                          </div>
                        </div>
                        <div>
                          <Label>Contact Phone{req}</Label>
                          <Input type="tel" value={form.emergency_contact_phone} onChange={e => setForm(f => ({ ...f, emergency_contact_phone: e.target.value }))} maxLength={25} />
                        </div>
                      </div>
                    </div>

                    {/* Parent / Legal Guardian — required for minors */}
                    <div className="pt-2 border-t border-border/40">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Parent / Legal Guardian{" "}
                        <span className={`normal-case font-normal tracking-normal ${isMinor ? "text-destructive" : ""}`}>
                          {isMinor ? "(required — student is under 18)" : "(optional — required for students under 18)"}
                        </span>
                      </p>
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label>Guardian Name{req}</Label>
                            <Input value={form.guardian_name} onChange={e => setForm(f => ({ ...f, guardian_name: e.target.value }))} maxLength={100} />
                          </div>
                          <div>
                            <Label>Relationship to Student</Label>
                            <Input value={form.guardian_relationship} onChange={e => setForm(f => ({ ...f, guardian_relationship: e.target.value }))} maxLength={50} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label>Guardian Phone{req}</Label>
                            <Input type="tel" value={form.guardian_phone} onChange={e => setForm(f => ({ ...f, guardian_phone: e.target.value }))} maxLength={25} />
                          </div>
                          <div>
                            <Label>Guardian Email{req}</Label>
                            <Input type="email" value={form.guardian_email} onChange={e => setForm(f => ({ ...f, guardian_email: e.target.value }))} maxLength={150} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}





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
                {(() => {
                  const sched = schedules.find(s => s.id === form.schedule_id);
                  if (!sched) return null;
                  const age = ageOnDate(form.date_of_birth || null, sched.date);
                  const cents = feeCentsForRider(sched.price, form.date_of_birth || null, sched.date);
                  return (
                    <div className="rounded-md bg-muted/40 px-3 py-2 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Amount due</span>
                        <span className="font-semibold text-foreground text-sm">{centsToLabel(cents)}</span>
                      </div>
                      <p className="text-muted-foreground">
                        {age === null
                          ? "Enter a date of birth to apply under-21 pricing automatically."
                          : age < 18
                            ? `Age ${age} on the class date — minor / under-21 rate applied.`
                            : age < 21
                              ? `Age ${age} on the class date — under-21 rate applied.`
                              : `Age ${age} on the class date — adult rate.`}
                      </p>
                    </div>
                  );
                })()}

                {studentPaymentCollected && (
                  <div>
                    <Label className="text-xs">Payment Method</Label>
                    <Select value={studentPaymentMethod} onValueChange={setStudentPaymentMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="charge_card">💳 Take Square Payment (full)</SelectItem>
                        <SelectItem value="deposit">🧾 Take Deposit (partial payment)</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="check">Check</SelectItem>
                        <SelectItem value="card">Card (recorded only)</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {studentPaymentCollected && studentPaymentMethod === "deposit" && (() => {
                  const sched = schedules.find(s => s.id === form.schedule_id);
                  const total = sched ? feeCentsForRider(sched.price, form.date_of_birth || null, sched.date) : 0;
                  const dep = Math.round((Number(depositAmount.replace(/[^0-9.]/g, "")) || 0) * 100);
                  const balance = Math.max(total - dep, 0);
                  const due = sched ? depositDueDate(sched.date) : null;
                  return (
                    <div className="space-y-2 rounded-md border border-accent/40 bg-accent/5 p-3">
                      <Label className="text-xs">Deposit amount (any amount)</Label>
                      <Input
                        inputMode="decimal"
                        placeholder="150.00"
                        value={depositAmount}
                        onChange={e => setDepositAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                      />
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between"><span className="text-muted-foreground">Course total</span><span className="font-medium text-foreground">{centsToLabel(total)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Deposit today</span><span className="font-medium text-foreground">{centsToLabel(dep)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Remaining balance</span><span className="font-semibold text-accent">{centsToLabel(balance)}</span></div>
                        <p className="text-muted-foreground pt-1">
                          Balance is due by <span className="font-semibold text-foreground">{due ?? "—"}</span> (7 days before class).
                          If it isn't paid, the student is moved to pending reschedule and the seat is released automatically.
                        </p>
                      </div>
                    </div>
                  );
                })()}
                {!studentPaymentCollected && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Student will be marked as <span className="font-semibold text-destructive">unpaid</span></p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => { setStudentPaymentCollected(true); setStudentPaymentMethod("charge_card"); }}
                    >
                      <CreditCard className="w-4 h-4 mr-2" /> Take Square Payment (phone / in person)
                    </Button>
                  </div>
                )}

              </div>
              <Button onClick={handleSubmit} className="w-full">
                {studentPaymentCollected && studentPaymentMethod === "deposit" ? (
                  <><Wallet className="w-4 h-4 mr-2" />Charge Deposit &amp; Add Student</>
                ) : studentPaymentCollected && studentPaymentMethod === "charge_card" ? (
                  <><CreditCard className="w-4 h-4 mr-2" />Charge Card &amp; Add Student</>
                ) : "Add Student to Class"}
              </Button>
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
                  ["date", "Class Date"],
                  ["dob", "DOB"],
                  ["registered", "Registered"],
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
                <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">No bookings found</td></tr>
              ) : sorted.map(b => (
                <tr key={b.id} className="border-b border-border/50 hover:bg-secondary/30">
                  <td className="p-3 font-medium text-foreground">
                    {b.first_name} {b.last_name}
                    {b.is_retest && <span className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded bg-accent/20 text-accent">Retest</span>}
                    {isMinorBooking(b.date_of_birth, b.schedule_date) && (
                      <span className="ml-2 text-xs font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 border border-amber-500/40">MINOR</span>
                    )}

                    <br /><span className="text-xs text-muted-foreground">{b.is_retest ? "Retest" : b.email}</span>
                  </td>
                  <td className="p-3 text-muted-foreground">{courseLabels[b.course] || b.course}</td>
                  <td className="p-3 text-muted-foreground">{b.location_label}</td>
                  <td className="p-3 text-muted-foreground">{b.schedule_date || "—"}</td>
                  <td className="p-3 text-muted-foreground">{b.date_of_birth || "—"}</td>
                  <td className="p-3 text-muted-foreground text-xs">{b.created_at ? formatPSTDate(b.created_at) : "—"}</td>
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
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedBooking(b)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title={b.is_retest ? "Retest confirmation email template not set up yet" : "Resend registration email"}
                        disabled={resendingId === b.id || b.is_retest}
                        onClick={() => handleResend(b)}
                      >
                        <Mail className={`w-4 h-4 ${resendingId === b.id || b.is_retest ? "opacity-50" : ""}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Email a link so the student can e-sign their forms online"
                        disabled={formsLinkId === b.id}
                        onClick={() => handleSendFormsLink(b)}
                      >
                        <Link2 className={`w-4 h-4 ${formsLinkId === b.id ? "opacity-50" : ""}`} />
                      </Button>
                      {isOwner && (
                        <button
                          type="button"
                          title="Financial history & refunds"
                          aria-label={`Financial history for ${b.first_name} ${b.last_name}`}
                          onClick={() => setFinanceBooking(b)}
                          className="ml-auto inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 transition-colors"
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isOwner && (
        <PaymentHistoryDialog
          open={!!financeBooking}
          onOpenChange={(o) => { if (!o) setFinanceBooking(null); }}
          bookingId={financeBooking?.id}
          email={financeBooking?.email}
          studentName={financeBooking ? `${financeBooking.first_name} ${financeBooking.last_name}` : null}
        />
      )}


      {/* Student Detail Dialog */}
      <Dialog open={!!selectedBooking} onOpenChange={(open) => { if (!open) setSelectedBooking(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Student Details</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-3 text-sm">
              {/* Personal Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground text-xs">Gender</p>
                  <p className="font-medium text-foreground capitalize">{selectedBooking.gender || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Date of Birth</p>
                  <p className="font-medium text-foreground">{selectedBooking.date_of_birth || "—"}</p>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="border-t border-border pt-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Emergency Contact</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-muted-foreground text-xs">Name</p>
                    <p className="font-medium text-foreground">{selectedBooking.emergency_contact_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Relationship</p>
                    <p className="font-medium text-foreground">{selectedBooking.emergency_contact_relationship || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Phone</p>
                    <p className="font-medium text-foreground">{selectedBooking.emergency_contact_phone || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Parent / Legal Guardian */}
              {(isMinorBooking(selectedBooking.date_of_birth, selectedBooking.schedule_date) ||
                selectedBooking.guardian_name || selectedBooking.guardian_email || selectedBooking.guardian_phone) && (
                <div className="border-t border-border pt-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-2 text-amber-500">
                    Parent / Legal Guardian {isMinorBooking(selectedBooking.date_of_birth, selectedBooking.schedule_date) && "(Minor)"}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-muted-foreground text-xs">Name</p>
                      <p className="font-medium text-foreground">{selectedBooking.guardian_name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Relationship</p>
                      <p className="font-medium text-foreground">{selectedBooking.guardian_relationship || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Phone</p>
                      <p className="font-medium text-foreground">{selectedBooking.guardian_phone || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Email</p>
                      <p className="font-medium text-foreground break-all">{selectedBooking.guardian_email || "—"}</p>
                    </div>
                  </div>
                </div>
              )}



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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-muted-foreground text-xs">Course</p>
                    <p className="font-medium text-foreground">{courseLabels[selectedBooking.course] || selectedBooking.course}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Location</p>
                    <p className="font-medium text-foreground">{selectedBooking.location_label}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <p className="text-muted-foreground text-xs">Class Date</p>
                    <p className="font-medium text-foreground">{selectedBooking.schedule_date || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Fee</p>
                    <p className="font-medium text-foreground">{selectedBooking.fee || "—"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <p className="text-muted-foreground text-xs">Payment Status</p>
                    <p className="font-medium text-foreground capitalize">{selectedBooking.payment_status}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Booking Status</p>
                    <p className="font-medium text-foreground capitalize">{selectedBooking.booking_status}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <p className="text-muted-foreground text-xs">Referral Source</p>
                    <p className="font-medium text-foreground">{selectedBooking.referral_source || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Booked On</p>
                    <p className="font-medium text-foreground">{formatPSTDate(selectedBooking.created_at)}</p>
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

      {/* Prompt to send forms link after adding a student */}
      <Dialog open={formsLinkPrompt.open} onOpenChange={(open) => setFormsLinkPrompt((prev) => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send forms link?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-foreground">
              {formsLinkPrompt.booking ? (
                <>
                  <span className="font-semibold">{formsLinkPrompt.booking.first_name} {formsLinkPrompt.booking.last_name}</span> has been added successfully.
                </>
              ) : (
                "Student has been added successfully."
              )}
            </p>
            <p className="text-muted-foreground">
              Would you like to email a secure link so they can fill out and e-sign the CMSP registration form, waiver, and photo release online?
            </p>
            {formsLinkPrompt.booking?.guardian_email && (
              <p className="text-xs text-muted-foreground">
                A copy will also be sent to the parent/guardian at {formsLinkPrompt.booking.guardian_email}.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFormsLinkPrompt({ open: false, booking: null })}>
                Not now
              </Button>
              <Button
                onClick={() => {
                  if (formsLinkPrompt.booking) {
                    void handleSendFormsLink(formsLinkPrompt.booking).then(() => {
                      setFormsLinkPrompt({ open: false, booking: null });
                    });
                  }
                }}
                disabled={!formsLinkPrompt.booking || formsLinkId === formsLinkPrompt.booking.id}
              >
                {formsLinkId === formsLinkPrompt.booking?.id ? "Sending…" : "Send forms link"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {chargePayload && (
        <PaymentDialog
          open={chargeOpen}
          onOpenChange={(o) => { if (!o) { setChargeOpen(false); setChargePayload(null); setChargeFeeToken(undefined); setPendingDepositId(null); } }}
          region={chargeRegion}
          amountCents={chargeAmountCents}
          amountLabel={chargeAmountLabel}
          bookingPayload={chargePayload}
          feeToken={chargeFeeToken}
          phoneAuthorization
          onSuccess={handleChargeSuccess}
        />
      )}
    </div>
  );
};

export default AdminBookings;

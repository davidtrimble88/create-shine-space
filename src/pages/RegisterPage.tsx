import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import PaymentDialog from "@/components/PaymentDialog";
import { type SquareRegion } from "@/components/SquarePaymentDialog";
import { type WaiverPrefill } from "@/components/WaiverStep";
import WaiverDocuSign from "@/components/WaiverDocuSign";

const registrationSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  gender: z.enum(["male", "female", "other"], { required_error: "Please select your gender" }),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  phone: z.string().trim().min(7, "Valid phone number required").max(20),
  email: z.string().trim().email("Valid email required").max(255),
  address: z.string().trim().min(1, "Address is required").max(200),
  city: z.string().trim().min(1, "City is required").max(100),
  state: z.string().trim().min(1, "State is required").max(50),
  zip: z.string().trim().min(5, "Valid ZIP code required").max(10),
  idType: z.enum(["drivers_license", "other"], { required_error: "Please select an ID type" }),
  otherIdType: z.string().trim().max(100).optional(),
  licenseNumber: z.string().trim().min(1, "ID number is required").max(50),
  issuingCountry: z.string().trim().min(1, "Issuing country is required").max(50),
  issuingState: z.string().trim().max(50).optional(),
  licenseExpiration: z.string().optional(),
  referralSource: z.string().min(1, "Please select how you found us"),
  agreement: z.literal(true, {
    errorMap: () => ({ message: "You must agree to the terms to continue" }),
  }),
  parentGuardianAck: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.idType === "drivers_license") {
    if (!data.issuingState || data.issuingState.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["issuingState"],
        message: "Issuing state is required",
      });
    }
    if (!data.licenseExpiration || data.licenseExpiration.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["licenseExpiration"],
        message: "License expiration date is required",
      });
    }
  } else if (data.idType === "other") {
    if (!data.otherIdType || data.otherIdType.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["otherIdType"],
        message: "Please specify the type of ID",
      });
    }
  }

  if (!data.dateOfBirth) return;
  const today = new Date();
  const birth = new Date(data.dateOfBirth);
  let a = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--;
  if (a < 18 && data.parentGuardianAck !== true) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["parentGuardianAck"],
      message: "A parent or legal guardian must acknowledge they will be making payment",
    });
  }
});

type RegistrationFormData = z.infer<typeof registrationSchema>;

const FALLBACK_REFERRALS = [
  "Google",
  "Learn To Ride VC Website",
  "Yelp",
  "Facebook",
  "Instagram",
  "Word of Mouth / Friend",
  "Other",
];

const RegisterPage = () => {
  const [searchParams] = useSearchParams();
  const course = searchParams.get("course") || "basic";
  const location = searchParams.get("location") || "ventura-county";
  const schedule = searchParams.get("schedule") || sessionStorage.getItem("selectedScheduleId") || "";
  const [referralOptions, setReferralOptions] = useState<string[]>(FALLBACK_REFERRALS);
  const [scheduleLabel, setScheduleLabel] = useState<string>("");

  useEffect(() => {
    if (!schedule) {
      setScheduleLabel("");
      return;
    }
    supabase
      .from("schedules")
      .select("date, schedule")
      .eq("id", schedule)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const dateStr = data.date
          ? new Date(`${data.date}T00:00:00`).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })
          : "";
        setScheduleLabel([dateStr, data.schedule].filter(Boolean).join(" · "));
      });
  }, [schedule]);

  useEffect(() => {
    supabase
      .from("referral_sources")
      .select("name")
      .eq("is_active", true)
      .order("sort_order")
      .order("name")
      .then(({ data }) => {
        if (data && data.length > 0) setReferralOptions(data.map(r => r.name));
      });
  }, []);

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

  const form = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    mode: "onChange",
    defaultValues: {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      idType: "drivers_license",
      otherIdType: "",
      licenseNumber: "",
      issuingCountry: "US",
      issuingState: "",
      licenseExpiration: "",
      referralSource: "",
    },
  });

  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [pendingBooking, setPendingBooking] = useState<Record<string, unknown> | null>(null);
  const [paymentRegion, setPaymentRegion] = useState<SquareRegion>("ventura");
  const [paymentAmountCents, setPaymentAmountCents] = useState(0);
  const [paymentAmountLabel, setPaymentAmountLabel] = useState("");
  const skipPaymentRef = useRef(false);
  const [waiverOpen, setWaiverOpen] = useState(false);
  const [waiverPrefill, setWaiverPrefill] = useState<WaiverPrefill | null>(null);

  const onSubmit = async (data: RegistrationFormData) => {
    setSubmitting(true);
    try {
      // Look up the actual selected schedule (by id) to get its price + date
      let scheduleId: string | null = null;
      let scheduleDate: string | null = null;
      let schedulePrice: string | null = null;
      if (schedule) {
        const { data: schedData } = await supabase
          .from("schedules")
          .select("id, date, price")
          .eq("id", schedule)
          .is("cancelled_at", null)
          .maybeSingle();
        if (schedData) {
          scheduleId = schedData.id;
          scheduleDate = schedData.date;
          schedulePrice = schedData.price;
        }
      }

      // Parse the schedule's price (e.g. "$1", "$425") into cents.
      // Fall back to age-based default only if no schedule price is available.
      const parsePriceCents = (p: string | null): number | null => {
        if (!p) return null;
        const n = Number(String(p).replace(/[^0-9.]/g, ""));
        if (!isFinite(n) || n <= 0) return null;
        return Math.round(n * 100);
      };

      const scheduleCents = parsePriceCents(schedulePrice);
      const feeLabel = scheduleCents != null
        ? (schedulePrice as string)
        : (isUnder21 ? "$395" : "$425");
      const feeCents = scheduleCents != null
        ? scheduleCents
        : (isUnder21 ? 39500 : 42500);
      const region: SquareRegion = location.startsWith("high-desert") ? "high_desert" : "ventura";

      const bookingPayload = {
        schedule_id: scheduleId,
        course,
        location,
        location_label: locationLabels[location] || location,
        schedule_date: scheduleDate,
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone: data.phone,
        gender: data.gender,
        date_of_birth: data.dateOfBirth,
        referral_source: data.referralSource,
        fee: feeLabel,
        address: data.address,
        city: data.city,
        state: data.state,
        zip: data.zip,
        license_number:
          data.idType === "other"
            ? `${data.otherIdType?.trim()}: ${data.licenseNumber}`
            : data.licenseNumber,
        issuing_country: data.issuingCountry,
        issuing_state: data.idType === "drivers_license" ? data.issuingState : null,
        license_expiration: data.idType === "drivers_license" ? data.licenseExpiration : null,
      };

      if (skipPaymentRef.current) {
        skipPaymentRef.current = false;
        const { error: insertErr } = await supabase.from("bookings").insert({
          ...bookingPayload,
          payment_status: "skipped",
          booking_status: "confirmed",
        });
        if (insertErr) throw insertErr;
        toast({ title: "Test booking saved", description: "Payment skipped (testing only)." });
        form.reset();
        navigate("/registration-confirmation");
        setSubmitting(false);
        return;
      }

      // Show waiver step first; payment opens after signing
      setPendingBooking(bookingPayload);
      setPaymentRegion(region);
      setPaymentAmountCents(feeCents);
      setPaymentAmountLabel(feeLabel);
      setWaiverPrefill({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
        licenseNumber: data.idType === "other"
          ? `${data.otherIdType?.trim()}: ${data.licenseNumber}`
          : data.licenseNumber,
        licenseState: data.idType === "drivers_license" ? data.issuingState : "",
        isMinor: isUnder18,
        course,
        location,
        locationLabel: locationLabels[location] || location,
        scheduleId: scheduleId,
        scheduleDate: scheduleDate,
      });
      setWaiverOpen(true);
    } catch (err) {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    }
    setSubmitting(false);
  };

  const handleWaiverSigned = (waiverId: string) => {
    setPendingBooking(prev => prev ? { ...prev, waiver_id: waiverId } : prev);
    setWaiverOpen(false);
    setPaymentOpen(true);
  };

  const handlePaymentSuccess = () => {
    form.reset();
    setPendingBooking(null);
    setWaiverPrefill(null);
    navigate("/registration-confirmation");
  };

  const dateOfBirth = useWatch({ control: form.control, name: "dateOfBirth" });
  const idType = useWatch({ control: form.control, name: "idType" });
  

  const age = dateOfBirth
    ? (() => {
        const today = new Date();
        const birth = new Date(dateOfBirth);
        let a = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--;
        return a;
      })()
    : null;

  const isUnder21 = age !== null && age < 21;
  const isUnder18 = age !== null && age < 18;
  const fee = isUnder21 ? "$395" : "$425";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="pt-40 pb-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent" />
        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <span className="inline-block bg-accent/20 text-accent font-bold px-4 py-2 rounded-full text-sm mb-6 border border-accent/30">
              {waiverOpen ? "Step 5 of 5 — Sign Waiver" : "Step 4 of 5"}
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Student <span className="text-accent">Registration</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-2">
              {waiverOpen ? "Review and electronically sign the CMSP waiver to continue." : "Complete the form below to reserve your spot."}
            </p>
            <p className="text-sm text-muted-foreground">
              {courseLabels[course] || course} · {locationLabels[location] || location}
              {scheduleLabel && ` · ${scheduleLabel}`}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="max-w-2xl mx-auto"
          >
            {waiverOpen && waiverPrefill ? (
              <WaiverStep
                prefill={waiverPrefill}
                onBack={() => setWaiverOpen(false)}
                onSigned={handleWaiverSigned}
              />
            ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* Personal Information */}
                <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
                  <h2 className="text-xl font-bold text-foreground mb-6">Personal Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="John" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="mt-4">
                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender *</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex gap-6 mt-2"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="male" id="male" />
                                <Label htmlFor="male">Male</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="female" id="female" />
                                <Label htmlFor="female">Female</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="other" id="other" />
                                <Label htmlFor="other">Other</Label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <FormField
                      control={form.control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth *</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              value={field.value}
                              onChange={(e) => {
                                field.onChange(e.target.value);
                              }}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                            />
                          </FormControl>
                          {dateOfBirth && (
                            <p className="text-xs text-accent font-medium mt-1">
                              {isUnder21 ? "Under 21" : "21 and over"} · Fee: {fee}
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone *</FormLabel>
                          <FormControl>
                            <Input type="tel" placeholder="(555) 123-4567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="mt-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email *</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="john@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
                  <h2 className="text-xl font-bold text-foreground mb-6">Address</h2>
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street Address *</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Main St" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City *</FormLabel>
                            <FormControl>
                              <Input placeholder="Los Angeles" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State *</FormLabel>
                            <FormControl>
                              <Input placeholder="CA" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="zip"
                        render={({ field }) => (
                          <FormItem className="col-span-2 md:col-span-1">
                            <FormLabel>ZIP *</FormLabel>
                            <FormControl>
                              <Input placeholder="90001" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* ID Information */}
                <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
                  <h2 className="text-xl font-bold text-foreground mb-2">ID Information</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    A valid government-issued ID is required. If you do not have a driver's license, you may use another form of ID such as a passport, school ID, state ID card, or military ID.
                  </p>

                  <FormField
                    control={form.control}
                    name="idType"
                    render={({ field }) => (
                      <FormItem className="mb-4">
                        <FormLabel>ID Type *</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex flex-col sm:flex-row gap-4 mt-2"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="drivers_license" id="id-dl" />
                              <Label htmlFor="id-dl">Driver's License</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="other" id="id-other" />
                              <Label htmlFor="id-other">Other ID (Passport, School ID, etc.)</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {idType === "other" && (
                    <div className="mb-4">
                      <FormField
                        control={form.control}
                        name="otherIdType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type of ID *</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Passport, School ID, State ID, Military ID" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="licenseNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {idType === "other" ? "ID Number *" : "License Number *"}
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={idType === "other" ? "ID number" : "D1234567"}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {idType === "drivers_license" && (
                      <FormField
                        control={form.control}
                        name="licenseExpiration"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expiration Date *</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    <FormField
                      control={form.control}
                      name="issuingCountry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Issuing Country *</FormLabel>
                          <FormControl>
                            <Input placeholder="US" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {idType === "drivers_license" && (
                      <FormField
                        control={form.control}
                        name="issuingState"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Issuing State *</FormLabel>
                            <FormControl>
                              <Input placeholder="CA" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </div>

                {/* Fee & Referral */}
                <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
                  <h2 className="text-xl font-bold text-foreground mb-6">Fee & Additional Info</h2>

                  <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 mb-6 text-center">
                    {dateOfBirth ? (
                      <>
                        <span className="text-sm text-muted-foreground">
                          {isUnder21 ? "Under 21" : "21 and over"} · Course Fee:{" "}
                        </span>
                        <span className="text-lg font-bold text-accent">{fee}</span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Enter your date of birth to calculate the fee
                      </span>
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name="referralSource"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>How did you find us? *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select one..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {referralOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Agreement */}
                <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-6">
                  <FormField
                    control={form.control}
                    name="agreement"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-3 leading-none">
                          <FormLabel className="text-sm leading-relaxed">
                            I have read, understand, and agree to the Gear Requirements and Return Policy below. I also attest that I am not in possession of a restricted license due to one or more convictions for driving while impaired. *
                          </FormLabel>

                          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-xs">
                            <div>
                              <p className="font-semibold text-foreground mb-1">Gear Requirements (bike & helmet provided)</p>
                              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                                <li>Sturdy over-the-ankle boots (no sneakers, sandals, or low-cut shoes)</li>
                                <li>Long, durable pants — denim jeans or Kevlar riding pants (no shorts, leggings, or sweats)</li>
                                <li>Long-sleeve shirt or jacket (riding jacket strongly recommended)</li>
                                <li>Full-finger gloves (no fingerless gloves)</li>
                                <li>Eye protection if your helmet doesn't have a face shield</li>
                              </ul>
                            </div>
                            <div>
                              <p className="font-semibold text-foreground mb-1">Return / Refund Policy</p>
                              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                                <li>Cancellations must be made at least 5 business days before the class start date for a refund or reschedule.</li>
                                <li>No refunds or reschedules for cancellations made within 5 business days of the class.</li>
                                <li>No-shows and late arrivals forfeit the full course fee.</li>
                                <li>Classes run rain or shine — weather is not grounds for a refund.</li>
                                <li>If we cancel a class, you will be rescheduled at no additional cost.</li>
                              </ul>
                            </div>
                          </div>

                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  {isUnder18 && (
                    <FormField
                      control={form.control}
                      name="parentGuardianAck"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border border-accent/40 bg-accent/10 p-4">
                          <FormControl>
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm leading-relaxed">
                              <span className="font-bold text-accent">Parent / Legal Guardian Acknowledgment (required for students under 18):</span>{" "}
                              Because the student is under 18 years old, a parent or legal guardian must be the one making the payment for this course. By checking this box, the parent or legal guardian acknowledges and agrees to this requirement. *
                            </FormLabel>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <div className="text-center space-y-3">
                  <Button type="submit" variant="hero" size="lg" className="px-12" disabled={submitting}>
                    {submitting ? "Submitting..." : "Continue to Payment Method"}
                  </Button>
                  <div>
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      disabled={submitting}
                      onClick={() => { skipPaymentRef.current = true; }}
                      className="text-xs text-muted-foreground"
                    >
                      ⚠ Skip Payment (Testing Only)
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
            )}
          </motion.div>
        </div>
      </section>

      <Footer />

      {pendingBooking && (
        <PaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          region={paymentRegion}
          amountCents={paymentAmountCents}
          amountLabel={paymentAmountLabel}
          bookingPayload={pendingBooking}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};

export default RegisterPage;

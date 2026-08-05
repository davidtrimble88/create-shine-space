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
import { startAttempt, updateAttempt } from "@/lib/registrationAttempts";
import { type SquareRegion } from "@/components/SquarePaymentDialog";
import { type WaiverPrefill } from "@/components/WaiverStep";
import { type RegistrationFormPrefill } from "@/components/RegistrationFormStep";
import { type ModelReleasePrefill } from "@/components/ModelReleaseStep";
import RegistrationFormDocuSign from "@/components/RegistrationFormDocuSign";
import ModelReleaseDocuSign from "@/components/ModelReleaseDocuSign";
import WaiverDocuSign from "@/components/WaiverDocuSign";
import Seo from "@/components/Seo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


const registrationSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  middleName: z.string().trim().min(1, "Middle name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  preferredName: z.string().trim().max(100).optional(),
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
  emergencyContactName: z.string().trim().min(1, "Emergency contact name is required").max(100),
  emergencyContactRelationship: z.string().trim().min(1, "Relationship is required").max(50),
  emergencyContactPhone: z.string().trim().min(7, "Emergency contact phone is required").max(20),
  bikeChoice: z.string().optional(),
  bikeYear: z.string().trim().max(10).optional(),
  bikeMake: z.string().trim().max(50).optional(),
  bikeModel: z.string().trim().max(50).optional(),
  agreement: z.literal(true, {
    errorMap: () => ({ message: "You must agree to the terms to continue" }),
  }),
  parentGuardianAck: z.boolean().optional(),
  idPhotoPath: z.string().optional(),
  guardianFirstName: z.string().trim().max(100).optional(),
  guardianLastName: z.string().trim().max(100).optional(),
  guardianRelationship: z.string().trim().max(50).optional(),
  guardianEmail: z.string().trim().max(255).optional().or(z.literal("")),
  guardianPhone: z.string().trim().max(20).optional(),
  guardianIdPhotoPath: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.idType === "drivers_license") {
    if (!data.issuingState || data.issuingState.trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["issuingState"], message: "Issuing state is required" });
    }
    if (!data.licenseExpiration || data.licenseExpiration.trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["licenseExpiration"], message: "License expiration date is required" });
    }
  } else if (data.idType === "other") {
    if (!data.otherIdType || data.otherIdType.trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["otherIdType"], message: "Please specify the type of ID" });
    }
  }

  if (!data.dateOfBirth) return;
  const today = new Date();
  const birth = new Date(data.dateOfBirth);
  let a = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--;
  if (a < 18) {
    if (data.parentGuardianAck !== true) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["parentGuardianAck"], message: "A parent or legal guardian must acknowledge and sign for the minor" });
    }
    const required: Array<[keyof typeof data, string]> = [
      ["guardianFirstName", "Parent/guardian first name is required"],
      ["guardianLastName", "Parent/guardian last name is required"],
      ["guardianRelationship", "Relationship is required"],
      ["guardianPhone", "Parent/guardian phone is required"],
    ];
    for (const [key, msg] of required) {
      const v = (data as any)[key];
      if (!v || String(v).trim() === "") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: msg });
      }
    }
    const ge = (data.guardianEmail || "").trim();
    if (ge && !/^\S+@\S+\.\S+$/.test(ge)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["guardianEmail"], message: "Valid email required" });
    }
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
  // Intermediate registrations are split into two tracks: IRC (has M1) and
  // 1DPC (no M1 — registered under the 1-Day Premier Course with Licensing).
  const track = searchParams.get("track");
  const isIrcTrack = course === "intermediate" && track !== "1dpc";
  const is1dpcTrack = course === "intermediate" && track === "1dpc";
  const schedule = searchParams.get("schedule") || sessionStorage.getItem("selectedScheduleId") || "";
  const isCalibrate = searchParams.get("calibrate") === "1";
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
    basic: "Motorcyclist Training Course",
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
      middleName: "",
      lastName: "",
      preferredName: "",
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
      emergencyContactName: "",
      emergencyContactRelationship: "",
      emergencyContactPhone: "",
      bikeChoice: "",
      bikeYear: "",
      bikeMake: "",
      bikeModel: "",
      guardianFirstName: "",
      guardianLastName: "",
      guardianRelationship: "",
      guardianEmail: "",
      guardianPhone: "",
      idPhotoPath: "",
      guardianIdPhotoPath: "",
    },
  });

  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [pendingBooking, setPendingBooking] = useState<Record<string, unknown> | null>(null);
  const [pendingGroupName, setPendingGroupName] = useState<string | null>(null);
  const [pendingScheduleDetail, setPendingScheduleDetail] = useState<string | null>(null);
  const [paymentRegion, setPaymentRegion] = useState<SquareRegion>("ventura");
  const [paymentAmountCents, setPaymentAmountCents] = useState(0);
  const [paymentAmountLabel, setPaymentAmountLabel] = useState("");
  const skipPaymentRef = useRef(false);
  const [waiverOpen, setWaiverOpen] = useState(false);
  const [waiverPrefill, setWaiverPrefill] = useState<WaiverPrefill | null>(null);
  const [regFormOpen, setRegFormOpen] = useState(false);
  const [regFormPrefill, setRegFormPrefill] = useState<RegistrationFormPrefill | null>(null);
  const [modelReleaseOpen, setModelReleaseOpen] = useState(false);
  const [modelReleasePrefill, setModelReleasePrefill] = useState<ModelReleasePrefill | null>(null);
  const [returningStudent, setReturningStudent] = useState(false);
  const [discountCodeInput, setDiscountCodeInput] = useState("");
  const [discountApplied, setDiscountApplied] = useState<
    | { source: "returning" | "code"; amountCents: number; code?: string; codeId?: string }
    | null
  >(null);
  const attemptIdRef = useRef<string | null>(null);
  const [discountBusy, setDiscountBusy] = useState<null | "returning" | "code">(null);
  const [discountNotice, setDiscountNotice] = useState<string | null>(null);
  const [intReturnCents, setIntReturnCents] = useState<number>(7500);
  const [advReturnCents, setAdvReturnCents] = useState<number>(7500);

  // Pre-waivers gate: choose to sign online now or in person at class.
  const [waiverGateOpen, setWaiverGateOpen] = useState(false);
  const [minorAckChecked, setMinorAckChecked] = useState(false);
  // When true, the parent/guardian will sign the minor's forms IN PERSON at the first class.
  // Guardian signature blocks in the online DocuSign flow are skipped.
  const [guardianSignsInPerson, setGuardianSignsInPerson] = useState(false);

  const isDiscountEligibleCourse = course === "intermediate" || course === "advanced";
  const defaultDiscountCents = course === "advanced" ? advReturnCents : intReturnCents;

  useEffect(() => {
    (supabase as any)
      .rpc("get_returning_discount_defaults")
      .then(({ data }: any) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.intermediate_returning_amount_cents != null) {
          setIntReturnCents(row.intermediate_returning_amount_cents);
        }
        if (row?.advanced_returning_amount_cents != null) {
          setAdvReturnCents(row.advanced_returning_amount_cents);
        }
      });
  }, []);


  // Clear any applied discount if the checkbox is turned off
  useEffect(() => {
    if (!returningStudent && discountApplied?.source === "returning") {
      setDiscountApplied(null);
      setDiscountNotice(null);
    }
  }, [returningStudent, discountApplied]);

  // 1DPC students must use a provided training motorcycle.
  useEffect(() => {
    if (is1dpcTrack) {
      form.setValue("bikeChoice", "provided", { shouldValidate: true });
    }
  }, [is1dpcTrack, form]);

  const formatScheduleDate = (iso: string | null) => {
    if (!iso) return "";
    // Parse YYYY-MM-DD as a local date (avoid UTC shift)
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!m) return iso;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  };

  // Expand schedule detail like "Sat 6:45am–5:00pm, Sun 6:45am–5:00pm" into
  // dated lines using the schedule's start date. First weekday token = startIso.
  const expandScheduleDetailWithDates = (
    detail: string | null,
    startIso: string | null,
  ): string => {
    if (!detail) return "";
    if (!startIso) return detail;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(startIso);
    if (!m) return detail;
    const dowMap: Record<string, number> = {
      sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6,
    };
    const start = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const startDow = start.getDay();
    const parts = detail.split(/\s*,\s*/).filter(Boolean);
    const out: string[] = [];
    for (const part of parts) {
      const mm = /^([A-Za-z]+)\s+(.*)$/.exec(part.trim());
      if (!mm) { out.push(part); continue; }
      const dow = dowMap[mm[1].toLowerCase()];
      if (dow === undefined) { out.push(part); continue; }
      const offset = (dow - startDow + 7) % 7;
      const d = new Date(start);
      d.setDate(start.getDate() + offset);
      const dateLabel = d.toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric", year: "numeric",
      });
      out.push(`${dateLabel} — ${mm[2]}`);
    }
    return out.join("\n");
  };

  const fireRegistrationEmail = async (payload: {
    email: string;
    firstName: string;
    lastName: string;
    courseKey: string;
    courseLabel: string;
    locationLabel: string;
    location: string;
    groupName: string | null;
    scheduleDate: string | null;
    scheduleDetail: string | null;
    fee: string;
    additionalRecipients?: string[];
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke("send-auto-email", {
        body: {
          trigger_event: "registration_confirmation",
          recipientEmail: payload.email,
          location: payload.location,
          groupName: payload.groupName,
          course: payload.courseKey,
          additionalRecipients: payload.additionalRecipients ?? [],
          variables: {
            firstName: payload.firstName,
            lastName: payload.lastName,
            course: payload.courseLabel,
            locationLabel: payload.locationLabel,
            groupName: payload.groupName || "",
            scheduleDate: formatScheduleDate(payload.scheduleDate),
            scheduleDetail: expandScheduleDetailWithDates(payload.scheduleDetail, payload.scheduleDate),
            schedule: expandScheduleDetailWithDates(payload.scheduleDetail, payload.scheduleDate),
            scheduleTimes: payload.scheduleDetail || "",
            fee: payload.fee,
            email: payload.email,
          },
        },
      });


      if (error) throw error;

      if (data && typeof data === "object" && "skipped" in data && data.skipped) {
        console.warn("Auto email was skipped:", data);
      }
    } catch (e) {
      console.warn("Auto email failed to dispatch:", e);
    }
  };

  const completeRegistration = (booking: any) => {
    const guardianEmail = (waiverPrefill?.guardianEmail || "").trim();
    const additionalRecipients =
      waiverPrefill?.isMinor && guardianEmail && guardianEmail.toLowerCase() !== booking.email.toLowerCase()
        ? [guardianEmail]
        : [];
    fireRegistrationEmail({
      email: booking.email,
      firstName: booking.first_name,
      lastName: booking.last_name,
      courseKey: booking.course,
      courseLabel: courseLabels[booking.course] || booking.course,
      locationLabel: booking.location_label,
      location: booking.location,
      groupName: pendingGroupName,
      scheduleDate: booking.schedule_date,
      scheduleDetail: pendingScheduleDetail,
      fee: booking.fee,
      additionalRecipients,
    });

    form.reset();
    setPendingBooking(null);
    setPendingGroupName(null);
    setPendingScheduleDetail(null);
    setPaymentOpen(false);
    setWaiverPrefill(null);
    setRegFormPrefill(null);
    setModelReleasePrefill(null);
    navigate("/registration-confirmation");
  };

  const saveBooking = async (
    booking: any,
    paymentStatus: "skipped" | "unpaid",
    paymentProvider?: string,
  ) => {
    const { data, error } = await supabase.functions.invoke("create-booking", {
      body: {
        booking,
        paymentStatus,
        paymentProvider,
        discountCodeId: discountApplied?.source === "code" ? discountApplied.codeId : undefined,
      },
    });

    if (error) {
      throw new Error(error.message || "Could not save booking");
    }

    if (data && typeof data === "object" && "error" in data && (data as any).error) {
      throw new Error(String((data as any).error));
    }

    return data;
  };

  const formatCents = (cents: number) =>
    `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;

  const validateReturningDiscount = async () => {
    const licenseNumber = form.getValues("licenseNumber")?.trim();
    if (!licenseNumber) {
      setDiscountNotice("Enter your driver's license / ID number above, then check the box again.");
      setReturningStudent(false);
      return;
    }
    setDiscountBusy("returning");
    setDiscountNotice(null);
    try {
      const { data } = await supabase.functions.invoke("validate-discount", {
        body: { course, source: "returning", licenseNumber },
      });
      const res = data as any;
      if (res?.valid) {
        setDiscountApplied({ source: "returning", amountCents: res.amountCents });
        setDiscountNotice(null);
        toast({ title: "Returning-student discount applied", description: `${formatCents(res.amountCents)} off.` });
      } else {
        setDiscountApplied((prev) => (prev?.source === "returning" ? null : prev));
        setDiscountNotice(res?.error || "We couldn't find your ID number in our past student records. Please call the office and we'll verify your history and issue you a discount code.");
      }
    } catch (e) {
      setDiscountNotice(e instanceof Error ? e.message : "Could not verify prior registration.");
    }
    setDiscountBusy(null);
  };

  const validateDiscountCode = async () => {
    const code = discountCodeInput.trim();
    if (!code) {
      setDiscountNotice("Enter a discount code.");
      return;
    }
    setDiscountBusy("code");
    setDiscountNotice(null);
    try {
      const { data } = await supabase.functions.invoke("validate-discount", {
        body: { course, source: "code", code },
      });
      const res = data as any;
      if (res?.valid) {
        setDiscountApplied({ source: "code", amountCents: res.amountCents, code: res.code, codeId: res.codeId });
        setDiscountNotice(null);
        toast({ title: "Discount code applied", description: `${formatCents(res.amountCents)} off your Intermediate Course.` });
      } else {
        setDiscountApplied((prev) => (prev?.source === "code" ? null : prev));
        setDiscountNotice(res?.error || "That code is not valid.");
      }
    } catch (e) {
      setDiscountNotice(e instanceof Error ? e.message : "Could not validate that code.");
    }
    setDiscountBusy(null);
  };

  const clearDiscount = () => {
    setDiscountApplied(null);
    setDiscountNotice(null);
    setReturningStudent(false);
    setDiscountCodeInput("");
  };



  const onSubmit = async (data: RegistrationFormData) => {
    // IRC riders must give bike details. 1DPC riders always use provided bikes.
    if (isIrcTrack) {
      let missing = false;
      for (const [key, msg] of [
        ["bikeYear", "Year is required"],
        ["bikeMake", "Make is required"],
        ["bikeModel", "Model is required"],
      ] as const) {
        if (!String((data as any)[key] || "").trim()) {
          form.setError(key, { message: msg });
          missing = true;
        }
      }
      if (missing) {
        toast({
          title: "Motorcycle information required",
          description: "Please tell us the year, make and model of the motorcycle you're bringing.",
          variant: "destructive",
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      // Look up the actual selected schedule (by id) to get its price + date
      let scheduleId: string | null = null;
      let scheduleDate: string | null = null;
      let scheduleDetail: string | null = null;
      let schedulePrice: string | null = null;
      let scheduleGroup: string | null = null;
      if (schedule) {
        const { data: schedData } = await supabase
          .from("schedules")
          .select("id, date, price, group_name, schedule")
          .eq("id", schedule)
          .is("cancelled_at", null)
          .maybeSingle();
        if (schedData) {
          scheduleId = schedData.id;
          scheduleDate = schedData.date;
          scheduleDetail = (schedData as any).schedule ?? null;
          schedulePrice = schedData.price;
          scheduleGroup = (schedData as any).group_name ?? null;
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
      const baseFeeCents = scheduleCents != null
        ? scheduleCents
        : (isUnder21 ? 39500 : 42500);

      // Apply discount codes for any course; returning-student discount only for Intermediate/Advanced.
      const canApplyDiscount =
        discountApplied &&
        (discountApplied.source === "code" || isDiscountEligibleCourse);
      const discountCents = canApplyDiscount
        ? Math.min(discountApplied.amountCents, Math.max(baseFeeCents - 100, 0))
        : 0;
      const feeCents = Math.max(baseFeeCents - discountCents, 100);
      const feeLabel = discountCents > 0
        ? formatCents(feeCents)
        : (scheduleCents != null ? (schedulePrice as string) : (isUnder21 ? "$395" : "$425"));
      const region: SquareRegion = location.startsWith("high-desert") ? "high_desert" : "ventura";

      const bookingPayload = {
        id: crypto.randomUUID(),
        schedule_id: scheduleId,
        course,
        location,
        location_label: locationLabels[location] || location,
        schedule_date: scheduleDate,
        first_name: data.firstName,
        middle_name: data.middleName || null,
        last_name: data.lastName,
        preferred_name: data.preferredName || null,
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
        id_photo_path: data.idPhotoPath || null,
        guardian_id_photo_path: isUnder18 ? (data.guardianIdPhotoPath || null) : null,
        emergency_contact_name: data.emergencyContactName || null,
        emergency_contact_relationship: data.emergencyContactRelationship || null,
        emergency_contact_phone: data.emergencyContactPhone || null,
        guardian_name: isUnder18
          ? [data.guardianFirstName, data.guardianLastName].filter(Boolean).join(" ").trim() || null
          : null,
        guardian_relationship: isUnder18 ? (data.guardianRelationship || null) : null,
        guardian_phone: isUnder18 ? (data.guardianPhone || null) : null,
        guardian_email: isUnder18 ? (data.guardianEmail || null) : null,
        rider_track: course === "intermediate" ? (is1dpcTrack ? "1dpc" : "irc") : null,
        bike_info:
          isIrcTrack
            ? [data.bikeYear, data.bikeMake, data.bikeModel].map(v => String(v || "").trim()).filter(Boolean).join(" ") || null
            : is1dpcTrack
              ? "Provided bike"
              : null,
        roster_comment: is1dpcTrack ? "1DPC" : null,
        discount_amount_cents: discountCents,
        discount_reason: discountCents > 0 ? (discountApplied?.source === "code" ? "code" : "returning_student") : null,
        discount_code: discountCents > 0 && discountApplied?.source === "code" ? (discountApplied.code || null) : null,
      };

      // Track this attempt so staff can see anyone who starts but doesn't finish.
      attemptIdRef.current = await startAttempt({
        stage: "payment",
        course,
        location_label: locationLabels[location] || location,
        schedule_id: scheduleId,
        schedule_date: scheduleDate,
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone: data.phone,
        amount_cents: feeCents,
        booking_id: bookingPayload.id,
      });

      if (skipPaymentRef.current) {
        skipPaymentRef.current = false;
        await saveBooking(bookingPayload, "skipped");
        toast({ title: "Test booking saved", description: "Payment skipped (testing only)." });
        completeRegistration(bookingPayload);
        setSubmitting(false);
        return;
      }

      // Show CMSP Student Registration Form step first, then waiver, then payment.
      setPendingBooking(bookingPayload);
      setPendingGroupName(scheduleGroup);
      setPendingScheduleDetail(scheduleDetail);
      setPaymentRegion(region);
      setPaymentAmountCents(feeCents);
      setPaymentAmountLabel(feeLabel);
      setWaiverPrefill({
        firstName: data.firstName,
        middleName: data.middleName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
        licenseNumber: data.idType === "other"
          ? `${data.otherIdType?.trim()}: ${data.licenseNumber}`
          : data.licenseNumber,
        licenseState: data.idType === "drivers_license" ? data.issuingState : "",
        isMinor: isUnder18,
        guardianFirstName: isUnder18 ? data.guardianFirstName : undefined,
        guardianLastName: isUnder18 ? data.guardianLastName : undefined,
        guardianRelationship: isUnder18 ? data.guardianRelationship : undefined,
        guardianEmail: isUnder18 ? data.guardianEmail : undefined,
        guardianPhone: isUnder18 ? data.guardianPhone : undefined,
        course,
        location,
        locationLabel: locationLabels[location] || location,
        scheduleId: scheduleId,
        scheduleDate: scheduleDate,
      });
      setRegFormPrefill({
        firstName: data.firstName,
        middleName: data.middleName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
        sex: data.gender === "male" ? "M" : data.gender === "female" ? "F" : "",
        addressStreet: data.address,
        addressCity: data.city,
        addressState: data.state,
        addressZip: data.zip,
        idType: data.idType === "other" ? "other" : "drivers_license",
        idNumber: data.idType === "other"
          ? `${data.otherIdType?.trim() || "ID"}: ${data.licenseNumber}`
          : data.licenseNumber,
        idState: data.idType === "drivers_license" ? data.issuingState : "",
        idCountry: data.issuingCountry,
        idExpiration: data.idType === "drivers_license" ? data.licenseExpiration : "",
        referralSource: data.referralSource,
        course,
        location,
        locationLabel: locationLabels[location] || location,
        scheduleId: scheduleId,
        scheduleDate: scheduleDate,
        isMinor: isUnder18,
        guardianFirstName: isUnder18 ? data.guardianFirstName : undefined,
        guardianLastName: isUnder18 ? data.guardianLastName : undefined,
        guardianRelationship: isUnder18 ? data.guardianRelationship : undefined,
      });

      setModelReleasePrefill({
        firstName: data.firstName,
        middleName: data.middleName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
        addressStreet: data.address,
        addressCity: data.city,
        addressState: data.state,
        addressZip: data.zip,
        isMinor: isUnder18,
        guardianFirstName: isUnder18 ? data.guardianFirstName : undefined,
        guardianLastName: isUnder18 ? data.guardianLastName : undefined,
        guardianRelationship: isUnder18 ? data.guardianRelationship : undefined,
        guardianPhone: isUnder18 ? data.guardianPhone : undefined,
        guardianEmail: isUnder18 ? data.guardianEmail : undefined,
        course,
        location,
        locationLabel: locationLabels[location] || location,
        scheduleId: scheduleId,
        scheduleDate: scheduleDate,
      });
      // Minors get a gate: sign online now, or skip and have parent/guardian sign in person.
      // Adults always sign online — no skip option.
      setMinorAckChecked(false);
      setGuardianSignsInPerson(false);
      if (isUnder18) {
        setWaiverGateOpen(true);
      } else {
        setRegFormOpen(true);
        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (attemptIdRef.current) {
        updateAttempt(attemptIdRef.current, { status: "form_error", stage: "registration_form", error_message: msg });
      } else {
        startAttempt({
          status: "form_error",
          stage: "registration_form",
          error_message: msg,
          course,
          location_label: locationLabels[location] || location,
          first_name: data.firstName,
          last_name: data.lastName,
          email: data.email,
          phone: data.phone,
        });
      }
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    }
    setSubmitting(false);
  };

  const handleGateSignOnline = () => {
    // Guardian will sign in person at first class only if the student is a minor.
    setGuardianSignsInPerson(isUnder18);
    setWaiverGateOpen(false);
    setRegFormOpen(true);
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  };

  const handleGateSignInPerson = () => {
    // Skip all three online signing steps and go straight to payment.
    setGuardianSignsInPerson(false);
    setWaiverGateOpen(false);
    paymentCompletedRef.current = false;
    setPaymentOpen(true);
  };

  const handleRegistrationFormSigned = (_recordId: string) => {
    setRegFormOpen(false);
    setModelReleaseOpen(true);
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  };



  const handleModelReleaseComplete = (_recordId: string, _decision: "sign" | "decline") => {
    setModelReleaseOpen(false);
    // Always run the waiver step. For minors whose guardian will sign in person,
    // the waiver wizard captures the minor's info + own signature and saves a
    // partially-completed PDF for the guardian to sign at the first class.
    setWaiverOpen(true);
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  };

  const paymentCompletedRef = useRef(false);

  const handleWaiverSigned = (waiverId: string) => {
    setPendingBooking(prev => prev ? { ...prev, waiver_id: waiverId } : prev);
    setWaiverOpen(false);
    paymentCompletedRef.current = false;
    setPaymentOpen(true);
  };

  const handlePaymentSuccess = () => {
    paymentCompletedRef.current = true;
    updateAttempt(attemptIdRef.current, { status: "completed", stage: "complete", error_message: null });
    if (pendingBooking) {
      completeRegistration(pendingBooking as any);
    }
  };

  // If the user tries to close the payment dialog without paying, show a
  // confirmation warning. Only cancel (do not register) if they explicitly
  // confirm. Otherwise, keep the payment dialog open so they can pay.
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const handlePaymentDialogChange = (open: boolean) => {
    if (open) {
      setPaymentOpen(true);
      return;
    }
    if (paymentCompletedRef.current || !pendingBooking) {
      setPaymentOpen(false);
      return;
    }
    // User attempted to close without paying — ask for confirmation.
    setCancelConfirmOpen(true);
  };

  const handleConfirmCancelPayment = () => {
    setCancelConfirmOpen(false);
    setPaymentOpen(false);
    setPendingBooking(null);
    updateAttempt(attemptIdRef.current, { status: "abandoned", stage: "payment", error_message: "Customer cancelled at the payment step" });
    toast({
      title: "Registration cancelled",
      description: "Your spot was not reserved. You can register again anytime.",
    });
  };

  const handleGoBackToPayment = () => {
    setCancelConfirmOpen(false);
    setPaymentOpen(true);
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
      <Seo title={"Register for a Motorcycle Class — Learn to Ride VC"} description={"Complete your registration for CMSP-certified motorcycle training. Bike and helmet provided for the Motorcyclist Training Course."} path="/register" />
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
              {waiverOpen ? "Step 7 of 7 — Sign Waiver"
                : modelReleaseOpen ? "Step 6 of 7 — Model Release"
                : regFormOpen ? "Step 5 of 7 — Sign Registration Form"
                : "Step 4 of 7"}
            </span>

            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Student <span className="text-accent">Registration</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-2">
              {waiverOpen ? "Review and electronically sign the CMSP waiver to continue."
                : modelReleaseOpen ? "Choose whether to allow photo / video of you during the course — or decline."
                : regFormOpen ? "Review and electronically sign the CMSP Student Registration Form."
                : "Complete the form below to reserve your spot."}
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
            className={(waiverOpen && waiverPrefill) || (regFormOpen && regFormPrefill) || (modelReleaseOpen && modelReleasePrefill) ? "max-w-5xl mx-auto" : "max-w-2xl mx-auto"}
          >
            {regFormOpen && regFormPrefill ? (
              <RegistrationFormDocuSign
                prefill={{ ...regFormPrefill, guardianInPerson: guardianSignsInPerson }}
                onBack={() => setRegFormOpen(false)}
                onSigned={handleRegistrationFormSigned}
              />
            ) : modelReleaseOpen && modelReleasePrefill ? (
              <ModelReleaseDocuSign
                prefill={{ ...modelReleasePrefill, guardianInPerson: guardianSignsInPerson }}
                onBack={() => setModelReleaseOpen(false)}
                onComplete={handleModelReleaseComplete}
              />
            ) : waiverOpen && waiverPrefill ? (
              <WaiverDocuSign
                prefill={{ ...waiverPrefill, guardianInPerson: guardianSignsInPerson }}
                onBack={() => setWaiverOpen(false)}
                onSigned={handleWaiverSigned}
              />
            ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {is1dpcTrack && (
                  <div className="rounded-2xl border border-accent/40 bg-accent/10 p-5 md:p-6">
                    <h2 className="text-base md:text-lg font-bold text-accent mb-1">
                      You are registering for the 1-Day Premier Course with Licensing
                    </h2>
                    <p className="text-sm text-foreground/85">
                      Because you don't have your M1 yet, your seat in this class is booked under the
                      1-Day Premier Course with Licensing. An entry skills test is required on class day,
                      and you confirmed you can pass it after reviewing the entrance skills video.
                    </p>
                  </div>
                )}
                {/* Personal Information */}
                <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
                  <h2 className="text-xl font-bold text-foreground mb-6">Personal Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Legal First Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="John" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="middleName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Legal Middle Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Middle name" {...field} />
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
                          <FormLabel>Legal Last Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="preferredName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preferred Name</FormLabel>
                          <FormControl>
                            <Input placeholder="What should we call you?" {...field} />
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

                {/* Mailing Address */}
                <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
                  <h2 className="text-xl font-bold text-foreground mb-6">Mailing Address</h2>
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

                  <div className="rounded-lg border border-accent/40 bg-accent/5 p-4 mb-6 space-y-4">
                    {isDiscountEligibleCourse && (
                      <>
                        <div>
                          <h3 className="text-sm font-bold text-accent">Returning-Student Discount</h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            Prior students of Learn to Ride VC receive {formatCents(defaultDiscountCents)} off the {course === "advanced" ? "Advanced Riding Clinic" : "Intermediate Course"}.
                          </p>
                        </div>

                        <label className="flex items-start gap-3 text-sm">
                          <Checkbox
                            checked={returningStudent}
                            disabled={discountBusy !== null}
                            onCheckedChange={(v) => {
                              const checked = !!v;
                              setReturningStudent(checked);
                              if (checked) {
                                validateReturningDiscount();
                              }
                            }}
                          />
                          <span className="leading-snug">
                            I've taken a class with Learn to Ride VC before — look up my ID number and apply my returning-student discount.
                            {discountBusy === "returning" && (
                              <span className="block text-xs text-muted-foreground mt-1">Checking your ID number…</span>
                            )}
                          </span>
                        </label>
                      </>
                    )}

                    <div className={isDiscountEligibleCourse ? "pt-3 border-t border-border/60" : ""}>
                      <p className="text-xs font-medium text-foreground mb-2">Have a discount code?</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          placeholder="Enter code"
                          value={discountCodeInput}
                          onChange={(e) => setDiscountCodeInput(e.target.value)}
                          className="max-w-xs"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={validateDiscountCode}
                          disabled={discountBusy !== null || !discountCodeInput.trim()}
                        >
                          {discountBusy === "code" ? "Checking..." : "Apply code"}
                        </Button>
                      </div>
                    </div>

                    {discountApplied && (
                      <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-500 flex items-center justify-between gap-3">
                        <span>
                          ✓ {formatCents(discountApplied.amountCents)} discount applied
                          {discountApplied.source === "code" && discountApplied.code ? ` (code: ${discountApplied.code})` : " (returning student)"}
                        </span>
                        <Button type="button" variant="ghost" size="sm" onClick={clearDiscount} className="h-7 text-xs">
                          Remove
                        </Button>
                      </div>
                    )}

                    {discountNotice && !discountApplied && (
                      <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive">
                        {discountNotice}
                      </div>
                    )}
                  </div>


                  <FormField
                    control={form.control}
                    name="referralSource"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>How did you find us? *</FormLabel>
                        <FormControl>
                          <select
                            name={field.name}
                            ref={field.ref}
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="">Select one...</option>
                            {referralOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* 1DPC — provided training motorcycle only */}
                {is1dpcTrack && (
                  <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-6">
                    <div>
                      <h2 className="text-xl font-bold">Your Motorcycle</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        The 1-Day Premier Course uses one of our provided training motorcycles. Personal motorcycles are not permitted for this course.
                      </p>
                    </div>
                    <div className="rounded-lg border border-accent/40 bg-accent/10 p-4 text-sm text-foreground/90">
                      A training motorcycle and helmet are provided for this course.
                    </div>
                  </div>
                )}

                {/* IRC — motorcycle information */}
                {isIrcTrack && (
                  <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-6">
                    <div>
                      <h2 className="text-xl font-bold">Your Motorcycle</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        The Intermediate Course (IRC) is ridden on your own motorcycle. Tell us what you'll be bringing.
                      </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                      <FormField control={form.control} name="bikeYear" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Year *</FormLabel>
                          <FormControl><Input placeholder="2021" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="bikeMake" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Make *</FormLabel>
                          <FormControl><Input placeholder="Honda" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="bikeModel" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model *</FormLabel>
                          <FormControl><Input placeholder="CB500F" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>
                )}

                {/* Emergency Contact */}
                <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-6">
                  <div>
                    <h2 className="text-xl font-bold">Emergency Contact</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Someone we can reach on class day if needed. Please use a person who is not attending the class with you.
                    </p>
                  </div>
                  <div className="grid md:grid-cols-3 gap-6">
                    <FormField control={form.control} name="emergencyContactName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name *</FormLabel>
                        <FormControl><Input placeholder="Jane Doe" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="emergencyContactRelationship" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Relationship *</FormLabel>
                        <FormControl><Input placeholder="Spouse, parent, friend…" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="emergencyContactPhone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone *</FormLabel>
                        <FormControl><Input type="tel" placeholder="(805) 555-0123" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
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
                                {is1dpcTrack || isIrcTrack ? (
                                  <li>Leather or armored motorcycle jacket required</li>
                                ) : (
                                  <li>Long-sleeve shirt or jacket (riding jacket strongly recommended)</li>
                                )}
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
                    <div className="rounded-lg border border-accent/40 bg-accent/10 p-4 md:p-6 space-y-4">
                      <div>
                        <h3 className="text-base font-bold text-accent">Parent / Legal Guardian Information</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Required because the student is under 18. The parent or legal guardian must complete this section, sign the waiver electronically, and present a matching photo ID at check-in.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="guardianFirstName" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Guardian Legal First Name *</FormLabel>
                            <FormControl><Input placeholder="Jane" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="guardianLastName" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Guardian Legal Last Name *</FormLabel>
                            <FormControl><Input placeholder="Doe" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <FormField control={form.control} name="guardianRelationship" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Relationship to Minor *</FormLabel>
                          <FormControl>
                            <select
                              name={field.name}
                              ref={field.ref}
                              value={field.value || ""}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <option value="">Select one...</option>
                              <option value="Mother">Mother</option>
                              <option value="Father">Father</option>
                              <option value="Legal Guardian">Legal Guardian</option>
                              <option value="Stepparent">Stepparent</option>
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="guardianPhone" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Guardian Phone *</FormLabel>
                            <FormControl><Input type="tel" placeholder="(555) 123-4567" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="guardianEmail" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Guardian Email</FormLabel>
                            <FormControl><Input type="email" placeholder="parent@example.com" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>



                      <FormField control={form.control} name="parentGuardianAck" render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-accent/40 bg-background/40 p-3">
                          <FormControl>
                            <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-xs leading-relaxed">
                              I certify that I am the parent or legal guardian of the minor named above. I understand that I must attend the start of the first class to give permission and sign all required paperwork. If the first class is held via Zoom, I will appear on camera, identify myself, and give verbal permission. If the first class is held in person, I must be physically present at the class location. All CMSP waivers and registration forms will be signed in person at the first in person class, and I will present a matching photo ID at check-in. *
                            </FormLabel>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )} />
                    </div>
                  )}
                </div>

                <div className="text-center space-y-3">
                  <Button type="submit" variant="hero" size="lg" className="px-12" disabled={submitting}>
                    {submitting ? "Submitting..." : "Sign Waivers"}
                  </Button>
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
          onOpenChange={handlePaymentDialogChange}
          region={paymentRegion}
          amountCents={paymentAmountCents}
          amountLabel={paymentAmountLabel}
          bookingPayload={pendingBooking}
          discount={discountApplied ? { source: discountApplied.source, code: discountApplied.code } : undefined}
          onSuccess={handlePaymentSuccess}
          onFailure={({ stage, message }) =>
            updateAttempt(attemptIdRef.current, {
              status: stage === "setup" ? "payment_setup_failed" : "payment_failed",
              stage: stage === "setup" ? "payment_form" : "payment_charge",
              error_message: message,
            })
          }
        />
      )}

      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel payment and lose your spot?</AlertDialogTitle>
            <AlertDialogDescription>
              Your spot in this class will <strong>not be reserved</strong> until payment is completed.
              If you cancel now, no registration will be created and you'll need to start over to sign up.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleGoBackToPayment}>Go back to payment</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancelPayment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, cancel registration
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pre-waivers gate: choose to sign online now or in person at the first class */}
      <AlertDialog open={waiverGateOpen} onOpenChange={setWaiverGateOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Sign your waivers now, or in person at class?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  You can complete your Registration Form, Model Release, and Waiver online now
                  in about 5 minutes, or skip the online forms and sign the paper copies in
                  person at the start of your first in person class.
                </p>
                {isUnder18 && (
                  <div className="rounded-lg border border-amber-500/60 bg-amber-500/10 p-2.5 space-y-1.5">
                    <p className="text-sm font-semibold text-foreground">
                      ⚠️ Important — student is under 18
                    </p>
                    <p className="text-sm text-foreground/90">
                      A <strong>parent or legal guardian must attend the start of the first class</strong>{" "}
                      to give permission and sign all required paperwork. If the first class is held via{" "}
                      <strong>Zoom</strong>, the parent or legal guardian must appear on camera, identify
                      themselves, and give verbal permission. If the first class is held <strong>in person</strong>,
                      the parent or legal guardian must be physically present at the class location. All
                      waivers and release forms will be signed in person at the first in person class. The minor
                      will not be allowed to ride until the parent/guardian has signed in person.
                    </p>
                    <label className="flex items-start gap-2 pt-1 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={minorAckChecked}
                        onChange={e => setMinorAckChecked(e.target.checked)}
                      />
                      <span className="text-foreground">
                        I understand a parent/legal guardian must attend the start of the first class to
                        give permission and sign all required paperwork in person at the first in person class.
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel>Back</AlertDialogCancel>
            <button
              type="button"
              onClick={handleGateSignInPerson}
              disabled={isUnder18 && !minorAckChecked}
              className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Skip — sign in person at class
            </button>
            <button
              type="button"
              onClick={handleGateSignOnline}
              disabled={isUnder18 && !minorAckChecked}
              className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sign online now
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RegisterPage;

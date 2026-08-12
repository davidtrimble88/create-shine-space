import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Seo from "@/components/Seo";
import { Loader2, CheckCircle2 } from "lucide-react";
import RegistrationFormDocuSign from "@/components/RegistrationFormDocuSign";
import ModelReleaseDocuSign from "@/components/ModelReleaseDocuSign";
import WaiverDocuSign from "@/components/WaiverDocuSign";

type BookingInfo = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  licenseNumber: string | null;
  licenseState: string | null;
  issuingCountry: string | null;
  licenseExpiration: string | null;
  referralSource: string | null;
  course: string | null;
  location: string | null;
  locationLabel: string | null;
  scheduleId: string | null;
  scheduleDate: string | null;
  guardianName: string | null;
  guardianRelationship: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
};

const isUnder18 = (dob: string | null) => {
  if (!dob) return false;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--;
  return a < 18;
};

const CompleteFormsPage = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [step, setStep] = useState<"registration" | "waiver" | "release" | "done" | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!token) { setError("This link is missing its access code."); setLoading(false); return; }
      const { data, error: fnError } = await supabase.functions.invoke("booking-forms-lookup", {
        body: { token },
      });
      if (!active) return;
      const payload = data as { booking?: BookingInfo; completed?: string[]; error?: string } | null;
      if (fnError || payload?.error || !payload?.booking) {
        setError(payload?.error || "This link is not valid. Please contact the office.");
      } else {
        setBooking(payload.booking);
        setCompleted(payload.completed || []);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [token]);

  const minor = isUnder18(booking?.dateOfBirth ?? null);

  // Guardian signatures are never collected online — a parent/legal guardian
  // must sign in person at the start of the first class.
  const guardianInPerson = minor;

  const remaining = useMemo(() => {
    const list: ("registration" | "waiver" | "release")[] = [];
    if (!completed.includes("cmsp_registration_form")) list.push("registration");
    if (!completed.includes("cmsp_waiver")) list.push("waiver");
    if (!completed.includes("cmsp_model_release") && !completed.includes("cmsp_model_release_decline")) list.push("release");
    return list;
  }, [completed]);

  useEffect(() => {
    if (booking && step === null) setStep(remaining[0] ?? "done");
  }, [booking, step, remaining]);

  const advance = (justFinished: "registration" | "waiver" | "release") => {
    const order: ("registration" | "waiver" | "release")[] = ["registration", "waiver", "release"];
    const rest = remaining.filter(r => r !== justFinished && order.indexOf(r) > order.indexOf(justFinished));
    setStep(rest[0] ?? "done");
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const base = booking && {
    firstName: booking.firstName,
    middleName: booking.middleName || undefined,
    lastName: booking.lastName,
    email: booking.email,
    phone: booking.phone || undefined,
    dateOfBirth: booking.dateOfBirth || undefined,
    addressStreet: booking.addressStreet || undefined,
    addressCity: booking.addressCity || undefined,
    addressState: booking.addressState || undefined,
    addressZip: booking.addressZip || undefined,
    isMinor: minor,
    guardianInPerson,
    guardianFirstName: booking.guardianName?.split(" ")[0] || undefined,
    guardianLastName: booking.guardianName?.split(" ").slice(1).join(" ") || undefined,
    guardianRelationship: booking.guardianRelationship || undefined,
    guardianEmail: booking.guardianEmail || undefined,
    guardianPhone: booking.guardianPhone || undefined,
    course: booking.course || undefined,
    location: booking.location || undefined,
    locationLabel: booking.locationLabel || undefined,
    scheduleId: booking.scheduleId,
    scheduleDate: booking.scheduleDate,
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Complete Your Course Forms | Learn to Ride VC"
        description="Electronically sign your CMSP registration form, course waiver, and photo release before class day."
        path="/complete-forms"
        noindex
      />
      <Navbar />
      <main className="pt-28 pb-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-black text-foreground mb-2">Complete Your Forms</h1>
            {booking ? (
              <p className="text-muted-foreground">
                {booking.firstName} {booking.lastName} · {booking.locationLabel}
                {booking.scheduleDate ? ` · ${booking.scheduleDate}` : ""}
              </p>
            ) : null}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading your registration…
            </div>
          ) : error ? (
            <div className="max-w-xl mx-auto bg-card border border-border rounded-2xl p-8 text-center">
              <p className="text-foreground font-semibold mb-2">We couldn't open your forms</p>
              <p className="text-muted-foreground text-sm">{error}</p>
              <p className="text-muted-foreground text-sm mt-4">Call (805) 827-0075 or email Office@LearnToRideVC.com.</p>
            </div>
          ) : step === "done" || !base ? (
            <div className="max-w-xl mx-auto bg-card border border-border rounded-2xl p-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-accent mx-auto mb-3" />
              <p className="text-foreground font-bold text-lg mb-1">All forms are complete</p>
              <p className="text-muted-foreground text-sm">
                Your paperwork is on file for class day. Nothing else to print or bring back.
              </p>
              {minor ? (
                <p className="text-sm text-foreground/85 mt-4">
                  Reminder: a parent or legal guardian must attend the start of the first class to sign in person.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="max-w-5xl mx-auto">
              {step === "registration" ? (
                <RegistrationFormDocuSign
                  prefill={{
                    ...base,
                    sex: booking!.gender === "male" ? "M" : booking!.gender === "female" ? "F" : "",
                    idType: "drivers_license",
                    idNumber: booking!.licenseNumber || "",
                    idState: booking!.licenseState || "",
                    idCountry: booking!.issuingCountry || "",
                    idExpiration: booking!.licenseExpiration || "",
                    referralSource: booking!.referralSource || "",
                  } as never}
                  onBack={() => {}}
                  onSigned={() => advance("registration")}
                  continueLabel="Continue to Next Form →"
                />
              ) : step === "waiver" ? (
                <WaiverDocuSign
                  prefill={{
                    ...base,
                    licenseNumber: booking!.licenseNumber || undefined,
                    licenseState: booking!.licenseState || undefined,
                  } as never}
                  onBack={() => {}}
                  onSigned={() => advance("waiver")}
                  continueLabel="Continue to Next Form →"
                  finishLabel="Finish & Submit Forms"
                />
              ) : (
                <ModelReleaseDocuSign
                  prefill={base as never}
                  onBack={() => {}}
                  onComplete={() => advance("release")}
                  continueLabel="Finish →"
                />
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CompleteFormsPage;

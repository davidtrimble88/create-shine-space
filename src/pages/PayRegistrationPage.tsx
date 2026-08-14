import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SquarePaymentDialog, type SquareRegion } from "@/components/SquarePaymentDialog";
import { sendRegistrationConfirmation, formatScheduleDate } from "@/lib/registrationEmail";
import { CheckCircle, Loader2, CreditCard, Phone, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const courseLabels: Record<string, string> = {
  basic: "Motorcyclist Training Course",
  intermediate: "Intermediate Course",
  advanced: "Advanced Riding Clinic",
};

const parseFeeCents = (fee: string | null | undefined): number => {
  if (!fee) return 0;
  const n = Number(String(fee).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

const PayRegistrationPage = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<any>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [paid, setPaid] = useState(false);
  const [alternatives, setAlternatives] = useState<any[]>([]);
  const [selectedAlt, setSelectedAlt] = useState<string>("");
  const [switching, setSwitching] = useState(false);
  const [switched, setSwitched] = useState(false);

  const loadAlternatives = async (b: any, currentScheduleId: string | null) => {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("schedules")
      .select("*")
      .eq("location", b.location)
      .eq("course", b.course)
      .is("cancelled_at", null)
      .gte("date", today)
      .gt("spots_available", 0)
      .order("date", { ascending: true });
    setAlternatives((data || []).filter((s: any) => s.id !== currentScheduleId));
  };

  useEffect(() => {
    (async () => {
      if (!token) { setError("This link is missing its security code."); setLoading(false); return; }
      const { data, error: fnErr } = await supabase.functions.invoke("booking-forms-lookup", { body: { token } });
      if (fnErr || !data || (data as any).error) {
        setError((data as any)?.error || "This link is not valid. Please call our office at (805) 827-0075.");
        setLoading(false);
        return;
      }
      const b = (data as any).booking;
      setBooking(b);
      if (b.paymentStatus === "paid" || b.pendingPayment === false) setPaid(true);
      if (b.scheduleId) {
        const { data: s } = await supabase.from("schedules").select("*").eq("id", b.scheduleId).maybeSingle();
        setSchedule(s);
        const isFull = !s || !!s.cancelled_at || (s.spots_available ?? 0) <= 0;
        if (isFull && b.paymentStatus !== "paid") await loadAlternatives(b, b.scheduleId);
      }
      setLoading(false);
    })();
  }, [token]);

  const feeCents = useMemo(
    () => parseFeeCents(booking?.fee) || parseFeeCents(schedule?.price),
    [booking, schedule],
  );
  const region: SquareRegion = String(booking?.location || "").startsWith("high-desert") ? "high_desert" : "ventura";

  const bookingPayload = useMemo(() => {
    if (!booking) return {};
    return {
      id: booking.id,
      schedule_id: booking.scheduleId,
      course: booking.course,
      location: booking.location,
      location_label: booking.locationLabel,
      schedule_date: booking.scheduleDate,
      first_name: booking.firstName,
      last_name: booking.lastName,
      email: booking.email,
      phone: booking.phone,
      date_of_birth: booking.dateOfBirth,
      license_number: booking.licenseNumber,
      zip: booking.addressZip,
    };
  }, [booking]);

  const classFull = !!booking && !paid && (!schedule || !!schedule.cancelled_at || (schedule.spots_available ?? 0) <= 0);

  const handleSwitch = async () => {
    if (!selectedAlt) return;
    setSwitching(true);
    const { data, error: fnErr } = await supabase.functions.invoke("booking-change-schedule", {
      body: { token, scheduleId: selectedAlt },
    });
    setSwitching(false);
    if (fnErr || !data || (data as any).error) {
      toast.error((data as any)?.error || "We couldn't move your registration. Please call the office.");
      return;
    }
    const s = (data as any).schedule;
    setSchedule(s);
    setBooking((prev: any) => ({
      ...prev,
      scheduleId: s.id,
      scheduleDate: s.date,
      course: s.course,
      locationLabel: s.location_label,
      fee: s.price,
    }));
    setSwitched(true);
    toast.success("Your class has been updated. Complete payment to lock in your seat.");
  };

  const handleSuccess = async () => {
    setPaid(true);
    setPayOpen(false);
    try {
      const guardianEmail = (booking?.guardianEmail || "").trim();
      await sendRegistrationConfirmation({
        email: booking.email,
        firstName: booking.firstName,
        lastName: booking.lastName,
        courseKey: booking.riderTrack === "1dpc" ? "1dpc" : booking.course,
        courseLabel: courseLabels[booking.course] || booking.course,
        locationLabel: booking.locationLabel,
        location: booking.location,
        groupName: schedule?.group_name ?? null,
        scheduleDate: booking.scheduleDate,
        scheduleDetail: schedule?.schedule ?? null,
        fee: booking.fee || schedule?.price || "",
        additionalRecipients:
          guardianEmail && guardianEmail.toLowerCase() !== String(booking.email).toLowerCase() ? [guardianEmail] : [],
      });
    } catch (e) {
      console.warn("Confirmation email failed", e);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Seo title="Complete Your Payment — Learn to Ride VC" description="Pay for your motorcycle class registration." path="/pay-registration" noindex />
      <Navbar />
      <main className="flex-1 px-4 pt-40 pb-20">
        <div className="mx-auto max-w-xl w-full space-y-8">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading your registration…
            </div>
          ) : error ? (
            <div className="text-center space-y-4">
              <h1 className="text-2xl font-bold text-foreground">We couldn't open this link</h1>
              <p className="text-muted-foreground">{error}</p>
              <a href="tel:+18058270075" className="inline-flex items-center gap-2 text-accent font-semibold">
                <Phone className="w-4 h-4" /> (805) 827-0075
              </a>
            </div>
          ) : paid ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center">
                  <CheckCircle className="w-12 h-12 text-accent" />
                </div>
              </div>
              <h1 className="text-3xl font-bold text-foreground">You're all set</h1>
              <p className="text-muted-foreground">
                Your payment is complete and your seat is reserved. A confirmation email with your class details is on
                its way.
              </p>
            </div>
          ) : (
            <>
              <div className="text-center space-y-3">
                <h1 className="text-3xl font-bold text-foreground">Complete Your Payment</h1>
                <p className="text-muted-foreground">
                  Your registration is on hold. Pay now to lock in your seat.
                </p>
              </div>

              <div className="bg-muted/50 border border-border rounded-xl p-6 space-y-2">
                <p className="font-semibold text-foreground">
                  {booking.firstName} {booking.lastName}
                </p>
                <p className="text-muted-foreground">{courseLabels[booking.course] || booking.course}</p>
                <p className="text-muted-foreground">{booking.locationLabel}</p>
                <p className="text-muted-foreground">{formatScheduleDate(booking.scheduleDate)}</p>
                <p className="text-xl font-bold text-foreground pt-2">
                  {booking.fee || schedule?.price || ""}
                </p>
              </div>

              {switched && (
                <p className="text-sm text-accent font-medium text-center">
                  Your registration has been moved to the class shown above.
                </p>
              )}

              {classFull ? (
                <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">This class is now full</p>
                      <p className="text-sm text-muted-foreground">
                        Because your seat wasn't reserved, the class you chose filled up. Pick another available class
                        at the same location below — your registration updates automatically, then you can pay.
                      </p>
                    </div>
                  </div>

                  {alternatives.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      There are no other open classes right now. Please call our office at{" "}
                      <a href="tel:+18058270075" className="text-accent font-semibold">(805) 827-0075</a>.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {alternatives.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSelectedAlt(s.id)}
                            className={`w-full text-left rounded-lg border p-3 transition-colors ${
                              selectedAlt === s.id
                                ? "border-accent bg-accent/10"
                                : "border-border bg-background hover:bg-muted/50"
                            }`}
                          >
                            <p className="font-medium text-foreground">{formatScheduleDate(s.date)}</p>
                            <p className="text-sm text-muted-foreground">
                              {s.location_label}
                              {s.group_name ? ` (${s.group_name})` : ""} · {s.spots_available} seat
                              {s.spots_available === 1 ? "" : "s"} open
                            </p>
                            {s.schedule && <p className="text-xs text-muted-foreground mt-1">{s.schedule}</p>}
                          </button>
                        ))}
                      </div>
                      <Button className="w-full" disabled={!selectedAlt || switching} onClick={handleSwitch}>
                        {switching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Move me to this class
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <Button size="lg" className="w-full" disabled={!feeCents} onClick={() => setPayOpen(true)}>
                  <CreditCard className="w-4 h-4 mr-2" /> Pay by Card
                </Button>
              )}

              <p className="text-center text-sm text-muted-foreground">
                Prefer to pay cash? Call our office at{" "}
                <a href="tel:+18058270075" className="text-accent font-semibold">(805) 827-0075</a>, Monday – Friday,
                9:00 AM – 5:00 PM.
              </p>

              <SquarePaymentDialog
                open={payOpen}
                onOpenChange={setPayOpen}
                region={region}
                amountCents={feeCents}
                amountLabel={booking.fee || schedule?.price || ""}
                bookingPayload={bookingPayload}
                onSuccess={handleSuccess}
              />
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PayRegistrationPage;

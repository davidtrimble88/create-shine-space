import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SquarePaymentDialog, type SquareRegion } from "@/components/SquarePaymentDialog";
import { CheckCircle, Loader2, CreditCard, Phone } from "lucide-react";

const courseLabels: Record<string, string> = {
  basic: "Motorcyclist Training Course",
  intermediate: "Intermediate Course",
  advanced: "Advanced Riding Clinic",
};

const feeLabels: Record<string, string> = {
  retest: "Retest Fee",
  reschedule: "Rescheduling Fee",
  other: "Course Fee",
};

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

const PayFeePage = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fee, setFee] = useState<any>(null);
  const [booking, setBooking] = useState<any>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) { setError("This link is missing its security code."); setLoading(false); return; }
      const { data, error: fnErr } = await supabase.functions.invoke("fee-payment-lookup", { body: { token } });
      if (fnErr || !data || (data as any).error) {
        setError((data as any)?.error || "This link is not valid. Please call our office at (805) 827-0075.");
        setLoading(false);
        return;
      }
      setFee((data as any).fee);
      setBooking((data as any).booking);
      if ((data as any).fee?.status === "paid") setPaid(true);
      setLoading(false);
    })();
  }, [token]);

  const region: SquareRegion = String(booking?.location || "").startsWith("high-desert")
    ? "high_desert"
    : "ventura";

  const bookingPayload = useMemo(() => {
    if (!booking) return {};
    return {
      id: booking.id,
      course: booking.course,
      location: booking.location,
      location_label: booking.locationLabel,
      schedule_date: booking.scheduleDate,
      first_name: booking.firstName,
      last_name: booking.lastName,
      email: booking.email,
      zip: booking.zip,
    };
  }, [booking]);

  const label = fee ? feeLabels[fee.feeType] || "Course Fee" : "Fee";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Seo title="Pay Your Fee — Learn to Ride VC" description="Securely pay your retest or rescheduling fee." path="/pay-fee" noindex />
      <Navbar />
      <main className="flex-1 px-4 pt-40 pb-20">
        <div className="mx-auto max-w-xl w-full space-y-8">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading your payment…
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
              <h1 className="text-3xl font-bold text-foreground">Payment received</h1>
              <p className="text-muted-foreground">
                Thank you — your {label.toLowerCase()} is paid. Our office will confirm your class date shortly.
              </p>
            </div>
          ) : (
            <>
              <div className="text-center space-y-3">
                <h1 className="text-3xl font-bold text-foreground">{label}</h1>
                <p className="text-muted-foreground">
                  {booking.firstName}, please complete the payment below to secure your new class date.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Student</span>
                  <span className="text-foreground font-medium">{booking.firstName} {booking.lastName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Course</span>
                  <span className="text-foreground font-medium">{courseLabels[booking.course] || booking.course}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Location</span>
                  <span className="text-foreground font-medium">{booking.locationLabel}</span>
                </div>
                {fee.note && (
                  <div className="text-sm text-muted-foreground border-t border-border pt-3">{fee.note}</div>
                )}
                <div className="flex justify-between items-center border-t border-border pt-3">
                  <span className="text-muted-foreground">Amount due</span>
                  <span className="text-2xl font-bold text-foreground">{money(fee.amountCents)}</span>
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={() => setPayOpen(true)}>
                <CreditCard className="w-4 h-4 mr-2" /> Pay {money(fee.amountCents)} by card
              </Button>

              <SquarePaymentDialog
                open={payOpen}
                onOpenChange={setPayOpen}
                region={region}
                amountCents={fee.amountCents}
                amountLabel={money(fee.amountCents)}
                bookingPayload={bookingPayload}
                feeToken={token}
                onSuccess={() => { setPaid(true); setPayOpen(false); }}
              />
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PayFeePage;

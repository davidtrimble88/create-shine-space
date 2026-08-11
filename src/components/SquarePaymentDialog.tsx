import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import companyLogo from "@/assets/logo.png";

declare global {
  interface Window {
    Square?: any;
  }
}

const SQUARE_SDK_SRC = "https://web.squarecdn.com/v1/square.js";

function loadSquareSdk(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (window.Square) return resolve(window.Square);
    const existing = document.querySelector(`script[src="${SQUARE_SDK_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Square));
      existing.addEventListener("error", () => reject(new Error("Square SDK failed to load")));
      return;
    }
    const s = document.createElement("script");
    s.src = SQUARE_SDK_SRC;
    s.async = true;
    s.onload = () => resolve(window.Square);
    s.onerror = () => reject(new Error("Square SDK failed to load"));
    document.head.appendChild(s);
  });
}

export type SquareRegion = "ventura" | "high_desert";

export type PaymentDiscount = { source: "returning" | "code"; code?: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  region: SquareRegion;
  amountCents: number;
  amountLabel: string; // e.g. "$425"
  bookingPayload: Record<string, unknown>;
  discount?: PaymentDiscount;
  /** Staff-taken card-not-present payment: shows the phone authorization script. */
  phoneAuthorization?: boolean;
  onSuccess: (paymentId: string) => void;
  /** Called when payment can't be completed, so the attempt can be logged. */
  onFailure?: (info: { stage: "setup" | "charge"; message: string }) => void;
}

export const SquarePaymentDialog = ({
  open, onOpenChange, region, amountCents, amountLabel, bookingPayload, discount, phoneAuthorization, onSuccess, onFailure,
}: Props) => {
  const cardContainerRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<any>(null);
  const paymentsRef = useRef<any>(null);
  const [initializing, setInitializing] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [reinitKey, setReinitKey] = useState(0);

  useEffect(() => { if (!open) setAuthorized(false); }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setInitError(null);
    setInitializing(true);

    (async () => {
      try {
        // Fetch public Square config for this region (App ID + Location ID)
        const cfgUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.functions.supabase.co/square-config?region=${region}`;
        const cfgRes = await fetch(cfgUrl);
        const cfgJson = await cfgRes.json();
        if (!cfgRes.ok) throw new Error(cfgJson?.error || "Failed to load payment config");

        const Square = await loadSquareSdk();
        if (cancelled) return;
        if (!Square) throw new Error("Square SDK unavailable");

        const payments = Square.payments(cfgJson.appId, cfgJson.locationId);
        paymentsRef.current = payments;
        const card = await payments.card();
        if (cancelled) { try { await card.destroy(); } catch { /* noop */ } return; }

        // Wait for the container to actually exist and be visible before
        // attaching — attaching into a hidden/unmounted node makes Square's
        // iframe initialize with no size, which later fails tokenization
        // with "An unknown error occurred".
        for (let i = 0; i < 50 && !cardContainerRef.current; i++) {
          await new Promise((r) => setTimeout(r, 50));
        }
        if (cancelled) { try { await card.destroy(); } catch { /* noop */ } return; }
        if (!cardContainerRef.current) throw new Error("Payment form container unavailable");

        await card.attach(cardContainerRef.current);
        if (cancelled) { try { await card.destroy(); } catch { /* noop */ } return; }
        cardRef.current = card;
        setInitializing(false);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Failed to initialize payment form";
        setInitError(msg);
        setInitializing(false);
        onFailure?.({ stage: "setup", message: msg });
      }
    })();

    return () => {
      cancelled = true;
      if (cardRef.current) {
        try { cardRef.current.destroy(); } catch { /* noop */ }
        cardRef.current = null;
      }
    };
  }, [open, region, reinitKey]);

  const rebuildCardForm = () => {
    if (cardRef.current) {
      try { cardRef.current.destroy(); } catch { /* noop */ }
      cardRef.current = null;
    }
    setReinitKey((k) => k + 1);
  };

  const handlePay = async () => {
    if (!cardRef.current) return;
    setSubmitting(true);
    try {
      let result: any;
      try {
        result = await cardRef.current.tokenize();
      } catch (err) {
        // Square throws (rather than returning) when the card element is in a
        // bad state. Rebuild the form and ask the customer to try once more.
        rebuildCardForm();
        throw new Error(
          "The card form lost its connection to Square. We've reloaded it — please re-enter your card details and try again.",
        );
      }

      if (result.status !== "OK") {
        const detail = (result.errors ?? [])
          .map((x: any) => x?.detail || x?.message)
          .filter(Boolean)
          .join(" ");
        const codes = (result.errors ?? []).map((x: any) => x?.code).filter(Boolean);
        const unknown = codes.length === 0 || codes.includes("UNKNOWN") || !detail;
        if (unknown) {
          // Most "unknown error" tokenization failures are a stale card iframe.
          rebuildCardForm();
          throw new Error(
            "We couldn't read the card details. The card form has been reloaded — please re-enter the card number, expiration, CVV and ZIP, then try again.",
          );
        }
        throw new Error(detail);
      }
      const sourceId = result.token;

      const { data, error } = await supabase.functions.invoke("square-charge", {
        body: { sourceId, region, amountCents, booking: bookingPayload, discount },
      });

      if (error) {
        // Surface the real decline reason from the function's JSON body
        // instead of the generic "non-2xx status code" message.
        let detail = "";
        try {
          const body = await (error as any)?.context?.json?.();
          detail = body?.error || "";
        } catch { /* noop */ }
        throw new Error(detail || error.message || "Payment failed");
      }

      if ((data as any)?.error) throw new Error((data as any).error);

      toast({ title: "Payment successful", description: "Your spot is reserved." });
      onSuccess((data as any).paymentId);
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Payment failed";
      toast({ title: "Payment failed", description: msg, variant: "destructive" });
      onFailure?.({ stage: "charge", message: msg });
    }
    setSubmitting(false);
  };



  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Payment</DialogTitle>
          <DialogDescription>
            Securely charged via Square — {amountLabel} for your course.
          </DialogDescription>
        </DialogHeader>

        {initError ? (
          <div className="space-y-2">
            <div className="text-sm text-destructive">{initError}</div>
            <Button variant="outline" size="sm" onClick={rebuildCardForm}>Reload card form</Button>
          </div>
        ) : initializing ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading secure card form…
          </div>
        ) : null}


        {phoneAuthorization && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              Read this to the customer before entering the card
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              “This call may be documented for accuracy. I’m going to read a short payment authorization.
              You, {String(bookingPayload.first_name ?? "")} {String(bookingPayload.last_name ?? "")}, are authorizing
              Learn To Ride VC to charge your card a one-time amount of {amountLabel} for the
              {" "}{String(bookingPayload.course ?? "motorcycle training")} course on
              {" "}{String(bookingPayload.schedule_date ?? "the selected date")} at
              {" "}{String(bookingPayload.location_label ?? "our training location")}.
              You confirm you are the authorized cardholder or have the cardholder’s permission to use this card,
              and that the billing information you provide is accurate. This charge will appear on your statement as
              Learn To Ride VC. Payment is subject to our cancellation and refund policy available at
              learntoridevc.com/terms-of-service, and no refund is issued for no-shows or late cancellations
              outside that policy. Your card number is entered directly into our secure payment processor and is not
              stored by Learn To Ride VC. Do you authorize this charge of {amountLabel} today?”
            </p>
            <label className="flex items-start gap-2 text-sm cursor-pointer pt-1">
              <input
                type="checkbox"
                className="mt-1 accent-primary"
                checked={authorized}
                onChange={(e) => setAuthorized(e.target.checked)}
              />
              <span className="text-foreground">
                The customer verbally authorized this charge after hearing the script above.
              </span>
            </label>
          </div>
        )}

        {/* Kept mounted and laid out (never display:none) — Square's iframe must
            render at a real size or tokenization fails with an unknown error. */}
        <div
          ref={cardContainerRef}
          className="min-h-[90px]"
          style={initializing || initError ? { position: "absolute", opacity: 0, pointerEvents: "none", width: 320, left: -9999 } : undefined}
        />


        <div className="flex items-center justify-between gap-2 pt-2">
          <img src={companyLogo} alt="Learn To Ride VC" className="h-24 w-auto opacity-90" />
          <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handlePay} disabled={submitting || initializing || !!initError || (phoneAuthorization && !authorized)}>
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</> : `Pay ${amountLabel}`}
          </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SquarePaymentDialog;

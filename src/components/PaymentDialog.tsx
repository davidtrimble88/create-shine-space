import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";
import { SquarePaymentDialog, type SquareRegion } from "./SquarePaymentDialog";

export type PaymentProvider = "square" | "paypal" | "stripe";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  region: SquareRegion;
  amountCents: number;
  amountLabel: string;
  bookingPayload: Record<string, unknown>;
  onSuccess: (paymentId: string, provider: PaymentProvider) => void;
}

/**
 * Provider-agnostic payment dialog.
 * Reads the active payment provider from `payment_settings` and renders the
 * appropriate gateway. Square is fully implemented; PayPal & Stripe are
 * scaffolded placeholders that can be wired up later without touching callers.
 */
export const PaymentDialog = (props: Props) => {
  const { open, onOpenChange, onSuccess } = props;
  const [provider, setProvider] = useState<PaymentProvider | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .rpc("get_active_payment_provider")
      .then(({ data }) => {
        setProvider(((data as PaymentProvider | null) ?? "square"));
        setLoading(false);
      });
  }, [open]);

  if (loading && open) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Loading…</DialogTitle>
            <DialogDescription>Preparing secure payment form.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Square — fully implemented; just wrap the existing dialog
  if (provider === "square") {
    return (
      <SquarePaymentDialog
        {...props}
        onSuccess={(paymentId) => onSuccess(paymentId, "square")}
      />
    );
  }

  // Placeholder for not-yet-implemented providers
  const providerLabel = provider === "paypal" ? "PayPal" : "Stripe";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{providerLabel} Checkout</DialogTitle>
          <DialogDescription>
            {providerLabel} payments are not yet configured for this site.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 items-start text-sm bg-muted/30 border border-border rounded-lg p-4">
          <AlertCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            The site owner has selected <strong className="text-foreground">{providerLabel}</strong> as the
            active payment provider, but the integration hasn't been completed yet. Please contact us by phone
            to reserve your spot, or check back shortly.
          </p>
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDialog;

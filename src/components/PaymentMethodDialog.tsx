import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, Banknote, Phone, Clock, AlertTriangle, Loader2, ArrowLeft } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amountLabel: string;
  /** Continue to the secure card form. */
  onChooseCard: () => void;
  /** Save the registration as a cash hold. Should resolve when saved. */
  onChooseCash: () => Promise<void> | void;
}

/**
 * Asks the student how they intend to pay before the card form is shown.
 * Cash selections are saved as a "pending payment" hold — no seat is reserved
 * until the office takes payment over the phone.
 */
export const PaymentMethodDialog = ({ open, onOpenChange, amountLabel, onChooseCard, onChooseCash }: Props) => {
  const [step, setStep] = useState<"choose" | "cash">("choose");
  const [saving, setSaving] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) setStep("choose");
    onOpenChange(next);
  };

  const confirmCash = async () => {
    setSaving(true);
    try {
      await onChooseCash();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === "choose" ? (
          <>
            <DialogHeader>
              <DialogTitle>How would you like to pay?</DialogTitle>
              <DialogDescription>
                Your total today is <span className="font-semibold text-foreground">{amountLabel}</span>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-1">
              <button
                type="button"
                onClick={onChooseCard}
                className="w-full text-left rounded-lg border border-accent/50 bg-accent/5 hover:bg-accent/10 transition-colors p-4 flex gap-3"
              >
                <CreditCard className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">Pay by card now</p>
                  <p className="text-sm text-muted-foreground">
                    Secure checkout. Your seat is reserved the moment your payment goes through.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStep("cash")}
                className="w-full text-left rounded-lg border border-border bg-background/40 hover:bg-secondary/40 transition-colors p-4 flex gap-3"
              >
                <Banknote className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">Pay by cash</p>
                  <p className="text-sm text-muted-foreground">
                    Arrange payment with our office by phone. Your seat is not held until we receive payment.
                  </p>
                </div>
              </button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Paying by cash — one more step</DialogTitle>
              <DialogDescription>
                We'll save everything you've completed so far so you don't have to start over.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-1">
              <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground/90 leading-relaxed">
                  Your registration will be placed <strong>on hold</strong>. Seats are only reserved once payment is
                  received, so your spot in this class is <strong>not saved yet</strong> and may be taken by another rider.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-foreground">
                  <Phone className="w-4 h-4 text-accent" />
                  <a href="tel:+18058270075" className="font-semibold hover:underline">(805) 827-0075</a>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  Monday – Friday, 9:00 AM – 5:00 PM
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed pt-1">
                  Call our office to complete payment. As soon as we take it, we'll confirm your seat and email your
                  class details. If your class fills before then, we'll help you pick the next available date.
                </p>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setStep("choose")} disabled={saving}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <Button onClick={confirmCash} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  I understand — hold my registration
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentMethodDialog;

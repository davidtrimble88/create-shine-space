import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarClock, Clock, AlertTriangle, CircleArrowRight, ArrowDown } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
  onBack: () => void;
}

/**
 * Hard-to-miss acknowledgment shown after the registration forms are signed
 * but before the student enters payment. The main policies are visually
 * emphasized so they cannot be skipped or claimed to have been missed.
 */
export const RegistrationAcknowledgmentDialog = ({ open, onOpenChange, onContinue, onBack }: Props) => {
  const [confirmed, setConfirmed] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // If the content fits entirely, nothing to scroll — count as viewed.
    if (el.scrollHeight - el.clientHeight <= 4) {
      setScrolledToEnd(true);
      return;
    }
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setScrolledToEnd(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setScrolledToEnd(false);
    const id = window.setTimeout(checkScroll, 80);
    return () => window.clearTimeout(id);
  }, [open, checkScroll]);

  const handleOpenChange = (next: boolean) => {
    if (!next) setConfirmed(false);
    onOpenChange(next);
  };

  const handleContinue = () => {
    if (!confirmed) return;
    setConfirmed(false);
    onContinue();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg border-accent/50 bg-background max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="text-center px-6 pt-6">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/20 text-accent">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <DialogTitle className="text-2xl font-bold text-foreground">
            Important — read before you pay
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            By continuing, you are agreeing to our class attendance and rescheduling policies.
          </DialogDescription>
        </DialogHeader>

        <div ref={scrollRef} onScroll={checkScroll} className="space-y-4 overflow-y-auto px-6 py-2">
          <div className="rounded-xl border border-accent/40 bg-accent/10 p-4">
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent" />
              <div>
                <p className="font-bold text-foreground">Reschedule deadline</p>
                <p className="text-sm text-foreground/90 leading-relaxed">
                  You may reschedule your class no later than{" "}
                  <strong className="text-base !text-foreground underline underline-offset-2 decoration-foreground/60">
                    5 days before the class start date
                  </strong>
                  . Late reschedules and no-shows are subject to{" "}
                  <strong className="text-base !text-foreground underline underline-offset-2 decoration-foreground/60">
                    additional rescheduling fees
                  </strong>
                  .
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-accent/40 bg-accent/10 p-4">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent" />
              <div>
                <p className="font-bold text-foreground">Arrive early</p>
                <p className="text-sm text-foreground/90 leading-relaxed">
                  You must arrive to each class session{" "}
                  <strong className="text-base !text-foreground underline underline-offset-2 decoration-foreground/60">
                    15 minutes early
                  </strong>
                  . If you arrive late, you will{" "}
                  <strong className="text-base !text-foreground underline underline-offset-2 decoration-foreground/60">
                    NOT BE ADMITTED TO CLASS
                  </strong>{" "}
                  and will be asked to leave. You will then need to call our office to reschedule, and a fee will apply.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold text-foreground/90">
              Please make sure you can attend every scheduled session on time before completing payment.
            </p>
          </div>
        </div>

        {!scrolledToEnd && (
          <button
            type="button"
            onClick={() =>
              scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
            }
            className="mx-6 flex items-center justify-center gap-2 rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent"
          >
            <ArrowDown className="h-4 w-4" />
            Scroll to read everything
          </button>
        )}

        <div className={`flex items-start gap-3 rounded-lg border border-border bg-secondary/30 p-4 mx-6 ${!scrolledToEnd ? "opacity-50" : ""}`}>
          <Checkbox
            id="ack-policy"
            checked={confirmed}
            disabled={!scrolledToEnd}
            onCheckedChange={(checked) => setConfirmed(checked === true)}
            className="mt-0.5 border-accent data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground"
          />
          <label htmlFor="ack-policy" className="cursor-pointer text-sm font-medium leading-relaxed text-foreground">
            I have read and understand the reschedule and arrival policies above. I understand that late
            reschedules, no-shows, and late arrivals will result in additional fees and may require me to
            retake the course.
          </label>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-col-reverse px-6 pb-6">
          <Button
            onClick={handleContinue}
            disabled={!confirmed || !scrolledToEnd}
            className="w-full text-base font-semibold"
            size="lg"
          >
            <CircleArrowRight className="mr-2 h-4 w-4" />
            Continue to payment
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setConfirmed(false);
              onBack();
            }}
            className="w-full"
            size="lg"
          >
            Go back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegistrationAcknowledgmentDialog;

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ShieldCheck } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Booking = Tables<"bookings">;
type MRState = "signed" | "declined" | "none";

interface Props {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currentWaiver: boolean;
  currentReg: boolean;
  currentMR: MRState;
  saving: boolean;
  onSave: (flags: { waiver: boolean; reg_form: boolean; model_release: MRState }) => void;
}

export const WaiverStatusEditor = ({
  booking, open, onOpenChange, currentWaiver, currentReg, currentMR, saving, onSave,
}: Props) => {
  const [waiver, setWaiver] = useState(false);
  const [reg, setReg] = useState(false);
  const [mr, setMr] = useState<MRState>("none");

  useEffect(() => {
    if (open) {
      setWaiver(currentWaiver);
      setReg(currentReg);
      setMr(currentMR);
    }
  }, [open, currentWaiver, currentReg, currentMR]);

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            Mark Waivers Signed In Person
          </DialogTitle>
          <DialogDescription>
            For <span className="font-semibold text-foreground">{booking.first_name} {booking.last_name}</span> — toggle on anything they signed on paper.
            Already-signed items can't be unmarked here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="flex items-center justify-between border border-border rounded-lg p-3">
            <div>
              <Label className="text-sm">Liability Waiver</Label>
              {currentWaiver && <p className="text-xs text-emerald-500 mt-0.5">Already on file</p>}
            </div>
            <Switch checked={waiver} onCheckedChange={setWaiver} disabled={currentWaiver} />
          </div>

          <div className="flex items-center justify-between border border-border rounded-lg p-3">
            <div>
              <Label className="text-sm">Registration Form</Label>
              {currentReg && <p className="text-xs text-emerald-500 mt-0.5">Already on file</p>}
            </div>
            <Switch checked={reg} onCheckedChange={setReg} disabled={currentReg} />
          </div>

          <div className="border border-border rounded-lg p-3 space-y-2">
            <Label className="text-sm">Model Release</Label>
            {currentMR !== "none" && (
              <p className="text-xs text-emerald-500">
                Already on file — {currentMR === "signed" ? "agreed" : "declined"}
              </p>
            )}
            <RadioGroup
              value={mr}
              onValueChange={(v) => setMr(v as MRState)}
              disabled={currentMR !== "none"}
              className="grid grid-cols-3 gap-2 pt-1"
            >
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <RadioGroupItem value="none" /> Not yet
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <RadioGroupItem value="signed" /> Agreed
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <RadioGroupItem value="declined" /> Declined
              </label>
            </RadioGroup>
          </div>

          <p className="text-xs text-muted-foreground">
            A signed-in-person record will be saved for the class so the roster reflects it.
            For the legally-binding signature, upload the scanned paper waiver from the <span className="font-medium">Signed Waivers</span> tab.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => onSave({ waiver, reg_form: reg, model_release: mr })} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WaiverStatusEditor;

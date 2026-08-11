import { useState } from "react";
import SquarePaymentDialog from "@/components/SquarePaymentDialog";

const SquareTestHarness = () => {
  const [open, setOpen] = useState(true);
  return (
    <SquarePaymentDialog
      open={open}
      onOpenChange={setOpen}
      region="ventura"
      amountCents={39500}
      amountLabel="$395"
      bookingPayload={{ first_name: "Test", last_name: "Rider" }}
      onSuccess={() => {}}
      onFailure={(i) => console.log("FAILURE_CB", JSON.stringify(i))}
    />
  );
};
export default SquareTestHarness;

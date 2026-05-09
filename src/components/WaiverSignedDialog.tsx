import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Download, Printer, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  pdfPath: string | null;
  signerName: string;
  onContinue: () => void;
}

const WaiverSignedDialog = ({ open, pdfPath, signerName, onContinue }: Props) => {
  const [loading, setLoading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !pdfPath) {
      setSignedUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.storage
        .from("waivers")
        .createSignedUrl(pdfPath, 60 * 30);
      if (!cancelled) {
        if (error || !data) {
          toast({ title: "Could not prepare download", description: error?.message, variant: "destructive" });
        } else {
          setSignedUrl(data.signedUrl);
        }
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, pdfPath]);

  const handleDownload = () => {
    if (!signedUrl) return;
    const a = document.createElement("a");
    a.href = signedUrl;
    const safeName = (signerName || "waiver").replace(/[^a-z0-9_-]+/gi, "_");
    a.download = `Signed_CMSP_Waiver_${safeName}.pdf`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handlePrint = () => {
    if (!signedUrl) return;
    const w = window.open(signedUrl, "_blank", "noopener,noreferrer");
    if (w) {
      // Try to trigger print after the PDF loads. Some browsers block this; user can also print from the viewer.
      const tryPrint = () => { try { w.focus(); w.print(); } catch { /* ignore */ } };
      setTimeout(tryPrint, 1200);
    } else {
      toast({ title: "Pop-up blocked", description: "Please allow pop-ups, or use Download then print.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* lock until continue */ }}>
      <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-accent" />
            <DialogTitle>Waiver Signed</DialogTitle>
          </div>
          <DialogDescription>
            Your signed CMSP waiver has been securely saved to your file. You can download or print a copy for your records below.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={handleDownload} disabled={!signedUrl || loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Download
          </Button>
          <Button variant="outline" onClick={handlePrint} disabled={!signedUrl || loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
            Print
          </Button>
        </div>

        {!pdfPath && (
          <p className="text-xs text-muted-foreground">
            A PDF copy was not saved for this waiver. You can request a copy from the office.
          </p>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="hero" onClick={onContinue}>Continue to Payment →</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WaiverSignedDialog;

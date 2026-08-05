import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Download, Printer, Loader2, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  pdfPath: string | null;
  downloadUrl?: string | null;
  signerName: string;
  onContinue: () => void;
  bucket?: string;
  title?: string;
  description?: string;
  continueLabel?: string;
  downloadPrefix?: string;
  missingPdfMessage?: string;
}

const WaiverSignedDialog = ({
  open, pdfPath, downloadUrl, signerName, onContinue,
  bucket = "waivers",
  title = "Waiver Signed",
  description = "Your signed CMSP waiver has been securely saved to your file. You can download or print a copy for your records below.",
  continueLabel = "Continue to Payment →",
  downloadPrefix = "Signed_CMSP_Waiver",
  missingPdfMessage = "A PDF copy was not saved for this waiver. You can request a copy from the office.",
}: Props) => {
  const [loading, setLoading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setSignedUrl(null); return; }
    if (downloadUrl) { setSignedUrl(downloadUrl); return; }
    if (!pdfPath) { setSignedUrl(null); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.storage
        .from(bucket)
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
  }, [open, pdfPath, downloadUrl, bucket]);

  const handleDownload = () => {
    if (!signedUrl) return;
    const a = document.createElement("a");
    a.href = signedUrl;
    const safeName = (signerName || "document").replace(/[^a-z0-9_-]+/gi, "_");
    a.download = `${downloadPrefix}_${safeName}.pdf`;
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
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-accent/30 bg-accent/10 p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-accent mt-0.5 shrink-0" />
          <p className="text-sm text-foreground">
            <strong>Optional — for your records only.</strong> You do not need to download or print anything to continue your registration. Tap Continue when you're ready.
          </p>
        </div>

        <Button variant="hero" size="lg" onClick={onContinue} className="w-full">
          {continueLabel}
        </Button>

        <div className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground mb-2 text-center">Want a copy for your records?</p>
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
        </div>

        {!pdfPath && (
          <p className="text-xs text-muted-foreground">{missingPdfMessage}</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WaiverSignedDialog;

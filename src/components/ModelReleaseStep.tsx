import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Camera, CameraOff, Eraser, ShieldCheck } from "lucide-react";
import WaiverSignedDialog from "./WaiverSignedDialog";
import PdfPreview from "./PdfPreview";

export const CMSP_MODEL_RELEASE_VERSION = "2015-2026-02";

export const CMSP_MODEL_RELEASE_TEXT = `MODEL RELEASE

For good and valuable Consideration of $0.00 herein acknowledged as received, and by signing this release I hereby give the Photographer/Filmmaker and Assigns permission to license the Images and to use Images in any Media for any purpose (except pornographic or defamatory) which may include, among others, advertising, promotion, magazines, educational usage, marketing and packaging for any products or services. I agree that the Images may be combined with other images, text and graphics, cropped, altered or modified.

I agree that I have no rights to the Images and all rights to the Images belong to the Photographer/Filmmaker and Assigns. I acknowledge and agree that I have no further right to additional Considerations or accounting, and that I will make no further claim for any reason to Photographer/Filmmaker and/or Assigns. I acknowledge and agree that this release is binding upon my heirs and assigns. I agree that this release is irrevocable, worldwide and perpetual.

I represent and warrant that I am at least 18 years of age and have full legal capacity to execute this release (or my parent/legal guardian is signing on my behalf).

Photographer/Filmmaker: Learn to Ride VC — PO Box 4396, West Hills, CA 91308 — (805) 827-0075
Shoot Description: CMSP Course`;

export interface ModelReleasePrefill {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  isMinor: boolean;
  guardianFirstName?: string;
  guardianLastName?: string;
  guardianRelationship?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  course?: string;
  location?: string;
  locationLabel?: string;
  scheduleId?: string | null;
  scheduleDate?: string | null;
}

const SIGN_ACKS = [
  { key: "rights", label: "I grant Learn to Ride VC and its assigns permission to use photographs and video of me from the CMSP Course in any media as described above." },
  { key: "no_compensation", label: "I acknowledge that I will not receive additional compensation, and that the release is irrevocable, worldwide, and perpetual." },
  { key: "esign", label: "I agree to sign this Model Release electronically (ESIGN Act / UETA). My typed and drawn signatures have the same legal effect as a handwritten signature." },
];

const DECLINE_ACKS = [
  { key: "understood", label: "I have read and understood the CMSP Model Release above." },
  { key: "decline", label: "I DECLINE to grant Learn to Ride VC permission to photograph or video me, and I do not consent to any use of my likeness in any media." },
  { key: "notify", label: "I understand it is my responsibility to identify myself to the staff and photographer on class day so they can avoid capturing my likeness." },
  { key: "esign", label: "I am signing this declination electronically (ESIGN Act / UETA). My typed and drawn signatures have the same legal effect as a handwritten signature." },
];

interface SigProps {
  onChange: (dataUrl: string | null) => void;
  label: string;
}

const SignaturePad = ({ onChange, label }: SigProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent) => {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath(); ctx.moveTo(x, y);
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y); ctx.stroke();
    dirty.current = true;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (dirty.current) onChange(canvasRef.current!.toDataURL("image/png"));
  };
  const clear = () => {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    dirty.current = false;
    onChange(null);
  };

  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1 rounded-lg border border-border bg-white relative">
        <canvas
          ref={canvasRef}
          className="w-full h-32 touch-none rounded-lg"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        />
        <button type="button" onClick={clear}
          className="absolute top-1 right-1 text-xs text-muted-foreground hover:text-foreground bg-background/80 rounded px-2 py-1 flex items-center gap-1">
          <Eraser className="w-3 h-3" /> Clear
        </button>
      </div>
    </div>
  );
};

interface Props {
  prefill: ModelReleasePrefill;
  onBack: () => void;
  onComplete: (recordId: string, decision: "sign" | "decline") => void;
}

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md bg-muted/30 border border-border px-3 py-2">
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="text-sm text-foreground">{value || "—"}</div>
  </div>
);

const ModelReleaseStep = ({ prefill, onBack, onComplete }: Props) => {
  const fullName = [prefill.firstName, prefill.middleName, prefill.lastName]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const guardianFullName = [prefill.guardianFirstName, prefill.guardianLastName]
    .filter(Boolean).join(" ").trim();

  const [decision, setDecision] = useState<"sign" | "decline" | null>(null);

  // SIGN state
  const [bikeModel, setBikeModel] = useState("");
  const [helmetColor, setHelmetColor] = useState("");
  const [jacketColor, setJacketColor] = useState("");
  const [pantsColor, setPantsColor] = useState("");
  const [signAcks, setSignAcks] = useState<Record<string, boolean>>({});
  const [typedSig, setTypedSig] = useState("");
  const [drawnSig, setDrawnSig] = useState<string | null>(null);
  const [guardianTyped, setGuardianTyped] = useState("");
  const [guardianDrawn, setGuardianDrawn] = useState<string | null>(null);

  // DECLINE state
  const [declineAcks, setDeclineAcks] = useState<Record<string, boolean>>({});
  const [declineTyped, setDeclineTyped] = useState("");
  const [declineDrawn, setDeclineDrawn] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ recordId: string; pdfPath: string | null; downloadUrl: string | null; decision: "sign" | "decline" } | null>(null);

  const minorReady = !prefill.isMinor || (guardianTyped.trim().length > 1 && !!guardianDrawn);
  const canSign = SIGN_ACKS.every(a => signAcks[a.key])
    && typedSig.trim().toLowerCase() === fullName.toLowerCase()
    && !!drawnSig
    && minorReady;
  const canDecline = DECLINE_ACKS.every(a => declineAcks[a.key])
    && declineTyped.trim().toLowerCase() === fullName.toLowerCase()
    && !!declineDrawn;

  const submit = async (kind: "sign" | "decline") => {
    setSubmitting(true);
    try {
      const base = {
        first_name: prefill.firstName,
        middle_name: prefill.middleName || null,
        last_name: prefill.lastName,
        email: prefill.email,
        phone: prefill.phone || null,
        date_of_birth: prefill.dateOfBirth || null,
        address_street: prefill.addressStreet || null,
        address_city: prefill.addressCity || null,
        address_state: prefill.addressState || null,
        address_zip: prefill.addressZip || null,
        is_minor: prefill.isMinor,
        guardian_name: prefill.isMinor ? guardianFullName : null,
        guardian_relationship: prefill.isMinor ? (prefill.guardianRelationship || null) : null,
        guardian_address: null,
        guardian_phone: prefill.isMinor ? (prefill.guardianPhone || null) : null,
        guardian_email: prefill.isMinor ? (prefill.guardianEmail || null) : null,
        bike_model: kind === "sign" ? (bikeModel || null) : null,
        helmet_color: kind === "sign" ? (helmetColor || null) : null,
        jacket_color: kind === "sign" ? (jacketColor || null) : null,
        pants_color: kind === "sign" ? (pantsColor || null) : null,
        course: prefill.course || null,
        location: prefill.location || null,
        location_label: prefill.locationLabel || null,
        schedule_id: prefill.scheduleId || null,
        schedule_date: prefill.scheduleDate || null,
        document_version: CMSP_MODEL_RELEASE_VERSION,
        document_text: CMSP_MODEL_RELEASE_TEXT,
      };
      const body = kind === "sign" ? {
        ...base,
        decision: "sign" as const,
        signature_typed: typedSig.trim(),
        signature_drawn: drawnSig,
        guardian_signature_typed: prefill.isMinor ? guardianTyped.trim() : null,
        guardian_signature_drawn: prefill.isMinor ? guardianDrawn : null,
        consent_acknowledgments: SIGN_ACKS.map(a => ({ key: a.key, label: a.label, accepted: true as const })),
      } : {
        ...base,
        decision: "decline" as const,
        decline_typed: declineTyped.trim(),
        decline_drawn: declineDrawn,
        decline_acknowledgments: DECLINE_ACKS.map(a => ({ key: a.key, label: a.label, accepted: true as const })),
      };
      const { data, error } = await supabase.functions.invoke("record-model-release", { body });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult({
        recordId: (data as any).record_id,
        pdfPath: (data as any).pdf_path || null,
        downloadUrl: (data as any).download_url || null,
        decision: kind,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to record model release";
      toast({ title: "Could not record decision", description: msg, variant: "destructive" });
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
        <div className="flex items-center gap-2 mb-4">
          <Camera className="w-5 h-5 text-accent" />
          <h2 className="text-xl font-bold text-foreground">CMSP Model Release</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          We sometimes take photos and video during the CMSP Course for marketing, educational,
          and promotional use. Review the official Model Release below, then either{" "}
          <span className="font-semibold text-foreground">sign it</span> to grant permission, or{" "}
          <span className="font-semibold text-foreground">decline</span> if you do not want your
          photo or video taken. Declining will not affect your registration.
        </p>

        <PdfPreview url="/cmsp-model-release.pdf" title="CMSP Model Release" maxHeight={700} />
        <p className="text-xs text-muted-foreground mt-2">
          This is the exact document.{" "}
          <a href="/cmsp-model-release.pdf" target="_blank" rel="noopener noreferrer" className="text-accent underline">
            Open in a new tab
          </a>{" "}
          if you have trouble viewing it.
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
        <h3 className="font-semibold mb-4">Model Information (auto-filled)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <Field label="Legal Name" value={fullName} />
          <Field label="Date of Birth" value={prefill.dateOfBirth || ""} />
          <Field label="Email" value={prefill.email} />
          <Field label="Phone" value={prefill.phone || ""} />
          <Field label="Address" value={[prefill.addressStreet, prefill.addressCity, prefill.addressState, prefill.addressZip].filter(Boolean).join(", ")} />
          {prefill.locationLabel && <Field label="Location" value={prefill.locationLabel} />}
          {prefill.scheduleDate && <Field label="Class Date" value={prefill.scheduleDate} />}
          {prefill.isMinor && <Field label="Parent / Guardian" value={`${guardianFullName}${prefill.guardianRelationship ? " (" + prefill.guardianRelationship + ")" : ""}`} />}
        </div>
      </div>

      {!decision && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setDecision("sign")}
            className="text-left bg-card hover:bg-accent/5 border-2 border-border hover:border-accent rounded-2xl p-6 transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-accent/15 text-accent flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-foreground">Sign the Model Release</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              I grant Learn to Ride VC permission to take and use photos / video of me during the CMSP Course.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setDecision("decline")}
            className="text-left bg-card hover:bg-destructive/5 border-2 border-border hover:border-destructive rounded-2xl p-6 transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-destructive/15 text-destructive flex items-center justify-center">
                <CameraOff className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-foreground">Decline — Do Not Photograph Me</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              I do NOT want my photo or video taken, and I do not consent to any use of my likeness.
            </p>
          </button>
        </div>
      )}

      {decision === "sign" && (
        <>
          <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-4">
            <h3 className="font-semibold">Visual Reference (helps staff identify you on class day)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Bike Model</Label><Input value={bikeModel} onChange={(e) => setBikeModel(e.target.value)} placeholder="e.g. Honda Grom" /></div>
              <div><Label>Helmet Color</Label><Input value={helmetColor} onChange={(e) => setHelmetColor(e.target.value)} placeholder="e.g. Black" /></div>
              <div><Label>Jacket Color</Label><Input value={jacketColor} onChange={(e) => setJacketColor(e.target.value)} placeholder="e.g. Red" /></div>
              <div><Label>Pants Color</Label><Input value={pantsColor} onChange={(e) => setPantsColor(e.target.value)} placeholder="e.g. Blue" /></div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-3">
            <h3 className="font-semibold">Acknowledgments</h3>
            {SIGN_ACKS.map(a => (
              <label key={a.key} className="flex items-start gap-3 text-sm cursor-pointer">
                <Checkbox checked={!!signAcks[a.key]} onCheckedChange={(c) => setSignAcks(p => ({ ...p, [a.key]: !!c }))} className="mt-0.5" />
                <span className="leading-relaxed">{a.label}</span>
              </label>
            ))}
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-4">
            <h3 className="font-semibold">Your Signature</h3>
            <div>
              <Label>Type your full legal name *</Label>
              <Input value={typedSig} onChange={(e) => setTypedSig(e.target.value)} placeholder={fullName} />
              {typedSig && typedSig.trim().toLowerCase() !== fullName.toLowerCase() && (
                <p className="text-xs text-destructive mt-1">Must exactly match: {fullName}</p>
              )}
            </div>
            <SignaturePad label="Draw your signature *" onChange={setDrawnSig} />
          </div>

          {prefill.isMinor && (
            <div className="bg-accent/10 border border-accent/40 rounded-2xl p-6 md:p-8 space-y-4">
              <h3 className="font-semibold text-accent">Parent / Legal Guardian Signature (required — model is under 18)</h3>
              <div>
                <Label>Type guardian full legal name *</Label>
                <Input value={guardianTyped} onChange={(e) => setGuardianTyped(e.target.value)} placeholder={guardianFullName} />
              </div>
              <SignaturePad label="Draw guardian signature *" onChange={setGuardianDrawn} />
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Button type="button" variant="outline" onClick={() => setDecision(null)} disabled={submitting}>
              ← Change my decision
            </Button>
            <Button type="button" variant="hero" size="lg" disabled={!canSign || submitting} onClick={() => submit("sign")}>
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Recording…</> : "Sign Model Release & Continue"}
            </Button>
          </div>
        </>
      )}

      {decision === "decline" && (
        <>
          <div className="bg-destructive/5 border border-destructive/40 rounded-2xl p-6 md:p-8 space-y-3">
            <h3 className="font-semibold text-destructive">You are declining the CMSP Model Release</h3>
            <p className="text-sm text-muted-foreground">
              By signing your declination below, you are telling Learn to Ride VC that you do
              not want to be photographed or filmed during the CMSP Course, and that you do
              not consent to your likeness being used in any media. This will not affect your
              registration.
            </p>
            {DECLINE_ACKS.map(a => (
              <label key={a.key} className="flex items-start gap-3 text-sm cursor-pointer">
                <Checkbox checked={!!declineAcks[a.key]} onCheckedChange={(c) => setDeclineAcks(p => ({ ...p, [a.key]: !!c }))} className="mt-0.5" />
                <span className="leading-relaxed">{a.label}</span>
              </label>
            ))}
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-4">
            <h3 className="font-semibold">Your Signature (declining)</h3>
            <div>
              <Label>Type your full legal name *</Label>
              <Input value={declineTyped} onChange={(e) => setDeclineTyped(e.target.value)} placeholder={fullName} />
              {declineTyped && declineTyped.trim().toLowerCase() !== fullName.toLowerCase() && (
                <p className="text-xs text-destructive mt-1">Must exactly match: {fullName}</p>
              )}
            </div>
            <SignaturePad label="Draw your signature *" onChange={setDeclineDrawn} />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Button type="button" variant="outline" onClick={() => setDecision(null)} disabled={submitting}>
              ← Change my decision
            </Button>
            <Button type="button" variant="destructive" size="lg" disabled={!canDecline || submitting} onClick={() => submit("decline")}>
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Recording…</> : "Submit Declination & Continue"}
            </Button>
          </div>
        </>
      )}

      <div className="flex justify-start">
        <Button type="button" variant="ghost" onClick={onBack} disabled={submitting}>
          ← Back
        </Button>
      </div>

      <WaiverSignedDialog
        open={!!result}
        pdfPath={result?.pdfPath || null}
        downloadUrl={result?.downloadUrl || null}
        signerName={fullName}
        bucket="waivers"
        title={result?.decision === "sign" ? "Model Release Signed" : "Declination Recorded"}
        description={result?.decision === "sign"
          ? "Your signed CMSP Model Release has been securely saved to your file. You can download or print a copy for your records below."
          : "Your declination of the CMSP Model Release has been recorded. Staff will be notified not to photograph or film you. You can download or print a copy for your records below."}
        continueLabel="Continue to Waiver →"
        downloadPrefix={result?.decision === "sign" ? "Signed_CMSP_Model_Release" : "Declined_CMSP_Model_Release"}
        missingPdfMessage="A PDF copy was not saved. You can request a copy from the office."
        onContinue={() => result && onComplete(result.recordId, result.decision)}
      />
    </div>
  );
};

export default ModelReleaseStep;

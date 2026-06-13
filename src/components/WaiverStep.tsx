import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldCheck, Eraser } from "lucide-react";
import WaiverSignedDialog from "./WaiverSignedDialog";

export const CMSP_WAIVER_VERSION = "2026-02";

export const CMSP_WAIVER_TEXT = `CALIFORNIA MOTORCYCLIST SAFETY PROGRAM COURSE WAIVER AND INDEMNIFICATION

Participation in this course requires physical stamina, motor coordination, and mental alertness. The undersigned hereby attests that he/she has no known physical or mental limitations and has not used any form of alcohol, prescription or non-prescription drugs that could impair his/her performance in this course. Participants under 18 years of age must have this form signed by a parent or guardian.

READ CAREFULLY: THIS SECTION IS A LEGAL RELEASE, ASSUMPTION OF RISK, WAIVER AND COVENANT NOT TO SUE AGREEMENT.

In consideration of the State of California, California Motorcyclist Safety Program, Total Control Training, Inc., its owners, sponsors, supporters, affiliates, lessors, training locations, the training sponsor, the owner of the training motorcycle, and the owner of the land upon which training occurs, including each of their members, employees, officers, instructors and/or agents (the "Motorcycle Course Providers"), furnishing services, equipment, and/or curriculum to enable me to participate in the Motorcycle Rider Education Course, I agree as follows:

I fully understand and acknowledge that: (a) there are DANGERS AND RISK OF INJURY, DAMAGE, OR DEATH that exist in my use of motorcycles and motorcycle equipment and my participation in the Motorcycle Safety Course activities; (b) my participation in such activities and/or use of such equipment may result in injury or illness including, but not limited to, BODILY INJURY, DISEASE, STRAINS, FRACTURES, PARTIAL OR TOTAL PARALYSIS, OTHER AILMENTS THAT COULD CAUSE SERIOUS DISABILITY, OR DEATH; (c) these risks and dangers may be caused by negligence of the Motorcycle Course Providers; the negligence of others, including other Motorcycle Rider Education Course participants; and may arise from foreseeable or unforeseeable causes; and (d) by participating in these activities and/or using the equipment, I, on behalf of myself, my personal representatives and my heirs, hereby assume all risks and all responsibility, and agree to release the Motorcycle Course Providers for any injuries, losses and/or damages, including those caused solely or in part by the negligence of the Motorcycle Course Providers, or any other person.

I agree and understand that, on behalf of myself, my personal representatives and my heirs, I am relinquishing any and all rights I now have or may have in the future to sue the Motorcycle Course Providers for any and all injury, damage, or death I may suffer arising from motorcycle riding or its equipment, including claims based on the Motorcycle Course Providers' negligence.

If I have brought a motorcycle/scooter to use in the Motorcycle Rider Education Course, I also agree that this release applies to any damage that occurs to it during the Motorcycle Rider Education Course.

I HAVE READ THIS WAIVER AND RELEASE AGREEMENT AND BY SIGNING BELOW I AGREE IT IS MY INTENTION TO ASSUME ALL RISKS AND RELEASE THE ABOVE-NAMED MOTORCYCLE COURSE PROVIDERS FROM LIABILITY FOR PERSONAL INJURY, PROPERTY DAMAGE OR WRONGFUL DEATH CAUSED BY NEGLIGENCE OR ANY OTHER CAUSE. I fully understand and acknowledge this waiver and release section extends to the provisions of California Civil Code §1542, and to the similar laws of other states, military reservations, federal government, and/or jurisdictions where the Motorcycle Rider Education Course is offered, and consciously waive and release all unknown claims that may be later discovered.`;

const ACKS = [
  { key: "physical", label: "I attest I have no known physical or mental limitations and have not used alcohol or impairing drugs." },
  { key: "risk", label: "I acknowledge the dangers and risk of injury, damage, or death and assume all such risks." },
  { key: "release", label: "I release and covenant not to sue the Motorcycle Course Providers, including for their negligence." },
  { key: "personal_property", label: "If I bring my own motorcycle/scooter, this release applies to any damage to it." },
  { key: "esign", label: "I agree to sign this document electronically (ESIGN Act / UETA). My typed and drawn signature have the same legal effect as a handwritten signature." },
];

const computeInitials = (first: string, last: string) =>
  `${(first || "").trim().charAt(0)}${(last || "").trim().charAt(0)}`.toUpperCase();

export interface WaiverPrefill {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  licenseNumber?: string;
  licenseState?: string;
  isMinor: boolean;
  guardianFirstName?: string;
  guardianLastName?: string;
  guardianRelationship?: string;
  guardianEmail?: string;
  guardianPhone?: string;
  guardianLicenseNumber?: string;
  guardianLicenseState?: string;
  course?: string;
  location?: string;
  locationLabel?: string;
  scheduleId?: string | null;
  scheduleDate?: string | null;
}

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void;
  label: string;
}

const SignaturePad = ({ onChange, label }: SignaturePadProps) => {
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
    ctx.beginPath();
    ctx.moveTo(x, y);
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    dirty.current = true;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (dirty.current) onChange(canvasRef.current!.toDataURL("image/png"));
  };
  const clear = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
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
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
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
  prefill: WaiverPrefill;
  onBack: () => void;
  onSigned: (waiverId: string) => void;
}

const WaiverStep = ({ prefill, onBack, onSigned }: Props) => {
  const requiredInitials = computeInitials(prefill.firstName, prefill.lastName);
  const [acks, setAcks] = useState<Record<string, string>>({});
  const [typedSig, setTypedSig] = useState("");
  const [drawnSig, setDrawnSig] = useState<string | null>(null);
  const [guardianName, setGuardianName] = useState("");
  const [guardianRel, setGuardianRel] = useState("");
  const [guardianTyped, setGuardianTyped] = useState("");
  const [guardianDrawn, setGuardianDrawn] = useState<string | null>(null);
  const [guardianLicense, setGuardianLicense] = useState("");
  const [guardianLicenseState, setGuardianLicenseState] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signedResult, setSignedResult] = useState<{ waiverId: string; pdfPath: string | null; downloadUrl: string | null } | null>(null);

  const fullName = [prefill.firstName, prefill.middleName, prefill.lastName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const allInitialed = ACKS.every(a => (acks[a.key] || "").trim().toUpperCase() === requiredInitials && requiredInitials.length === 2);
  const typedMatches = typedSig.trim().toLowerCase() === fullName.toLowerCase();
  const minorReady = !prefill.isMinor || (
    guardianName.trim().length > 1 && guardianRel.trim().length > 1 &&
    guardianTyped.trim().length > 1 && !!guardianDrawn
  );
  const canSign = allInitialed && typedMatches && !!drawnSig && minorReady;

  const handleSign = async () => {
    if (!canSign) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("record-waiver", {
        body: {
          document_version: CMSP_WAIVER_VERSION,
          document_text: CMSP_WAIVER_TEXT,
          signer_first_name: prefill.firstName,
          signer_middle_name: prefill.middleName || null,
          signer_last_name: prefill.lastName,
          signer_email: prefill.email,
          signer_phone: prefill.phone || null,
          date_of_birth: prefill.dateOfBirth || null,
          license_number: prefill.licenseNumber || null,
          license_state: prefill.licenseState || null,
          is_minor: prefill.isMinor,
          guardian_name: prefill.isMinor ? guardianName : null,
          guardian_relationship: prefill.isMinor ? guardianRel : null,
          guardian_signature_typed: prefill.isMinor ? guardianTyped : null,
          guardian_signature_drawn: prefill.isMinor ? guardianDrawn : null,
          guardian_license_number: prefill.isMinor ? guardianLicense : null,
          guardian_license_state: prefill.isMinor ? guardianLicenseState : null,
          signature_typed: typedSig.trim(),
          signature_drawn: drawnSig,
          initials: requiredInitials,
          consent_acknowledgments: ACKS.map(a => ({
            key: a.key,
            label: a.label,
            initials: (acks[a.key] || "").trim().toUpperCase(),
            accepted: true as const,
          })),
          course: prefill.course,
          location: prefill.location,
          location_label: prefill.locationLabel,
          schedule_id: prefill.scheduleId || null,
          schedule_date: prefill.scheduleDate || null,
        },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setSignedResult({ waiverId: (data as any).waiver_id, pdfPath: (data as any).pdf_path || null, downloadUrl: (data as any).download_url || null });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to record waiver";
      toast({ title: "Could not sign waiver", description: msg, variant: "destructive" });
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
        <div className="mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <ShieldCheck className="w-5 h-5 text-accent shrink-0" />
            <h2 className="text-xl font-bold text-foreground">Sign Your CMSP Course Waiver</h2>
            <div className="inline-flex items-center rounded-full bg-accent/15 border border-accent/30 px-3 py-1 text-xs font-semibold text-accent">
              Scroll below the form to answer the questions
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Please review the official waiver below. Your registration information has been pre-filled.
          You will sign electronically — this carries the same legal weight as a handwritten signature
          under the federal ESIGN Act and California UETA.
        </p>

        <div className="rounded-lg border border-border bg-white overflow-hidden" style={{ height: 600 }}>
          <object
            data="/cmsp-waiver-template.pdf#view=FitH"
            type="application/pdf"
            className="w-full h-full"
            aria-label="CMSP Course Waiver"
          >
            <div className="p-4 text-sm">
              Your browser cannot display PDFs inline.{" "}
              <a href="/cmsp-waiver-template.pdf" target="_blank" rel="noopener noreferrer" className="text-accent underline">
                Open the waiver in a new tab
              </a>
              .
            </div>
          </object>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          This is the exact document you are signing. A signed copy will be saved to your file.
        </p>
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => document.getElementById('waiver-acknowledgments')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            Finish and Continue →
          </Button>
        </div>
      </div>

      <div id="waiver-acknowledgments" className="bg-card border border-border rounded-2xl p-6 md:p-8">
        <h3 className="font-semibold mb-4">Participant Information (auto-filled)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <Field label="Name" value={fullName} />
          <Field label="Email" value={prefill.email} />
          {prefill.phone && <Field label="Phone" value={prefill.phone} />}
          {prefill.dateOfBirth && <Field label="Date of Birth" value={prefill.dateOfBirth} />}
          {prefill.licenseNumber && (
            <Field label="License / ID #" value={`${prefill.licenseNumber}${prefill.licenseState ? " (" + prefill.licenseState + ")" : ""}`} />
          )}
          {prefill.locationLabel && <Field label="Location" value={prefill.locationLabel} />}
          {prefill.scheduleDate && <Field label="Class Date" value={prefill.scheduleDate} />}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
        <h3 className="font-semibold mb-1">Acknowledgments — initial each line to agree</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Type your initials <span className="font-semibold text-foreground">{requiredInitials || "—"}</span> in each box below to acknowledge that statement, just as you would on the paper form.
        </p>
        <div className="space-y-3">
          {ACKS.map(a => {
            const val = (acks[a.key] || "").toUpperCase();
            const ok = val === requiredInitials && requiredInitials.length === 2;
            return (
              <div key={a.key} className="flex items-start gap-3 text-sm">
                <Input
                  value={acks[a.key] || ""}
                  onChange={(e) => setAcks(p => ({ ...p, [a.key]: e.target.value.toUpperCase().slice(0, 4) }))}
                  placeholder={requiredInitials || "AB"}
                  maxLength={4}
                  className={`w-20 text-center font-semibold tracking-widest uppercase ${ok ? "border-accent" : ""}`}
                  aria-label={`Initials for: ${a.label}`}
                />
                <span className="leading-relaxed pt-2">{a.label}</span>
              </div>
            );
          })}
        </div>
        {!allInitialed && Object.values(acks).some(v => v) && (
          <p className="text-xs text-destructive mt-3">
            Initials must match {requiredInitials} for every line.
          </p>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-4">
        <h3 className="font-semibold">Your Signature</h3>
        <div>
          <Label>Type your full legal name *</Label>
          <Input
            value={typedSig}
            onChange={(e) => setTypedSig(e.target.value)}
            placeholder={fullName}
          />
          {typedSig && !typedMatches && (
            <p className="text-xs text-destructive mt-1">Must exactly match: {fullName}</p>
          )}
        </div>
        <SignaturePad label="Draw your signature *" onChange={setDrawnSig} />
      </div>

      {prefill.isMinor && (
        <div className="bg-accent/10 border border-accent/40 rounded-2xl p-6 md:p-8 space-y-4">
          <h3 className="font-semibold text-accent">Parent / Legal Guardian Signature (required — student is under 18)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Full legal name *</Label>
              <Input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
            </div>
            <div>
              <Label>Relationship *</Label>
              <Input value={guardianRel} onChange={(e) => setGuardianRel(e.target.value)} placeholder="Parent / Guardian" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Guardian License or ID #</Label>
              <Input value={guardianLicense} onChange={(e) => setGuardianLicense(e.target.value)} placeholder="D1234567" />
            </div>
            <div>
              <Label>Issuing State</Label>
              <Input value={guardianLicenseState} onChange={(e) => setGuardianLicenseState(e.target.value)} placeholder="CA" />
            </div>
          </div>
          <div>
            <Label>Type guardian full legal name *</Label>
            <Input value={guardianTyped} onChange={(e) => setGuardianTyped(e.target.value)} />
          </div>
          <SignaturePad label="Draw guardian signature *" onChange={setGuardianDrawn} />
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>
          ← Back to information
        </Button>
        <Button
          type="button"
          variant="hero"
          size="lg"
          disabled={!canSign || submitting}
          onClick={handleSign}
        >
          {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Recording…</> : "Sign Waiver & Continue to Payment"}
        </Button>
      </div>
      {!canSign && !submitting && (
        <p className="text-xs text-muted-foreground text-center">
          Initial each acknowledgment and complete your signature to continue.
        </p>
      )}
      <WaiverSignedDialog
        open={!!signedResult}
        pdfPath={signedResult?.pdfPath || null}
        downloadUrl={signedResult?.downloadUrl || null}
        signerName={fullName}
        onContinue={() => signedResult && onSigned(signedResult.waiverId)}
      />
    </div>
  );
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md bg-muted/30 border border-border px-3 py-2">
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="text-sm text-foreground">{value}</div>
  </div>
);

export default WaiverStep;

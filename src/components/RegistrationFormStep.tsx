import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileSignature, Eraser } from "lucide-react";
import WaiverSignedDialog from "./WaiverSignedDialog";

export const CMSP_REGISTRATION_FORM_VERSION = "3.15-2026-02";

export interface RegistrationFormPrefill {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  sex?: "M" | "F" | "";
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  idType: "drivers_license" | "permit" | "state_id" | "foreign_license" | "passport" | "other";
  idNumber: string;
  idState?: string;
  idCountry?: string;
  idExpiration?: string;
  referralSource?: string;
  course?: string;
  location?: string;
  locationLabel?: string;
  scheduleId?: string | null;
  scheduleDate?: string | null;
}

const ACKS = [
  { key: "truthful", label: "I certify that the information I have provided on this registration form is true, accurate, and complete to the best of my knowledge." },
  { key: "id_match", label: "I will present the same government-issued photo ID listed above at check-in, and it will match my legal name on this form." },
  { key: "esign", label: "I agree to sign this CMSP Student Registration Form electronically (ESIGN Act / UETA). My typed and drawn signatures have the same legal effect as a handwritten signature." },
];

const REFERRAL_OPTIONS = [
  "Friend", "Tradeshow", "Catalog", "School", "Online Search", "DMV",
  "Dealer", "Insurance", "Courts", "Magazine", "CMSP website", "Brochure",
];

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
  prefill: RegistrationFormPrefill;
  onBack: () => void;
  onSigned: (recordId: string) => void;
}

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md bg-muted/30 border border-border px-3 py-2">
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="text-sm text-foreground">{value || "—"}</div>
  </div>
);

const RegistrationFormStep = ({ prefill, onBack, onSigned }: Props) => {
  const fullName = [prefill.firstName, prefill.middleName, prefill.lastName]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

  // Riding experience
  const [q1, setQ1] = useState<"" | "yes" | "no">("");
  const [q2, setQ2] = useState<"" | "lt_500" | "500_2000" | "gt_2000">("");
  const [q3, setQ3] = useState("");
  const [q4, setQ4] = useState<"" | "yes" | "no">("");
  const [q5, setQ5] = useState("");
  const [q6, setQ6] = useState<"" | "yes" | "no">("");
  const [q6cc, setQ6cc] = useState("");
  const [q7, setQ7] = useState<"" | "commuting" | "recreation" | "other">("");
  const [q7Other, setQ7Other] = useState("");
  const [q8, setQ8] = useState<"" | "yes" | "no">("");
  const [q9, setQ9] = useState<string[]>(() =>
    prefill.referralSource && REFERRAL_OPTIONS.includes(prefill.referralSource) ? [prefill.referralSource] : []
  );
  const [q9Other, setQ9Other] = useState("");
  const [q10, setQ10] = useState<"" | "yes" | "no">("");
  const [q11, setQ11] = useState<"" | "yes" | "no">("");
  const [q12, setQ12] = useState<"" | "yes" | "no">("");

  const [acks, setAcks] = useState<Record<string, boolean>>({});
  const [typedSig, setTypedSig] = useState("");
  const [drawnSig, setDrawnSig] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signedResult, setSignedResult] = useState<{ recordId: string; pdfPath: string | null; downloadUrl: string | null } | null>(null);

  const allAcked = ACKS.every(a => acks[a.key]);
  const typedMatches = typedSig.trim().toLowerCase() === fullName.toLowerCase();
  const requiredAnswered = !!q1 && !!q2 && !!q4 && !!q6 && !!q7 && !!q8 && !!q10 && !!q11 && !!q12
    && (q7 !== "other" || q7Other.trim().length > 0);
  const canSign = allAcked && typedMatches && !!drawnSig && requiredAnswered;

  const age = prefill.dateOfBirth ? (() => {
    const t = new Date(); const b = new Date(prefill.dateOfBirth);
    let a = t.getFullYear() - b.getFullYear();
    const m = t.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
    return a;
  })() : null;

  const toggleQ9 = (opt: string, on: boolean) => {
    setQ9(prev => on ? [...prev, opt] : prev.filter(x => x !== opt));
  };

  const handleSign = async () => {
    if (!canSign) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("record-registration-form", {
        body: {
          first_name: prefill.firstName,
          middle_name: prefill.middleName || null,
          last_name: prefill.lastName,
          email: prefill.email,
          phone_mobile: prefill.phone || null,
          phone_home: null,
          phone_work: null,
          date_of_birth: prefill.dateOfBirth || null,
          age: age,
          sex: prefill.sex || "",
          address_street: prefill.addressStreet || null,
          address_city: prefill.addressCity || null,
          address_state: prefill.addressState || null,
          address_zip: prefill.addressZip || null,
          id_type: prefill.idType,
          id_number: prefill.idNumber,
          id_state: prefill.idState || null,
          id_country: prefill.idCountry || null,
          id_expiration: prefill.idExpiration || null,
          q1_ridden_regularly_5yr: q1,
          q2_experience_bucket: q2,
          q3_years_riding: q3 || null,
          q4_off_road: q4,
          q5_miles_past_year: q5 || null,
          q6_owns_motorcycle: q6,
          q6_engine_cc: q6 === "yes" ? (q6cc || null) : null,
          q7_primary_reason: q7,
          q7_other: q7 === "other" ? q7Other : null,
          q8_prior_accident: q8,
          q9_referral_sources: q9,
          q9_other: q9Other || null,
          q10_called_for_info: q10,
          q11_taken_before: q11,
          q12_cmsp_contact_future: q12,
          signature_typed: typedSig.trim(),
          signature_drawn: drawnSig,
          consent_acknowledgments: ACKS.map(a => ({ key: a.key, label: a.label, accepted: true as const })),
          course: prefill.course || null,
          location: prefill.location || null,
          location_label: prefill.locationLabel || null,
          schedule_id: prefill.scheduleId || null,
          schedule_date: prefill.scheduleDate || null,
          document_version: CMSP_REGISTRATION_FORM_VERSION,
        },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setSignedResult({
        recordId: (data as any).record_id,
        pdfPath: (data as any).pdf_path || null,
        downloadUrl: (data as any).download_url || null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to record registration form";
      toast({ title: "Could not sign registration form", description: msg, variant: "destructive" });
      setSubmitting(false);
    }
  };

  const Yn = ({ value, onChange, name }: { value: string; onChange: (v: any) => void; name: string }) => (
    <RadioGroup value={value} onValueChange={onChange} className="flex gap-4">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <RadioGroupItem value="yes" id={`${name}-yes`} /> Yes
      </label>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <RadioGroupItem value="no" id={`${name}-no`} /> No
      </label>
    </RadioGroup>
  );

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
        <div className="flex items-center gap-2 mb-4">
          <FileSignature className="w-5 h-5 text-accent" />
          <h2 className="text-xl font-bold text-foreground">Sign Your CMSP Student Registration Form</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          This is the official California Motorcyclist Safety Program Student Registration Form.
          Review the form below, complete the riding-experience questions, and sign electronically
          — this carries the same legal weight as a handwritten signature under the federal ESIGN Act
          and California UETA.
        </p>

        <div className="rounded-lg border border-border bg-white overflow-hidden" style={{ height: 700 }}>
          <iframe
            src="/cmsp-registration-form.pdf#view=FitH&toolbar=1"
            title="CMSP Student Registration Form"
            className="w-full h-full"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          This is the exact document you are signing.{" "}
          <a href="/cmsp-registration-form.pdf" target="_blank" rel="noopener noreferrer" className="text-accent underline">
            Open in a new tab
          </a>{" "}
          if you have trouble viewing it. A signed copy will be saved to your file.
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
        <h3 className="font-semibold mb-4">Personal Data (auto-filled)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <Field label="Legal Name" value={fullName} />
          <Field label="Date of Birth" value={prefill.dateOfBirth || ""} />
          <Field label="Sex" value={prefill.sex || ""} />
          <Field label="Email" value={prefill.email} />
          <Field label="Phone" value={prefill.phone || ""} />
          <Field label="Address" value={[prefill.addressStreet, prefill.addressCity, prefill.addressState, prefill.addressZip].filter(Boolean).join(", ")} />
          <Field label="Photo ID" value={`${prefill.idType.replace("_", " ")} #${prefill.idNumber}${prefill.idState ? " · " + prefill.idState : ""}${prefill.idExpiration ? " · exp " + prefill.idExpiration : ""}`} />
          {prefill.locationLabel && <Field label="Location" value={prefill.locationLabel} />}
          {prefill.scheduleDate && <Field label="Class Date" value={prefill.scheduleDate} />}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-5">
        <h3 className="font-semibold">On-Street Riding Experience</h3>

        <div>
          <Label className="text-sm">1. Have you ridden a street motorcycle regularly in the last five years? *</Label>
          <div className="mt-2"><Yn value={q1} onChange={setQ1} name="q1" /></div>
        </div>

        <div>
          <Label className="text-sm">2. How much street riding experience do you have? *</Label>
          <RadioGroup value={q2} onValueChange={(v: any) => setQ2(v)} className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer"><RadioGroupItem value="lt_500" id="q2a" /> Less than 500 miles</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><RadioGroupItem value="500_2000" id="q2b" /> 500 to 2000 miles</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><RadioGroupItem value="gt_2000" id="q2c" /> More than 2000 miles</label>
          </RadioGroup>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm">3. How long have you been riding? (years)</Label>
            <Input value={q3} onChange={(e) => setQ3(e.target.value)} placeholder="e.g. 2" />
          </div>
          <div>
            <Label className="text-sm">4. Have you ridden off road? *</Label>
            <div className="mt-2"><Yn value={q4} onChange={setQ4} name="q4" /></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm">5. On-street miles ridden in past year</Label>
            <Input value={q5} onChange={(e) => setQ5(e.target.value)} placeholder="e.g. 500" />
          </div>
          <div>
            <Label className="text-sm">6. Do you own a street motorcycle/scooter? *</Label>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Yn value={q6} onChange={setQ6} name="q6" />
              {q6 === "yes" && (
                <Input value={q6cc} onChange={(e) => setQ6cc(e.target.value)} placeholder="cc" className="w-24" />
              )}
            </div>
          </div>
        </div>

        <div>
          <Label className="text-sm">7. Primary reason for riding a motorcycle/scooter on street *</Label>
          <RadioGroup value={q7} onValueChange={(v: any) => setQ7(v)} className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer"><RadioGroupItem value="commuting" id="q7a" /> Commuting</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><RadioGroupItem value="recreation" id="q7b" /> Recreation</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><RadioGroupItem value="other" id="q7c" /> Other</label>
          </RadioGroup>
          {q7 === "other" && (
            <Input className="mt-2" value={q7Other} onChange={(e) => setQ7Other(e.target.value)} placeholder="Please explain" />
          )}
        </div>

        <div>
          <Label className="text-sm">8. Ever been involved in an on-street motorcycle/scooter accident? *</Label>
          <div className="mt-2"><Yn value={q8} onChange={setQ8} name="q8" /></div>
        </div>

        <div>
          <Label className="text-sm">9. How did you hear about this course? (check all that apply)</Label>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
            {REFERRAL_OPTIONS.map(opt => (
              <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={q9.includes(opt)} onCheckedChange={(c) => toggleQ9(opt, !!c)} />
                {opt}
              </label>
            ))}
          </div>
          <Input className="mt-2" value={q9Other} onChange={(e) => setQ9Other(e.target.value)} placeholder="Other (please explain)" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-sm">10. Did you call for Motorcyclist Training Course information? *</Label>
            <div className="mt-2"><Yn value={q10} onChange={setQ10} name="q10" /></div>
          </div>
          <div>
            <Label className="text-sm">11. Have you ever taken this course before? *</Label>
            <div className="mt-2"><Yn value={q11} onChange={setQ11} name="q11" /></div>
          </div>
          <div>
            <Label className="text-sm">12. May CMSP contact you in the future? *</Label>
            <div className="mt-2"><Yn value={q12} onChange={setQ12} name="q12" /></div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-3">
        <h3 className="font-semibold">Acknowledgments</h3>
        {ACKS.map(a => (
          <label key={a.key} className="flex items-start gap-3 text-sm cursor-pointer">
            <Checkbox
              checked={!!acks[a.key]}
              onCheckedChange={(c) => setAcks(p => ({ ...p, [a.key]: !!c }))}
              className="mt-0.5"
            />
            <span className="leading-relaxed">{a.label}</span>
          </label>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-4">
        <h3 className="font-semibold">Your Signature</h3>
        <div>
          <Label>Type your full legal name *</Label>
          <Input value={typedSig} onChange={(e) => setTypedSig(e.target.value)} placeholder={fullName} />
          {typedSig && !typedMatches && (
            <p className="text-xs text-destructive mt-1">Must exactly match: {fullName}</p>
          )}
        </div>
        <SignaturePad label="Draw your signature *" onChange={setDrawnSig} />
      </div>

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
          {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Recording…</> : "Sign Registration Form & Continue"}
        </Button>
      </div>
      {!canSign && !submitting && (
        <p className="text-xs text-muted-foreground text-center">
          Answer the required riding-experience questions, check each acknowledgment, and complete your signature to continue.
        </p>
      )}
      <WaiverSignedDialog
        open={!!signedResult}
        pdfPath={signedResult?.pdfPath || null}
        downloadUrl={signedResult?.downloadUrl || null}
        signerName={fullName}
        bucket="waivers"
        title="Registration Form Signed"
        description="Your signed CMSP Student Registration Form has been securely saved to your file. You can download or print a copy for your records below."
        continueLabel="Continue to Waiver →"
        downloadPrefix="Signed_CMSP_Registration_Form"
        missingPdfMessage="A PDF copy was not saved for this registration form. You can request a copy from the office."
        onContinue={() => signedResult && onSigned(signedResult.recordId)}
      />
    </div>
  );
};

export default RegistrationFormStep;

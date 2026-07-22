import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileSignature, CheckCircle2, ArrowLeft, ArrowRight, Pencil } from "lucide-react";
import { SharedDocuSignPad } from "./docusign/SharedDocuSignPad";
import type { RegistrationFormPrefill } from "./RegistrationFormStep";
import { CMSP_REGISTRATION_FORM_VERSION } from "./RegistrationFormStep";
import WaiverSignedDialog from "./WaiverSignedDialog";

interface Props {
  prefill: RegistrationFormPrefill;
  onBack: () => void;
  onSigned: (recordId: string) => void;
}

// Matches the 10 real options printed on the CMSP form (no DMV / Brochure)
const HEAR_OPTIONS = [
  "Friend", "Tradeshow", "Catalog", "School", "Online Search",
  "Dealer", "Insurance", "Courts", "Magazine", "CMSP website",
] as const;
type HearOpt = typeof HEAR_OPTIONS[number];

type YN = "yes" | "no" | "";

const RegistrationFormDocuSign = ({ prefill, onBack, onSigned }: Props) => {
  const fullName = [prefill.firstName, prefill.middleName, prefill.lastName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const guardianFullName = [prefill.guardianFirstName, prefill.guardianLastName].filter(Boolean).join(" ").trim();

  // Answers
  const [q1v, setQ1v] = useState<YN>("");
  const [q2v, setQ2v] = useState<"lt_500" | "500_2000" | "gt_2000" | "">("");
  const [q3v, setQ3v] = useState("");
  const [q4v, setQ4v] = useState<YN>("");
  const [q5v, setQ5v] = useState("");
  const [q6v, setQ6v] = useState<YN>("");
  const [q6cc, setQ6cc] = useState("");
  const [q7v, setQ7v] = useState<"commuting" | "recreation" | "other" | "">("");
  const [q7other, setQ7other] = useState("");
  const [q8v, setQ8v] = useState<YN>("");
  const [q9v, setQ9v] = useState<YN>("");
  const [q10v, setQ10v] = useState<YN>("");
  const [q11v, setQ11v] = useState<YN>("");
  const [hearSel, setHearSel] = useState<Record<HearOpt, boolean>>(() =>
    HEAR_OPTIONS.reduce((a, k) => ({ ...a, [k]: false }), {} as Record<HearOpt, boolean>));
  const [hearOther, setHearOther] = useState("");
  const toggleHear = (k: HearOpt) => setHearSel(prev => ({ ...prev, [k]: !prev[k] }));

  const [sig, setSig] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [adoptOpen, setAdoptOpen] = useState(false);
  const [guardianSig, setGuardianSig] = useState<string | null>(null);
  const [guardianTyped, setGuardianTyped] = useState("");
  const [guardianAdoptOpen, setGuardianAdoptOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ recordId: string; pdfPath: string | null; downloadUrl: string | null } | null>(null);

  const dateStr = useMemo(() => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
  }, []);

  const age = useMemo(() => {
    if (!prefill.dateOfBirth) return "";
    const d = new Date(prefill.dateOfBirth); if (isNaN(d.getTime())) return "";
    const now = new Date();
    let a = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--;
    return String(a);
  }, [prefill.dateOfBirth]);

  // -------- Wizard steps --------
  type Step = {
    id: string;
    title: string;
    subtitle?: string;
    render: () => JSX.Element;
    valid: () => boolean;
  };

  const YesNo = ({ v, onChange }: { v: YN; onChange: (v: YN) => void }) => (
    <div className="grid grid-cols-2 gap-3">
      {(["yes", "no"] as const).map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`py-4 rounded-xl border-2 text-lg font-semibold transition ${
            v === opt
              ? "border-accent bg-accent/15 text-accent"
              : "border-border bg-card hover:border-accent/60 text-foreground"
          }`}
        >
          {opt === "yes" ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );

  const PickList = <T extends string>({
    value, onChange, options,
  }: { value: T | ""; onChange: (v: T) => void; options: { value: T; label: string }[] }) => (
    <div className="grid gap-2">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`w-full text-left px-4 py-3 rounded-xl border-2 font-medium transition ${
            value === o.value
              ? "border-accent bg-accent/15 text-accent"
              : "border-border bg-card hover:border-accent/60 text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  const steps: Step[] = [
    {
      id: "q1", title: "Have you ridden a motorcycle regularly in the last 5 years?",
      render: () => <YesNo v={q1v} onChange={setQ1v} />,
      valid: () => !!q1v,
    },
    {
      id: "q2", title: "About how many miles have you ridden in the last year?",
      render: () => (
        <PickList
          value={q2v}
          onChange={setQ2v as any}
          options={[
            { value: "lt_500", label: "Less than 500 miles" },
            { value: "500_2000", label: "500 – 2,000 miles" },
            { value: "gt_2000", label: "More than 2,000 miles" },
          ]}
        />
      ),
      valid: () => !!q2v,
    },
    {
      id: "q3", title: "How many years have you been riding? (optional)",
      subtitle: "Leave blank if you've never ridden.",
      render: () => (
        <Input inputMode="numeric" placeholder="Years" value={q3v} onChange={e => setQ3v(e.target.value)} className="text-lg" />
      ),
      valid: () => true,
    },
    {
      id: "q4", title: "Have you ridden off-road (dirt bike, ATV, etc.)?",
      render: () => <YesNo v={q4v} onChange={setQ4v} />,
      valid: () => !!q4v,
    },
    {
      id: "q5", title: "Miles ridden off-road in the past year (optional)",
      render: () => (
        <Input inputMode="numeric" placeholder="Miles" value={q5v} onChange={e => setQ5v(e.target.value)} className="text-lg" />
      ),
      valid: () => true,
    },
    {
      id: "q6", title: "Do you own a motorcycle?",
      render: () => (
        <div className="space-y-3">
          <YesNo v={q6v} onChange={setQ6v} />
          {q6v === "yes" && (
            <div>
              <label className="text-sm text-muted-foreground">Engine size (cc) — optional</label>
              <Input inputMode="numeric" placeholder="e.g. 650" value={q6cc} onChange={e => setQ6cc(e.target.value)} className="text-lg" />
            </div>
          )}
        </div>
      ),
      valid: () => !!q6v,
    },
    {
      id: "q7", title: "What is your primary reason for taking this course?",
      render: () => (
        <div className="space-y-3">
          <PickList
            value={q7v}
            onChange={setQ7v as any}
            options={[
              { value: "commuting", label: "Commuting" },
              { value: "recreation", label: "Recreation" },
              { value: "other", label: "Other" },
            ]}
          />
          {q7v === "other" && (
            <Input placeholder="Please explain" value={q7other} onChange={e => setQ7other(e.target.value)} className="text-lg" />
          )}
        </div>
      ),
      valid: () => !!q7v && (q7v !== "other" || !!q7other.trim()),
    },
    {
      id: "q8", title: "Have you ever been in a motorcycle accident on the street?",
      render: () => <YesNo v={q8v} onChange={setQ8v} />,
      valid: () => !!q8v,
    },
    {
      id: "q9", title: "Did you call our office for information before registering?",
      render: () => <YesNo v={q9v} onChange={setQ9v} />,
      valid: () => !!q9v,
    },
    {
      id: "hear", title: "How did you hear about this course?",
      subtitle: "Select all that apply.",
      render: () => (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {HEAR_OPTIONS.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => toggleHear(opt)}
                className={`px-3 py-3 rounded-xl border-2 font-medium text-left transition ${
                  hearSel[opt]
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border bg-card hover:border-accent/60 text-foreground"
                }`}
              >
                <span className="inline-block w-5 h-5 mr-2 rounded border align-middle text-center leading-4 text-xs">
                  {hearSel[opt] ? "✓" : ""}
                </span>
                {opt}
              </button>
            ))}
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Other — please explain (optional)</label>
            <Input value={hearOther} onChange={e => setHearOther(e.target.value)} className="text-lg" />
          </div>
        </div>
      ),
      valid: () => true,
    },
    {
      id: "q10", title: "Have you taken this course before?",
      render: () => <YesNo v={q10v} onChange={setQ10v} />,
      valid: () => !!q10v,
    },
    {
      id: "q11", title: "May the CMSP contact you in the future?",
      render: () => <YesNo v={q11v} onChange={setQ11v} />,
      valid: () => !!q11v,
    },
  ];

  const [stepIdx, setStepIdx] = useState(0);
  // -1 = intro is not used; steps.length = review screen
  const isReview = stepIdx >= steps.length;

  const allValid = steps.every(s => s.valid());
  const canSubmit = allValid && sig && (!prefill.isMinor || guardianSig);

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const body = {
        first_name: prefill.firstName,
        middle_name: prefill.middleName || null,
        last_name: prefill.lastName,
        email: prefill.email,
        phone_mobile: prefill.phone || null,
        phone_home: null, phone_work: null,
        date_of_birth: prefill.dateOfBirth || null,
        age: age ? Number(age) : null,
        sex: prefill.sex || null,
        address_street: prefill.addressStreet || null,
        address_city: prefill.addressCity || null,
        address_state: prefill.addressState || null,
        address_zip: prefill.addressZip || null,
        id_type: prefill.idType,
        id_number: prefill.idNumber,
        id_state: prefill.idState || null,
        id_country: prefill.idCountry || null,
        id_expiration: prefill.idExpiration || null,
        q1_ridden_regularly_5yr: q1v,
        q2_experience_bucket: q2v,
        q3_years_riding: q3v,
        q4_off_road: q4v,
        q5_miles_past_year: q5v,
        q6_owns_motorcycle: q6v,
        q6_engine_cc: q6cc || null,
        q7_primary_reason: q7v,
        q7_other: q7v === "other" ? q7other : null,
        q8_prior_accident: q8v,
        q9_called_for_info: q9v,
        q10_taken_before: q10v,
        q11_cmsp_contact_future: q11v,
        q9_hear_about_sources: HEAR_OPTIONS.filter(o => hearSel[o]),
        q9_hear_other: hearOther || null,
        signature_typed: typed || fullName,
        signature_drawn: sig,
        guardian_name: prefill.isMinor ? guardianFullName : null,
        guardian_relationship: prefill.isMinor ? (prefill.guardianRelationship || null) : null,
        guardian_signature_typed: prefill.isMinor ? (guardianTyped || guardianFullName) : null,
        guardian_signature_drawn: prefill.isMinor ? guardianSig : null,
        is_minor: !!prefill.isMinor,
        consent_acknowledgments: [
          { key: "truthful", label: "Answers are true and complete", accepted: true },
          { key: "id_match", label: "ID at check-in will match name on this form", accepted: true },
          { key: "esign", label: "Consent to sign electronically (ESIGN Act / UETA)", accepted: true },
          ...(prefill.isMinor ? [{ key: "guardian", label: `Parent/guardian (${prefill.guardianRelationship || "guardian"}) signed on behalf of the minor`, accepted: true as const }] : []),
        ],
        course: prefill.course || null,
        location: prefill.location || null,
        location_label: prefill.locationLabel || null,
        schedule_id: prefill.scheduleId || null,
        schedule_date: prefill.scheduleDate || null,
        document_version: CMSP_REGISTRATION_FORM_VERSION,
      };
      const { data, error } = await supabase.functions.invoke("record-registration-form", { body });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult({
        recordId: (data as any).record_id,
        pdfPath: (data as any).pdf_path || null,
        downloadUrl: (data as any).download_url || null,
      });
    } catch (e) {
      toast({ title: "Could not save", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <WaiverSignedDialog
        open pdfPath={result.pdfPath} downloadUrl={result.downloadUrl}
        signerName={fullName} onContinue={() => onSigned(result.recordId)}
        title="Registration Form Signed"
        description="Your CMSP Student Registration Form has been saved to your file."
        continueLabel="Continue →"
        downloadPrefix="Signed_CMSP_Registration_Form"
      />
    );
  }

  // ----- Header (always visible) -----
  const total = steps.length;
  const currentNumber = Math.min(stepIdx + 1, total);
  const progressPct = isReview ? 100 : Math.round(((stepIdx) / total) * 100);

  const answerSummaries: { id: string; label: string; value: string }[] = [
    { id: "q1", label: "Ridden regularly in last 5 years", value: q1v || "—" },
    { id: "q2", label: "Miles ridden last year", value: { lt_500: "< 500", "500_2000": "500–2,000", gt_2000: "> 2,000", "": "—" }[q2v] },
    { id: "q3", label: "Years riding", value: q3v || "—" },
    { id: "q4", label: "Off-road experience", value: q4v || "—" },
    { id: "q5", label: "Off-road miles last year", value: q5v || "—" },
    { id: "q6", label: "Owns motorcycle", value: q6v ? (q6v === "yes" && q6cc ? `Yes (${q6cc}cc)` : q6v) : "—" },
    { id: "q7", label: "Primary reason", value: q7v ? (q7v === "other" ? `Other — ${q7other || ""}` : q7v) : "—" },
    { id: "q8", label: "Prior street accident", value: q8v || "—" },
    { id: "q9", label: "Called office for info", value: q9v || "—" },
    { id: "hear", label: "Heard about course", value: [...HEAR_OPTIONS.filter(o => hearSel[o]), hearOther && `Other: ${hearOther}`].filter(Boolean).join(", ") || "—" },
    { id: "q10", label: "Taken course before", value: q10v || "—" },
    { id: "q11", label: "CMSP may contact you", value: q11v || "—" },
  ];

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="bg-card border border-border rounded-2xl p-4 md:p-6">
        <div className="flex items-center gap-2 mb-2">
          <FileSignature className="w-5 h-5 text-accent" />
          <h2 className="text-lg md:text-xl font-bold text-foreground">CMSP Student Registration Form</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Answer each question one at a time. When you're done we'll fill in the official form
          and stamp it with your signature — nothing to align or print.
        </p>
      </div>

      {/* Progress */}
      <div className="bg-card border border-border rounded-xl px-4 py-3">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-semibold text-foreground">
            {isReview ? "Review your answers" : `Question ${currentNumber} of ${total}`}
          </span>
          <span className="text-muted-foreground">{progressPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-accent transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {!isReview && (
        <div className="bg-card border border-border rounded-2xl p-5 md:p-6 space-y-4">
          <div>
            <h3 className="text-lg md:text-xl font-bold text-foreground">{steps[stepIdx].title}</h3>
            {steps[stepIdx].subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{steps[stepIdx].subtitle}</p>
            )}
          </div>
          <div>{steps[stepIdx].render()}</div>
          <div className="flex items-center justify-between pt-2">
            <Button
              type="button" variant="outline"
              onClick={() => (stepIdx === 0 ? onBack() : setStepIdx(stepIdx - 1))}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              {stepIdx === 0 ? "Back" : "Previous"}
            </Button>
            <Button
              type="button" variant="hero"
              disabled={!steps[stepIdx].valid()}
              onClick={() => setStepIdx(stepIdx + 1)}
            >
              {stepIdx === steps.length - 1 ? "Review" : "Next"}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {isReview && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 md:p-6 space-y-3">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-accent" /> Your answers
            </h3>
            <p className="text-sm text-muted-foreground">
              Tap any row to edit. Autofilled info (name, address, ID) comes from your registration.
            </p>
            <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
              {answerSummaries.map((row, i) => (
                <button
                  key={row.id} type="button"
                  onClick={() => setStepIdx(i)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50"
                >
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{row.label}</div>
                    <div className="text-sm font-medium text-foreground">{row.value}</div>
                  </div>
                  <Pencil className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Signature */}
          <div className="bg-card border-2 border-accent/40 rounded-2xl p-5 md:p-6 space-y-3">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-accent" /> Your signature
            </h3>
            {sig ? (
              <div className="bg-accent/5 border border-accent/40 rounded-xl p-4 flex items-center gap-3">
                <img src={sig} alt="signature" className="h-12 bg-white border border-border rounded" />
                <div className="text-sm flex-1">
                  <div className="font-semibold text-foreground">{typed || fullName}</div>
                  <div className="text-muted-foreground">Signed {dateStr}</div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setAdoptOpen(true)}>Re-sign</Button>
              </div>
            ) : (
              <Button type="button" variant="hero" onClick={() => setAdoptOpen(true)}>
                Adopt signature
              </Button>
            )}
          </div>

          {prefill.isMinor && (
            <div className="bg-card border-2 border-accent/40 rounded-2xl p-5 md:p-6 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <FileSignature className="w-5 h-5 text-accent" />
                <h3 className="font-bold text-foreground">Parent / Legal Guardian Signature</h3>
                <span className="text-xs font-semibold uppercase tracking-wide bg-accent/15 text-accent px-2 py-0.5 rounded">Required — Minor</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Because the student is under 18, a parent or legal guardian must also sign.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Guardian: </span><span className="font-medium">{guardianFullName || "—"}</span></div>
                <div><span className="text-muted-foreground">Relationship: </span><span className="font-medium">{prefill.guardianRelationship || "—"}</span></div>
              </div>
              {guardianSig ? (
                <div className="bg-accent/5 border border-accent/40 rounded-xl p-4 flex items-center gap-3">
                  <img src={guardianSig} alt="guardian signature" className="h-12 bg-white border border-border rounded" />
                  <div className="text-sm flex-1">
                    <div className="font-semibold text-foreground">{guardianTyped || guardianFullName}</div>
                    <div className="text-muted-foreground">Signed {dateStr}</div>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setGuardianAdoptOpen(true)}>Re-sign</Button>
                </div>
              ) : (
                <Button type="button" variant="hero" onClick={() => setGuardianAdoptOpen(true)}>
                  Adopt guardian signature
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" onClick={() => setStepIdx(steps.length - 1)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to questions
            </Button>
            <Button type="button" variant="hero" onClick={submit} disabled={!canSubmit || submitting}>
              {submitting ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Generating…</> : "Generate & Submit"}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={adoptOpen} onOpenChange={setAdoptOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Adopt your signature</DialogTitle></DialogHeader>
          <SharedDocuSignPad
            mode="signature" defaultTyped={fullName}
            prompt="This signature will be applied to the CMSP Student Registration Form. Legally binding under ESIGN / UETA."
            onCancel={() => setAdoptOpen(false)}
            onSave={(url, t) => { setSig(url); setTyped(t); setAdoptOpen(false); }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={guardianAdoptOpen} onOpenChange={setGuardianAdoptOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Adopt guardian signature</DialogTitle></DialogHeader>
          <SharedDocuSignPad
            mode="signature" defaultTyped={guardianFullName}
            prompt="This signature will be applied on behalf of the minor. Legally binding under ESIGN / UETA."
            onCancel={() => setGuardianAdoptOpen(false)}
            onSave={(url, t) => { setGuardianSig(url); setGuardianTyped(t); setGuardianAdoptOpen(false); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RegistrationFormDocuSign;

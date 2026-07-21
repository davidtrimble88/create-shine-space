import { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
// @ts-ignore
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileSignature, CheckCircle2 } from "lucide-react";
import { SharedDocuSignPad } from "./docusign/SharedDocuSignPad";
import type { RegistrationFormPrefill } from "./RegistrationFormStep";
import { CMSP_REGISTRATION_FORM_VERSION } from "./RegistrationFormStep";
import WaiverSignedDialog from "./WaiverSignedDialog";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

const TEMPLATE_URL = "/cmsp-registration-form.pdf";

interface Props {
  prefill: RegistrationFormPrefill;
  onBack: () => void;
  onSigned: (recordId: string) => void;
}

// Yes/No/Other checkbox positions on the template (yTop from pdfplumber, 792-tall page)
type CB = { x: number; y: number };
const CB_SIZE = 8;

const q1 = { yes: { x: 316, y: 455.7 } as CB, no: { x: 346, y: 455.7 } as CB };
const q2 = {
  lt_500: { x: 36, y: 479.7 } as CB,
  "500_2000": { x: 144, y: 479.7 } as CB,
  gt_2000: { x: 252, y: 479.7 } as CB,
};
const q4 = { yes: { x: 152, y: 503.7 } as CB, no: { x: 182, y: 503.7 } as CB };
const q6 = { yes: { x: 244, y: 539.7 } as CB, no: { x: 284, y: 539.7 } as CB };
const q7 = {
  commuting: { x: 36, y: 563.7 } as CB,
  recreation: { x: 97, y: 563.7 } as CB,
  other: { x: 156, y: 563.7 } as CB,
};
const q8 = { yes: { x: 366, y: 575.7 } as CB, no: { x: 396, y: 575.7 } as CB };
const q9 = { yes: { x: 281, y: 639.9 } as CB, no: { x: 311, y: 639.9 } as CB };
const q10 = { yes: { x: 214, y: 651.9 } as CB, no: { x: 244, y: 651.9 } as CB };
const q11 = { yes: { x: 202, y: 663.9 } as CB, no: { x: 232, y: 663.9 } as CB };

const RegistrationFormDocuSign = ({ prefill, onBack, onSigned }: Props) => {
  const fullName = [prefill.firstName, prefill.middleName, prefill.lastName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdfReady, setPdfReady] = useState(false);
  const [renderScale, setRenderScale] = useState(1);

  const [q1v, setQ1v] = useState<"yes" | "no" | "">("");
  const [q2v, setQ2v] = useState<"lt_500" | "500_2000" | "gt_2000" | "">("");
  const [q3v, setQ3v] = useState("");
  const [q4v, setQ4v] = useState<"yes" | "no" | "">("");
  const [q5v, setQ5v] = useState("");
  const [q6v, setQ6v] = useState<"yes" | "no" | "">("");
  const [q6cc, setQ6cc] = useState("");
  const [q7v, setQ7v] = useState<"commuting" | "recreation" | "other" | "">("");
  const [q7other, setQ7other] = useState("");
  const [q8v, setQ8v] = useState<"yes" | "no" | "">("");
  const [q9v, setQ9v] = useState<"yes" | "no" | "">("");
  const [q10v, setQ10v] = useState<"yes" | "no" | "">("");
  const [q11v, setQ11v] = useState<"yes" | "no" | "">("");

  const [sig, setSig] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [adoptOpen, setAdoptOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ recordId: string; pdfPath: string | null; downloadUrl: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdf = await pdfjs.getDocument(TEMPLATE_URL).promise;
      const page = await pdf.getPage(1);
      const containerWidth = containerRef.current?.clientWidth || 800;
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = containerWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = viewport.width * ratio;
      canvas.height = viewport.height * ratio;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      await page.render({ canvasContext: ctx, viewport } as any).promise;
      if (cancelled) return;
      setRenderScale(scale);
      setPdfReady(true);
    })().catch(e => { console.error(e); toast({ title: "Could not load registration form", variant: "destructive" }); });
    return () => { cancelled = true; };
  }, []);

  const dateStr = useMemo(() => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
  }, []);

  const formatDob = () => {
    if (!prefill.dateOfBirth) return "";
    const [y, m, d] = prefill.dateOfBirth.split("-");
    return `${m}/${d}/${y.slice(2)}`;
  };
  const age = useMemo(() => {
    if (!prefill.dateOfBirth) return "";
    const d = new Date(prefill.dateOfBirth); if (isNaN(d.getTime())) return "";
    const now = new Date();
    let a = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--;
    return String(a);
  }, [prefill.dateOfBirth]);

  // Autofilled text overlays (mirrors backend stamping)
  const AF = [
    { x: 420, y: 128, w: 120, text: dateStr },
    { x: 90, y: 172, w: 140, text: prefill.firstName || "" },
    { x: 240, y: 172, w: 140, text: prefill.middleName || "" },
    { x: 400, y: 172, w: 170, text: prefill.lastName || "" },
    { x: 90, y: 204, w: 180, text: prefill.addressStreet || "" },
    { x: 280, y: 204, w: 100, text: prefill.addressCity || "" },
    { x: 390, y: 204, w: 90, text: prefill.addressState || "" },
    { x: 490, y: 204, w: 80, text: prefill.addressZip || "" },
    { x: 107, y: 236, w: 100, text: formatDob() },
    { x: 236, y: 236, w: 30, text: age },
    { x: 434, y: 258, w: 140, text: prefill.phone || "" },
    { x: 67, y: 280, w: 255, text: prefill.email || "" },
  ];
  // ID row stamping - row y based on id_type
  const idRowY: Record<string, number> = {
    drivers_license: 324, permit: 324, state_id: 344, foreign_license: 364, passport: 384, other: 384,
  };
  const idY = idRowY[prefill.idType] ?? 324;
  const idAF = [
    { x: 250, y: idY, w: 150, text: prefill.idNumber || "" },
    { x: 410, y: idY, w: 60, text: prefill.idState || prefill.idCountry || "" },
    { x: 495, y: idY, w: 70, text: prefill.idExpiration || "" },
  ];

  const cbStyle = (c: CB): React.CSSProperties => ({
    position: "absolute",
    left: (c.x - 1) * renderScale,
    top: (c.y - 5) * renderScale,
    width: (CB_SIZE + 4) * renderScale,
    height: (CB_SIZE + 4) * renderScale,
  });

  const Checkbox = ({ c, checked, onClick }: { c: CB; checked: boolean; onClick: () => void }) => (
    <div style={cbStyle(c)} onClick={onClick}
      className={`cursor-pointer flex items-center justify-center rounded ${
        checked ? "bg-accent/80 text-white" : "bg-yellow-200/70 border border-yellow-600 border-dashed hover:bg-yellow-300"
      }`}>
      {checked ? <span className="text-xs font-black leading-none">✓</span> : null}
    </div>
  );

  // Inline text inputs overlaid on the PDF blank lines (optional).
  // Coordinates use the same top-left origin as checkboxes (yTop from pdfplumber).
  type BlankPos = { x: number; y: number; w: number };
  const inlineBlanks: Array<{ pos: BlankPos; value: string; onChange: (v: string) => void; placeholder?: string }> = [
    { pos: { x: 230, y: 491, w: 60 }, value: q3v, onChange: setQ3v, placeholder: "years" },       // Q3 __ years
    { pos: { x: 350, y: 527, w: 90 }, value: q5v, onChange: setQ5v, placeholder: "miles" },        // Q5 __ miles
    { pos: { x: 486, y: 539, w: 45 }, value: q6cc, onChange: setQ6cc, placeholder: "cc" },         // Q6 cc size
    { pos: { x: 200, y: 575, w: 240 }, value: q7other, onChange: setQ7other, placeholder: "other" }, // Q7 other
  ];

  const allAnswered = q1v && q2v && q4v && q6v && q7v && (q7v !== "other" || q7other) && q8v && q9v && q10v && q11v;
  const canSubmit = allAnswered && sig;

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
        signature_typed: typed || fullName,
        signature_drawn: sig,
        consent_acknowledgments: [
          { key: "truthful", label: "Answers are true and complete", accepted: true },
          { key: "id_match", label: "ID at check-in will match name on this form", accepted: true },
          { key: "esign", label: "Consent to sign electronically (ESIGN Act / UETA)", accepted: true },
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

  const answered = [q1v, q2v, q3v, q4v, q5v, q6v, q7v, q8v, q9v, q10v, q11v].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4 md:p-6">
        <div className="flex items-center gap-2 mb-2">
          <FileSignature className="w-5 h-5 text-accent" />
          <h2 className="text-lg md:text-xl font-bold text-foreground">CMSP Student Registration Form</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Blue fields are auto-filled from your registration. Tap the yellow{" "}
          <span className="font-semibold text-yellow-700">Yes/No</span> checkboxes to answer the 11 questions,
          fill any short text answers below, then adopt your signature.
        </p>
      </div>

      <div className="sticky top-0 z-20 bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className={`w-4 h-4 ${allAnswered ? "text-accent" : "text-muted-foreground"}`} />
          <span className="font-medium">{answered}/11 answered · {sig ? "signed" : "not signed"}</span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onBack}>← Back</Button>
          <Button type="button" variant="hero" size="sm" onClick={() => setAdoptOpen(true)} disabled={!allAnswered}>
            {sig ? "Re-sign" : "Adopt Signature"}
          </Button>
          <Button type="button" variant="hero" size="sm" onClick={submit} disabled={!canSubmit || submitting}>
            {submitting ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving…</> : "Finish"}
          </Button>
        </div>
      </div>

      <div ref={containerRef} className="relative rounded-lg border border-border bg-white overflow-hidden" style={{ maxWidth: 900, margin: "0 auto" }}>
        <canvas ref={canvasRef} />
        {pdfReady && (
          <>
            {AF.concat(idAF).map((f, i) => f.text && (
              <div key={"af" + i} className="absolute text-blue-800 bg-blue-50/70 border border-blue-200 rounded px-1 overflow-hidden"
                style={{ left: f.x * renderScale, top: f.y * renderScale, width: f.w * renderScale, fontSize: `${Math.max(8, 9 * renderScale)}px`, lineHeight: 1.1 }}>
                {f.text}
              </div>
            ))}
            {/* Sex checkboxes at y=250.9 */}
            <Checkbox c={{ x: 289, y: 250 }} checked={prefill.sex === "M"} onClick={() => { }} />
            <Checkbox c={{ x: 322, y: 250 }} checked={prefill.sex === "F"} onClick={() => { }} />
            {/* ID type row checkbox at x=36 */}
            <Checkbox c={{ x: 36, y: idY }} checked={true} onClick={() => { }} />
            {/* Q1 */}
            <Checkbox c={q1.yes} checked={q1v === "yes"} onClick={() => setQ1v("yes")} />
            <Checkbox c={q1.no} checked={q1v === "no"} onClick={() => setQ1v("no")} />
            {/* Q2 */}
            <Checkbox c={q2.lt_500} checked={q2v === "lt_500"} onClick={() => setQ2v("lt_500")} />
            <Checkbox c={q2["500_2000"]} checked={q2v === "500_2000"} onClick={() => setQ2v("500_2000")} />
            <Checkbox c={q2.gt_2000} checked={q2v === "gt_2000"} onClick={() => setQ2v("gt_2000")} />
            {/* Q4 */}
            <Checkbox c={q4.yes} checked={q4v === "yes"} onClick={() => setQ4v("yes")} />
            <Checkbox c={q4.no} checked={q4v === "no"} onClick={() => setQ4v("no")} />
            {/* Q6 */}
            <Checkbox c={q6.yes} checked={q6v === "yes"} onClick={() => setQ6v("yes")} />
            <Checkbox c={q6.no} checked={q6v === "no"} onClick={() => setQ6v("no")} />
            {/* Q7 */}
            <Checkbox c={q7.commuting} checked={q7v === "commuting"} onClick={() => setQ7v("commuting")} />
            <Checkbox c={q7.recreation} checked={q7v === "recreation"} onClick={() => setQ7v("recreation")} />
            <Checkbox c={q7.other} checked={q7v === "other"} onClick={() => setQ7v("other")} />
            {/* Q8 */}
            <Checkbox c={q8.yes} checked={q8v === "yes"} onClick={() => setQ8v("yes")} />
            <Checkbox c={q8.no} checked={q8v === "no"} onClick={() => setQ8v("no")} />
            {/* Q9 */}
            <Checkbox c={q9.yes} checked={q9v === "yes"} onClick={() => setQ9v("yes")} />
            <Checkbox c={q9.no} checked={q9v === "no"} onClick={() => setQ9v("no")} />
            {/* Q10 */}
            <Checkbox c={q10.yes} checked={q10v === "yes"} onClick={() => setQ10v("yes")} />
            <Checkbox c={q10.no} checked={q10v === "no"} onClick={() => setQ10v("no")} />
            {/* Q11 */}
            <Checkbox c={q11.yes} checked={q11v === "yes"} onClick={() => setQ11v("yes")} />
            <Checkbox c={q11.no} checked={q11v === "no"} onClick={() => setQ11v("no")} />
            {/* Inline typeable blanks (optional) */}
            {inlineBlanks.map((b, i) => (
              <input
                key={"blank" + i}
                value={b.value}
                onChange={e => b.onChange(e.target.value)}
                placeholder={b.placeholder}
                className="absolute bg-yellow-100/70 border-b border-yellow-600 text-blue-900 outline-none focus:bg-yellow-200 px-1"
                style={{
                  left: b.pos.x * renderScale,
                  top: (b.pos.y - 10) * renderScale,
                  width: b.pos.w * renderScale,
                  fontSize: `${Math.max(9, 10 * renderScale)}px`,
                  lineHeight: 1.1,
                }}
              />
            ))}
          </>
        )}
        {!pdfReady && (
          <div className="p-10 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading document…
          </div>
        )}
      </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <label className="flex flex-col gap-1">
            Q3. Years riding a street motorcycle:
            <input value={q3v} onChange={e => setQ3v(e.target.value)}
              className="px-3 py-2 rounded-md border border-border bg-background" placeholder="e.g. 0" />
          </label>
          <label className="flex flex-col gap-1">
            Q5. Miles on-street in past year:
            <input value={q5v} onChange={e => setQ5v(e.target.value)}
              className="px-3 py-2 rounded-md border border-border bg-background" placeholder="e.g. 0" />
          </label>
          {q6v === "yes" && (
            <label className="flex flex-col gap-1">
              Q6. If yes, engine size (cc):
              <input value={q6cc} onChange={e => setQ6cc(e.target.value)}
                className="px-3 py-2 rounded-md border border-border bg-background" placeholder="e.g. 250" />
            </label>
          )}
          {q7v === "other" && (
            <label className="flex flex-col gap-1">
              Q7. Other primary reason:
              <input value={q7other} onChange={e => setQ7other(e.target.value)}
                className="px-3 py-2 rounded-md border border-border bg-background" placeholder="describe" />
            </label>
          )}
        </div>
      </div>

      {sig && (
        <div className="bg-accent/5 border border-accent/40 rounded-xl p-4 flex items-center gap-3">
          <img src={sig} alt="signature" className="h-12 bg-white border border-border rounded" />
          <div className="text-sm">
            <div className="font-semibold text-foreground">Adopted signature ({typed || fullName})</div>
            <div className="text-muted-foreground">Signed on {dateStr}</div>
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
    </div>
  );
};

export default RegistrationFormDocuSign;

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

// PDF Question 9 "How did you hear about this course?" — 12 options + Other explain
const HEAR_OPTIONS = [
  "Friend", "Tradeshow", "Catalog", "School", "Online Search", "DMV",
  "Dealer", "Insurance", "Courts", "Magazine", "CMSP website", "Brochure",
] as const;
type HearOpt = typeof HEAR_OPTIONS[number];
const HEAR_POS: Record<HearOpt, CB> = {
  "Friend":         { x: 48,  y: 597 },
  "Tradeshow":      { x: 108, y: 597 },
  "Catalog":        { x: 175, y: 597 },
  "School":         { x: 240, y: 597 },
  "Online Search":  { x: 305, y: 597 },
  "DMV":            { x: 385, y: 597 },
  "Dealer":         { x: 48,  y: 611 },
  "Insurance":      { x: 108, y: 611 },
  "Courts":         { x: 175, y: 611 },
  "Magazine":       { x: 240, y: 611 },
  "CMSP website":   { x: 305, y: 611 },
  "Brochure":       { x: 385, y: 611 },
};
const HEAR_OTHER_BLANK = { x: 130, y: 625.5, w: 220 };

const DEFAULT_OFFSETS: Record<string, { dx: number; dy: number }> = {
  af_first: { dx: -31, dy: -6 },
  af_middle: { dx: -1, dy: -6 },
  af_last: { dx: -1, dy: -6 },
  af_street: { dx: -3, dy: -3 },
  af_city: { dx: 1, dy: -5 },
  af_state: { dx: 4, dy: -3 },
  af_zip: { dx: 1, dy: -5 },
  af_idNumber: { dx: -70, dy: -5 },
  af_idState: { dx: -79, dy: -4 },
  af_idExp: { dx: 7, dy: -4 },
  blank_q3: { dx: -3, dy: 6 },
  blank_q5: { dx: 10, dy: 2 },
  blank_q6cc: { dx: 7, dy: 4 },
  blank_q7other: { dx: 0, dy: 6 },
  blank_hearOther: { dx: -36, dy: 9 },
  hear_Dealer: { dx: -20, dy: 12 },
  hear_Friend: { dx: -20, dy: 18 },
  hear_Insurance: { dx: -2, dy: 12 },
  hear_Tradeshow: { dx: -1, dy: 19 },
  hear_Courts: { dx: 5, dy: 12 },
  hear_Catalog: { dx: 3, dy: 19 },
  hear_Magazine: { dx: 15, dy: 13 },
  hear_School: { dx: 15, dy: 19 },
  hear_CMSP_website: { dx: 31, dy: 16 },
  hear_Online_Search: { dx: 31, dy: 21 },
  hear_Brochure: { dx: 64, dy: 15 },
  hear_DMV: { dx: 64, dy: 21 },
};

const RegistrationFormDocuSign = ({ prefill, onBack, onSigned }: Props) => {
  const fullName = [prefill.firstName, prefill.middleName, prefill.lastName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdfReady, setPdfReady] = useState(false);
  const [renderScale, setRenderScale] = useState(1);
  const calibrate = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("calibrate") === "1";
  const [offsets, setOffsets] = useState<Record<string, { dx: number; dy: number }>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("regFormOffsets") || "{}");
      return { ...DEFAULT_OFFSETS, ...saved };
    } catch { return { ...DEFAULT_OFFSETS }; }
  });
  const dragRef = useRef<{ key: string; startX: number; startY: number; baseDx: number; baseDy: number } | null>(null);
  const applyOffset = (key: string, x: number, y: number) => {
    const o = offsets[key] || { dx: 0, dy: 0 };
    return { x: x + o.dx / renderScale, y: y + o.dy / renderScale };
  };
  const onOverlayMouseDown = (key: string) => (e: React.MouseEvent) => {
    if (!calibrate) return;
    e.preventDefault(); e.stopPropagation();
    const o = offsets[key] || { dx: 0, dy: 0 };
    dragRef.current = { key, startX: e.clientX, startY: e.clientY, baseDx: o.dx, baseDy: o.dy };
    const move = (ev: MouseEvent) => {
      const d = dragRef.current; if (!d) return;
      const dx = d.baseDx + (ev.clientX - d.startX);
      const dy = d.baseDy + (ev.clientY - d.startY);
      setOffsets(prev => ({ ...prev, [d.key]: { dx, dy } }));
    };
    const up = () => { dragRef.current = null; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  };


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
  const guardianFullName = [prefill.guardianFirstName, prefill.guardianLastName].filter(Boolean).join(" ").trim();
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
  const AF: Array<{ k: string; x: number; y: number; w: number; text: string }> = [
    { k: "date", x: 420, y: 142.9, w: 120, text: dateStr },
    { k: "first", x: 90, y: 186.1, w: 140, text: prefill.firstName || "" },
    { k: "middle", x: 240, y: 186.1, w: 140, text: prefill.middleName || "" },
    { k: "last", x: 400, y: 186.1, w: 170, text: prefill.lastName || "" },
    { k: "street", x: 90, y: 218.5, w: 180, text: prefill.addressStreet || "" },
    { k: "city", x: 280, y: 218.5, w: 100, text: prefill.addressCity || "" },
    { k: "state", x: 390, y: 218.5, w: 90, text: prefill.addressState || "" },
    { k: "zip", x: 490, y: 218.5, w: 80, text: prefill.addressZip || "" },
    { k: "dob", x: 107, y: 250.9, w: 100, text: formatDob() },
    { k: "age", x: 236, y: 250.9, w: 30, text: age },
    { k: "phone", x: 434, y: 272.5, w: 140, text: prefill.phone || "" },
    { k: "email", x: 67, y: 294.1, w: 255, text: prefill.email || "" },
  ];
  // ID row stamping - row y based on id_type (verified against the template's actual label positions)
  const idRowY: Record<string, number> = {
    drivers_license: 338.1, permit: 338.1, state_id: 358.1, foreign_license: 378.1, passport: 398.1, other: 398.1,
  };
  const idY = idRowY[prefill.idType] ?? 338.1;
  const idAF: Array<{ k: string; x: number; y: number; w: number; text: string }> = [
    { k: "idNumber", x: 250, y: idY, w: 150, text: prefill.idNumber || "" },
    { k: "idState", x: 410, y: idY, w: 60, text: prefill.idState || prefill.idCountry || "" },
    { k: "idExp", x: 495, y: idY, w: 70, text: prefill.idExpiration || "" },
  ];

  const cbStyle = (c: CB, key: string): React.CSSProperties => {
    const o = offsets[key] || { dx: 0, dy: 0 };
    return {
      position: "absolute",
      left: (c.x - 1) * renderScale + o.dx,
      top: (c.y - 5) * renderScale + o.dy,
      width: (CB_SIZE + 4) * renderScale,
      height: (CB_SIZE + 4) * renderScale,
      cursor: calibrate ? "move" : "pointer",
    };
  };

  const Checkbox = ({ c, checked, onClick, k }: { c: CB; checked: boolean; onClick: () => void; k?: string }) => {
    const key = k || `cb_${c.x}_${c.y}`;
    return (
      <div style={cbStyle(c, key)}
        onMouseDown={onOverlayMouseDown(key)}
        onClick={calibrate ? undefined : onClick}
        className={`flex items-center justify-center rounded ${
          checked ? "bg-accent/80 text-white" : "bg-yellow-200/70 border border-yellow-600 border-dashed hover:bg-yellow-300"
        } ${calibrate ? "ring-2 ring-pink-500" : ""}`}>
        {checked ? <span className="text-xs font-black leading-none">✓</span> : null}
      </div>
    );
  };

  // Inline text inputs overlaid on the PDF blank lines (optional).
  // Coordinates use the same top-left origin as checkboxes (yTop from pdfplumber).
  type BlankPos = { x: number; y: number; w: number };
  const inlineBlanks: Array<{ pos: BlankPos; value: string; onChange: (v: string) => void; placeholder?: string }> = [
    { pos: { x: 180, y: 491.7, w: 35 }, value: q3v, onChange: setQ3v, placeholder: "years" },        // Q3 __ years
    { pos: { x: 290, y: 527.7, w: 68 }, value: q5v, onChange: setQ5v, placeholder: "miles" },        // Q5 __ miles
    { pos: { x: 380, y: 539.7, w: 50 }, value: q6cc, onChange: setQ6cc, placeholder: "cc" },         // Q6 cc size
    { pos: { x: 195, y: 563.7, w: 145 }, value: q7other, onChange: setQ7other, placeholder: "other" }, // Q7 other
    { pos: HEAR_OTHER_BLANK, value: hearOther, onChange: setHearOther, placeholder: "other" }, // Q9 Other explain
  ];

  const allAnswered = q1v && q2v && q4v && q6v && q7v && (q7v !== "other" || q7other) && q8v && q9v && q10v && q11v;
  const canSubmit = allAnswered && sig && (!prefill.isMinor || guardianSig);


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

      {calibrate && (
        <div className="sticky top-16 z-30 bg-pink-100 border-2 border-pink-500 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="font-bold text-pink-900">CALIBRATE MODE</span>
          <span className="text-pink-800">Drag the pink-outlined fields into place, then click Copy Layout and paste it to me.</span>
          <Button type="button" size="sm" variant="outline" onClick={() => {
            localStorage.setItem("regFormOffsets", JSON.stringify(offsets));
            const pdfOffsets: Record<string, { dx: number; dy: number }> = {};
            for (const [k, v] of Object.entries(offsets)) {
              pdfOffsets[k] = { dx: Math.round((v.dx / renderScale) * 10) / 10, dy: Math.round((v.dy / renderScale) * 10) / 10 };
            }
            const payload = { scale: renderScale, screenPixelOffsets: offsets, pdfPointOffsets: pdfOffsets };
            navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
            toast({ title: "Layout copied", description: "Offsets + scale copied to clipboard and saved locally." });
          }}>Copy Layout</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => {
            setOffsets({ ...DEFAULT_OFFSETS }); localStorage.removeItem("regFormOffsets");
          }}>Reset</Button>
          <span className="text-xs text-pink-700">Scale: {renderScale.toFixed(3)}</span>
        </div>
      )}

      <div ref={containerRef} className="relative rounded-lg border border-border bg-white overflow-hidden" style={{ maxWidth: 900, margin: "0 auto" }}>
        <canvas ref={canvasRef} />
        {pdfReady && (
          <>
            {AF.concat(idAF).map((f) => f.text && (
              <div key={"af_" + f.k}
                onMouseDown={onOverlayMouseDown("af_" + f.k)}
                className={`absolute text-blue-800 bg-blue-50/70 border border-blue-200 rounded px-1 overflow-hidden ${calibrate ? "ring-2 ring-pink-500 cursor-move" : ""}`}
                style={{
                  left: f.x * renderScale + (offsets["af_" + f.k]?.dx || 0),
                  top: f.y * renderScale + (offsets["af_" + f.k]?.dy || 0),
                  width: f.w * renderScale,
                  fontSize: `${Math.max(8, 9 * renderScale)}px`,
                  lineHeight: 1.1,
                }}>
                {f.text}
              </div>
            ))}
            {/* Sex checkboxes at y=250.9 */}
            <Checkbox k="sexM" c={{ x: 289, y: 250.9 }} checked={prefill.sex === "M"} onClick={() => { }} />
            <Checkbox k="sexF" c={{ x: 322, y: 250.9 }} checked={prefill.sex === "F"} onClick={() => { }} />
            {/* ID type row checkbox at x=36 */}
            <Checkbox k="idRow" c={{ x: 36, y: idY }} checked={true} onClick={() => { }} />
            {/* Q1 */}
            <Checkbox k="q1y" c={q1.yes} checked={q1v === "yes"} onClick={() => setQ1v("yes")} />
            <Checkbox k="q1n" c={q1.no} checked={q1v === "no"} onClick={() => setQ1v("no")} />
            {/* Q2 */}
            <Checkbox k="q2a" c={q2.lt_500} checked={q2v === "lt_500"} onClick={() => setQ2v("lt_500")} />
            <Checkbox k="q2b" c={q2["500_2000"]} checked={q2v === "500_2000"} onClick={() => setQ2v("500_2000")} />
            <Checkbox k="q2c" c={q2.gt_2000} checked={q2v === "gt_2000"} onClick={() => setQ2v("gt_2000")} />
            {/* Q4 */}
            <Checkbox k="q4y" c={q4.yes} checked={q4v === "yes"} onClick={() => setQ4v("yes")} />
            <Checkbox k="q4n" c={q4.no} checked={q4v === "no"} onClick={() => setQ4v("no")} />
            {/* Q6 */}
            <Checkbox k="q6y" c={q6.yes} checked={q6v === "yes"} onClick={() => setQ6v("yes")} />
            <Checkbox k="q6n" c={q6.no} checked={q6v === "no"} onClick={() => setQ6v("no")} />
            {/* Q7 */}
            <Checkbox k="q7c" c={q7.commuting} checked={q7v === "commuting"} onClick={() => setQ7v("commuting")} />
            <Checkbox k="q7r" c={q7.recreation} checked={q7v === "recreation"} onClick={() => setQ7v("recreation")} />
            <Checkbox k="q7o" c={q7.other} checked={q7v === "other"} onClick={() => setQ7v("other")} />
            {/* Q8 */}
            <Checkbox k="q8y" c={q8.yes} checked={q8v === "yes"} onClick={() => setQ8v("yes")} />
            <Checkbox k="q8n" c={q8.no} checked={q8v === "no"} onClick={() => setQ8v("no")} />
            {/* Q9 */}
            <Checkbox k="q9y" c={q9.yes} checked={q9v === "yes"} onClick={() => setQ9v("yes")} />
            <Checkbox k="q9n" c={q9.no} checked={q9v === "no"} onClick={() => setQ9v("no")} />
            {/* Q10 */}
            <Checkbox k="q10y" c={q10.yes} checked={q10v === "yes"} onClick={() => setQ10v("yes")} />
            <Checkbox k="q10n" c={q10.no} checked={q10v === "no"} onClick={() => setQ10v("no")} />
            {/* Q11 */}
            <Checkbox k="q11y" c={q11.yes} checked={q11v === "yes"} onClick={() => setQ11v("yes")} />
            <Checkbox k="q11n" c={q11.no} checked={q11v === "no"} onClick={() => setQ11v("no")} />
            {/* PDF Q9 "How did you hear about this course?" — multi-select */}
            {HEAR_OPTIONS.map((opt) => (
              <Checkbox
                key={"hear_" + opt}
                k={"hear_" + opt.replace(/\s+/g, "_")}
                c={HEAR_POS[opt]}
                checked={!!hearSel[opt]}
                onClick={() => toggleHear(opt)}
              />
            ))}
            {/* Inline typeable blanks (optional) */}
            {inlineBlanks.map((b, i) => {
              const key = "blank_" + ["q3","q5","q6cc","q7other","hearOther"][i];
              const o = offsets[key] || { dx: 0, dy: 0 };
              return (
                <div key={key} className="absolute" style={{
                  left: b.pos.x * renderScale + o.dx,
                  top: (b.pos.y - 10) * renderScale + o.dy,
                  width: b.pos.w * renderScale,
                }}>
                  {calibrate && (
                    <div onMouseDown={onOverlayMouseDown(key)}
                      className="absolute -left-4 top-0 w-4 h-full bg-pink-500 cursor-move rounded-l" title="drag" />
                  )}
                  <input
                    value={b.value}
                    onChange={e => b.onChange(e.target.value)}
                    placeholder={b.placeholder}
                    disabled={calibrate}
                    className={`w-full bg-yellow-100/70 border-b border-yellow-600 text-blue-900 outline-none focus:bg-yellow-200 px-1 ${calibrate ? "ring-2 ring-pink-500" : ""}`}
                    style={{
                      fontSize: `${Math.max(9, 10 * renderScale)}px`,
                      lineHeight: 1.1,
                    }}
                  />
                </div>
              );
            })}
          </>
        )}
        {!pdfReady && (
          <div className="p-10 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading document…
          </div>
        )}
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

      {prefill.isMinor && (
        <div className="bg-card border-2 border-accent/40 rounded-2xl p-4 md:p-6 space-y-3">
          <div className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-accent" />
            <h3 className="font-bold text-foreground">Parent / Legal Guardian Signature</h3>
            <span className="text-xs font-semibold uppercase tracking-wide bg-accent/15 text-accent px-2 py-0.5 rounded">Required — Minor</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Because the student is under 18, a parent or legal guardian must also sign this Registration Form on the minor's behalf.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Guardian name: </span><span className="font-medium">{guardianFullName || "—"}</span></div>
            <div><span className="text-muted-foreground">Relationship: </span><span className="font-medium">{prefill.guardianRelationship || "—"}</span></div>
          </div>
          {guardianSig ? (
            <div className="bg-accent/5 border border-accent/40 rounded-xl p-4 flex items-center gap-3">
              <img src={guardianSig} alt="guardian signature" className="h-12 bg-white border border-border rounded" />
              <div className="text-sm flex-1">
                <div className="font-semibold text-foreground">Guardian signature ({guardianTyped || guardianFullName})</div>
                <div className="text-muted-foreground">Signed on {dateStr}</div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setGuardianAdoptOpen(true)}>Re-sign</Button>
            </div>
          ) : (
            <Button type="button" variant="hero" size="sm" onClick={() => setGuardianAdoptOpen(true)}>
              Adopt Guardian Signature
            </Button>
          )}
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

import { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
// @ts-ignore - vite worker import
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Camera, CheckCircle2, ShieldCheck, CameraOff } from "lucide-react";
import type { ModelReleasePrefill } from "./ModelReleaseStep";
import { CMSP_MODEL_RELEASE_TEXT, CMSP_MODEL_RELEASE_VERSION } from "./ModelReleaseStep";
import WaiverSignedDialog from "./WaiverSignedDialog";
import { SharedDocuSignPad } from "./docusign/SharedDocuSignPad";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

const TEMPLATE_URL = "/cmsp-model-release.pdf";
const PAGE_H = 792;

// Signature tag positions (yTop measured on template with pdfplumber)
type SigTag = { id: "student" | "guardian"; xPdf: number; yTopPdf: number; wPdf: number; hPdf: number };
const STUDENT_TAG: SigTag = { id: "student", xPdf: 84, yTopPdf: 432, wPdf: 223, hPdf: 20 };
const GUARDIAN_TAG: SigTag = { id: "guardian", xPdf: 86, yTopPdf: 565, wPdf: 223, hPdf: 20 };

interface Props {
  prefill: ModelReleasePrefill;
  onBack: () => void;
  onComplete: (recordId: string, decision: "sign" | "decline") => void;
}

const ModelReleaseDocuSign = ({ prefill, onBack, onComplete }: Props) => {
  const fullName = [prefill.firstName, prefill.middleName, prefill.lastName]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const guardianFullName = [prefill.guardianFirstName, prefill.guardianLastName].filter(Boolean).join(" ").trim();

  const [decision, setDecision] = useState<"sign" | "decline" | null>(null);
  const [bikeModel, setBikeModel] = useState("");
  const [helmetColor, setHelmetColor] = useState("");
  const [jacketColor, setJacketColor] = useState("");
  const [pantsColor, setPantsColor] = useState("");

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [renderScale, setRenderScale] = useState(1);
  const [pdfReady, setPdfReady] = useState(false);

  const [studentSig, setStudentSig] = useState<string | null>(null);
  const [studentTyped, setStudentTyped] = useState("");
  const [guardianSig, setGuardianSig] = useState<string | null>(null);
  const [guardianTyped, setGuardianTyped] = useState("");
  const [adoptOpen, setAdoptOpen] = useState<null | "student" | "guardian">(null);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ recordId: string; pdfPath: string | null; downloadUrl: string | null; decision: "sign" | "decline" } | null>(null);

  // Render PDF once decision made
  useEffect(() => {
    if (!decision) return;
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
    })().catch(e => { console.error(e); toast({ title: "Could not load release document", variant: "destructive" }); });
    return () => { cancelled = true; };
  }, [decision]);

  const requiredSigs: SigTag[] = prefill.isMinor ? [STUDENT_TAG, GUARDIAN_TAG] : [STUDENT_TAG];
  const doneSigs = [studentSig && "student", prefill.isMinor && guardianSig && "guardian"].filter(Boolean).length;
  const allSigned = studentSig && (!prefill.isMinor || guardianSig);

  const dateStr = useMemo(() => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
  }, []);

  const addressLine = [prefill.addressStreet].filter(Boolean).join(", ");

  const submit = async () => {
    if (!allSigned) return;
    setSubmitting(true);
    try {
      const body: any = {
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
        guardian_phone: prefill.isMinor ? (prefill.guardianPhone || null) : null,
        guardian_email: prefill.isMinor ? (prefill.guardianEmail || null) : null,
        bike_model: decision === "sign" ? (bikeModel || null) : null,
        helmet_color: decision === "sign" ? (helmetColor || null) : null,
        jacket_color: decision === "sign" ? (jacketColor || null) : null,
        pants_color: decision === "sign" ? (pantsColor || null) : null,
        course: prefill.course || null,
        location: prefill.location || null,
        location_label: prefill.locationLabel || null,
        schedule_id: prefill.scheduleId || null,
        schedule_date: prefill.scheduleDate || null,
        document_version: CMSP_MODEL_RELEASE_VERSION,
        document_text: CMSP_MODEL_RELEASE_TEXT,
        decision,
        signature_typed: studentTyped || fullName,
        signature_drawn: studentSig,
        guardian_signature_typed: prefill.isMinor ? (guardianTyped || guardianFullName) : null,
        guardian_signature_drawn: prefill.isMinor ? guardianSig : null,
        consent_acknowledgments: decision === "sign" ? [
          { key: "rights", label: "Grants permission for use of images", accepted: true },
          { key: "esign", label: "Consent to sign electronically (ESIGN Act / UETA)", accepted: true },
        ] : null,
        decline_acknowledgments: decision === "decline" ? [
          { key: "decline", label: "DECLINES permission to be photographed/videoed", accepted: true },
          { key: "esign", label: "Consent to sign electronically (ESIGN Act / UETA)", accepted: true },
        ] : null,
      };
      const { data, error } = await supabase.functions.invoke("record-model-release", { body });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult({
        recordId: (data as any).record_id,
        pdfPath: (data as any).pdf_path || null,
        downloadUrl: (data as any).download_url || null,
        decision: decision!,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to record model release";
      toast({ title: "Could not save", description: msg, variant: "destructive" });
      setSubmitting(false);
    }
  };

  const tagStyle = (t: SigTag): React.CSSProperties => ({
    position: "absolute",
    left: t.xPdf * renderScale,
    top: t.yTopPdf * renderScale,
    width: t.wPdf * renderScale,
    height: t.hPdf * renderScale,
  });

  // Autofilled overlay label positions (mirrors backend stamping)
  const AF: { x: number; y: number; w: number; text: string }[] = [
    { x: 86, y: 398, w: 220, text: fullName },
    { x: 446, y: 398, w: 92, text: prefill.dateOfBirth || "" },
    { x: 446, y: 434, w: 92, text: dateStr },
    { x: 86, y: 469, w: 320, text: addressLine },
    { x: 446, y: 469, w: 152, text: prefill.phone || "" },
    { x: 86, y: 506, w: 145, text: prefill.addressCity || "" },
    { x: 234, y: 506, w: 100, text: prefill.addressState || "" },
    { x: 342, y: 506, w: 65, text: prefill.addressZip || "" },
    { x: 446, y: 506, w: 152, text: prefill.email || "" },
  ];
  const GAF: { x: number; y: number; w: number; text: string }[] = prefill.isMinor ? [
    { x: 449, y: 568, w: 92, text: dateStr },
    { x: 86, y: 604, w: 320, text: addressLine },
    { x: 446, y: 604, w: 152, text: prefill.guardianPhone || prefill.phone || "" },
    { x: 86, y: 640, w: 145, text: prefill.addressCity || "" },
    { x: 234, y: 640, w: 100, text: prefill.addressState || "" },
    { x: 342, y: 640, w: 65, text: prefill.addressZip || "" },
    { x: 446, y: 640, w: 152, text: prefill.guardianEmail || prefill.email || "" },
  ] : [];

  if (result) {
    return (
      <WaiverSignedDialog
        open
        onOpenChange={() => onComplete(result.recordId, result.decision)}
        title={result.decision === "sign" ? "Model Release Signed" : "Model Release Declined"}
        description={result.decision === "sign"
          ? "Your permission has been recorded. A copy is attached to your registration."
          : "Your declination has been recorded. Staff will not photograph you on class day."}
        downloadUrl={result.downloadUrl}
      />
    );
  }

  if (!decision) {
    return (
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <Camera className="w-5 h-5 text-accent shrink-0" />
            <h2 className="text-xl font-bold text-foreground">CMSP Model Release</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            We sometimes take photos and video during the CMSP Course. Choose whether to grant
            permission or decline. Either way you can complete your registration.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button type="button" onClick={() => setDecision("sign")}
            className="text-left bg-card hover:bg-accent/5 border-2 border-border hover:border-accent rounded-2xl p-6 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-accent/15 text-accent flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-foreground">Sign the Release</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              I grant Learn to Ride VC permission to take and use photos / video of me during the course.
            </p>
          </button>
          <button type="button" onClick={() => setDecision("decline")}
            className="text-left bg-card hover:bg-destructive/5 border-2 border-border hover:border-destructive rounded-2xl p-6 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-destructive/15 text-destructive flex items-center justify-center">
                <CameraOff className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-foreground">Decline</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              I do NOT want my photo or video taken and do not consent to any use of my likeness.
            </p>
          </button>
        </div>
        <div><Button type="button" variant="outline" onClick={onBack}>← Back</Button></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4 md:p-6">
        <div className="flex items-center gap-2 mb-2">
          {decision === "sign" ? <Camera className="w-5 h-5 text-accent" /> : <CameraOff className="w-5 h-5 text-destructive" />}
          <h2 className="text-lg md:text-xl font-bold text-foreground">
            {decision === "sign" ? "Sign the Model Release" : "Decline the Model Release"}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Your personal information is pre-filled on the form below. Click the highlighted{" "}
          <span className="font-semibold text-accent">Sign</span> tag{prefill.isMinor ? "s" : ""} to adopt your signature.
          {decision === "decline" && " A large DECLINED watermark will be stamped on the saved copy."}
        </p>
      </div>

      {decision === "sign" && (
        <div className="bg-card border border-border rounded-2xl p-4 md:p-6">
          <h3 className="font-semibold mb-3 text-sm">
            Visual Reference (helps staff identify you on class day — optional)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input placeholder="Bike model" value={bikeModel} onChange={e => setBikeModel(e.target.value)} className="px-3 py-2 rounded-md border border-border bg-background text-sm" />
            <input placeholder="Helmet color" value={helmetColor} onChange={e => setHelmetColor(e.target.value)} className="px-3 py-2 rounded-md border border-border bg-background text-sm" />
            <input placeholder="Jacket color" value={jacketColor} onChange={e => setJacketColor(e.target.value)} className="px-3 py-2 rounded-md border border-border bg-background text-sm" />
            <input placeholder="Pants color" value={pantsColor} onChange={e => setPantsColor(e.target.value)} className="px-3 py-2 rounded-md border border-border bg-background text-sm" />
          </div>
        </div>
      )}

      <div className="sticky top-0 z-20 bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className={`w-4 h-4 ${allSigned ? "text-accent" : "text-muted-foreground"}`} />
          <span className="font-medium">{doneSigs} / {requiredSigs.length} signature{requiredSigs.length > 1 ? "s" : ""} complete</span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => { setDecision(null); setStudentSig(null); setGuardianSig(null); }}>Change decision</Button>
          <Button type="button" variant="hero" size="sm" disabled={!allSigned || submitting} onClick={submit}>
            {submitting ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving…</> : "Finish and Save"}
          </Button>
        </div>
      </div>

      <div ref={containerRef} className="relative rounded-lg border border-border bg-white overflow-hidden" style={{ maxWidth: 900, margin: "0 auto" }}>
        <canvas ref={canvasRef} />
        {pdfReady && (
          <>
            {decision === "decline" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-destructive/40 font-black tracking-widest rotate-[-25deg] text-6xl md:text-7xl select-none">
                  DECLINED
                </div>
              </div>
            )}
            {/* Auto-filled overlays */}
            {AF.concat(GAF).map((f, i) => f.text && (
              <div key={i} className="absolute text-[10px] text-blue-800 bg-blue-50/70 border border-blue-200 rounded px-1 overflow-hidden"
                style={{ left: f.x * renderScale, top: f.y * renderScale, width: f.w * renderScale, fontSize: `${Math.max(9, 10 * renderScale)}px`, lineHeight: 1.2 }}
                title="Auto-filled from your registration">
                {f.text}
              </div>
            ))}
            {/* Signature tags */}
            {requiredSigs.map(t => {
              const sig = t.id === "student" ? studentSig : guardianSig;
              return (
                <div key={t.id} id={`mr-tag-${t.id}`} style={tagStyle(t)}
                  className={`cursor-pointer flex items-center justify-center rounded ${
                    sig ? "bg-white border border-accent/60" : "bg-yellow-200/80 hover:bg-yellow-300 border-2 border-dashed border-yellow-600 animate-pulse"
                  }`}
                  onClick={() => setAdoptOpen(t.id)}>
                  {sig ? (
                    <img src={sig} alt="signature" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-[10px] font-bold text-yellow-900 uppercase">
                      {t.id === "guardian" ? "Guardian: Sign" : "Sign here"}
                    </span>
                  )}
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

      <div className="text-xs text-muted-foreground text-center">
        Blue-highlighted fields were auto-filled from your registration and will be stamped on the saved copy.
      </div>

      <Dialog open={!!adoptOpen} onOpenChange={(o) => !o && setAdoptOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Adopt {adoptOpen === "guardian" ? "guardian" : "your"} signature</DialogTitle>
          </DialogHeader>
          {adoptOpen && (
            <SharedDocuSignPad
              mode="signature"
              defaultTyped={adoptOpen === "guardian" ? guardianFullName : fullName}
              prompt={`This signature will be applied to the ${adoptOpen === "guardian" ? "guardian" : "signer"} block. Legally binding under ESIGN / UETA.`}
              onCancel={() => setAdoptOpen(null)}
              onSave={(url, typed) => {
                if (adoptOpen === "guardian") { setGuardianSig(url); setGuardianTyped(typed); }
                else { setStudentSig(url); setStudentTyped(typed); }
                setAdoptOpen(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ModelReleaseDocuSign;

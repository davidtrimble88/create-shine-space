import { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
// @ts-ignore - vite worker import
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldCheck, Eraser, PenLine, CheckCircle2 } from "lucide-react";
import type { WaiverPrefill } from "./WaiverStep";
import { CMSP_WAIVER_TEXT, CMSP_WAIVER_VERSION } from "./WaiverStep";
import WaiverSignedDialog from "./WaiverSignedDialog";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

const TEMPLATE_URL = "/cmsp-waiver-template.pdf";
const PAGE_H = 792; // PDF user units
const PAGE_W = 612;

// PDF-coord (top-down y) tag positions — must mirror record-waiver/index.ts
type Tag =
  | { id: string; kind: "initial"; xPdf: number; yTopPdf: number; wPdf: number; hPdf: number }
  | { id: string; kind: "signature"; xPdf: number; yTopPdf: number; wPdf: number; hPdf: number };

// Tag boxes are anchored so their bottom sits on each underline.
// yTop here is the top edge of the clickable box.
const TAGS: Tag[] = [
  // Top section initials (5) — underline y=158.9, 203.9, 284.9, 320.9, 347.9
  { id: "i1", kind: "initial", xPdf: 31, yTopPdf: 147, wPdf: 42, hPdf: 22 },
  { id: "i2", kind: "initial", xPdf: 31, yTopPdf: 192, wPdf: 42, hPdf: 22 },
  { id: "i3", kind: "initial", xPdf: 31, yTopPdf: 273, wPdf: 42, hPdf: 22 },
  { id: "i4", kind: "initial", xPdf: 31, yTopPdf: 309, wPdf: 42, hPdf: 22 },
  { id: "i5", kind: "initial", xPdf: 31, yTopPdf: 336, wPdf: 42, hPdf: 22 },
  // Participant signature row 1 — underline y=419.9, x 360→572
  { id: "s1", kind: "signature", xPdf: 360, yTopPdf: 401, wPdf: 212, hPdf: 30 },
  // Bottom section initials (4) — underline y=500.9, 545.9, 581.9, 644.9
  { id: "i6", kind: "initial", xPdf: 31, yTopPdf: 489, wPdf: 42, hPdf: 22 },
  { id: "i7", kind: "initial", xPdf: 31, yTopPdf: 534, wPdf: 42, hPdf: 22 },
  { id: "i8", kind: "initial", xPdf: 31, yTopPdf: 570, wPdf: 42, hPdf: 22 },
  { id: "i9", kind: "initial", xPdf: 31, yTopPdf: 633, wPdf: 42, hPdf: 22 },
  // Participant signature row 2 — underline y=680.9
  { id: "s2", kind: "signature", xPdf: 360, yTopPdf: 662, wPdf: 212, hPdf: 30 },
];

// Read-only prefilled fields. Coordinates measured from the actual template
// (underline y_top from pdfplumber). Text baselines are drawn just above each
// underline to mirror what record-waiver/index.ts stamps onto the saved PDF.
type PrefillField = { x: number; yTop: number; w: number };
const PREFILL_POSITIONS: { name: PrefillField; license: PrefillField; date: PrefillField; phone?: PrefillField }[] = [
  // Row 1 — top half
  {
    name:    { x: 38,  yTop: 419.9, w: 196 },
    license: { x: 238, yTop: 419.9, w: 104 },
    date:    { x: 38,  yTop: 446.9, w: 90  },
  },
  // Row 2 — bottom half
  {
    name:    { x: 38,  yTop: 680.9, w: 196 },
    license: { x: 238, yTop: 680.9, w: 104 },
    date:    { x: 38,  yTop: 707.9, w: 90  },
    phone:   { x: 467, yTop: 735.7, w: 105 },
  },
];

interface Props {
  prefill: WaiverPrefill;
  onBack: () => void;
  onSigned: (waiverId: string) => void;
}

const SignaturePad = ({
  onSave,
  onCancel,
  prompt,
  defaultTyped,
  mode,
}: {
  onSave: (dataUrl: string, typed: string) => void;
  onCancel: () => void;
  prompt: string;
  defaultTyped: string;
  mode: "signature" | "initial";
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [tab, setTab] = useState<"draw" | "type">("draw");
  const [typed, setTyped] = useState(defaultTyped);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = mode === "initial" ? 3 : 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0a2540";
  }, [tab, mode]);

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
  const up = () => { drawing.current = false; };
  const clear = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    dirty.current = false;
  };

  const buildTypedDataUrl = (text: string) => {
    const w = mode === "initial" ? 200 : 520;
    const h = mode === "initial" ? 90 : 110;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#0a2540";
    ctx.font = `${mode === "initial" ? 56 : 44}px "Brush Script MT", "Lucida Handwriting", cursive`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(text || "", w / 2, h / 2);
    return c.toDataURL("image/png");
  };

  const handleSave = () => {
    if (tab === "draw") {
      if (!dirty.current) {
        toast({ title: "Please draw your " + mode, variant: "destructive" });
        return;
      }
      onSave(canvasRef.current!.toDataURL("image/png"), typed || defaultTyped);
    } else {
      const t = typed.trim();
      if (!t) { toast({ title: "Type your " + mode, variant: "destructive" }); return; }
      onSave(buildTypedDataUrl(t), t);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{prompt}</p>
      <div className="flex gap-2 border-b border-border">
        {(["draw", "type"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t ? "border-accent text-accent" : "border-transparent text-muted-foreground"
            }`}
          >
            {t === "draw" ? "Draw" : "Type"}
          </button>
        ))}
      </div>

      {tab === "draw" ? (
        <div className="rounded-lg border-2 border-dashed border-border bg-white relative">
          <canvas
            ref={canvasRef}
            className={`w-full ${mode === "initial" ? "h-32" : "h-40"} touch-none rounded-lg`}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          />
          <button
            type="button"
            onClick={clear}
            className="absolute top-2 right-2 text-xs text-muted-foreground hover:text-foreground bg-background/90 rounded px-2 py-1 flex items-center gap-1 border border-border"
          >
            <Eraser className="w-3 h-3" /> Clear
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={defaultTyped}
            className="text-2xl"
            style={{ fontFamily: '"Brush Script MT", "Lucida Handwriting", cursive' }}
          />
          <p className="text-xs text-muted-foreground">
            Preview will be rendered in a script-style font and stamped onto the document.
          </p>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="button" variant="hero" onClick={handleSave}>
          Adopt and Sign
        </Button>
      </DialogFooter>
    </div>
  );
};

const WaiverDocuSign = ({ prefill, onBack, onSigned }: Props) => {
  const isMinor = !!prefill.isMinor;
  const guardianFullName = isMinor
    ? `${prefill.guardianFirstName || ""} ${prefill.guardianLastName || ""}`.trim()
    : "";
  const guardianInitials = isMinor
    ? `${(prefill.guardianFirstName?.[0] || "").toUpperCase()}${(prefill.guardianLastName?.[0] || "").toUpperCase()}`
    : "";
  const studentFullName = [prefill.firstName, prefill.middleName, prefill.lastName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const studentInitials = `${(prefill.firstName[0] || "").toUpperCase()}${(prefill.middleName?.[0] || "").toUpperCase()}${(prefill.lastName[0] || "").toUpperCase()}`;
  // For minors, the parent/guardian is the legal signer of the waiver.
  const fullName = isMinor ? guardianFullName : studentFullName;
  const defaultInitials = isMinor ? guardianInitials : studentInitials;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [renderScale, setRenderScale] = useState(1);
  const [pdfReady, setPdfReady] = useState(false);

  const [signatureImg, setSignatureImg] = useState<string | null>(null);
  const [signatureTyped, setSignatureTyped] = useState<string>("");
  const [initialsImg, setInitialsImg] = useState<string | null>(null);
  const [initialsTyped, setInitialsTyped] = useState<string>(defaultInitials);

  const [stamped, setStamped] = useState<Record<string, true>>({});
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [adoptOpen, setAdoptOpen] = useState<null | "signature" | "initial">(null);
  const [submitting, setSubmitting] = useState(false);
  const [signedResult, setSignedResult] = useState<{ waiverId: string; pdfPath: string | null } | null>(null);

  // Render the PDF page once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loadingTask = pdfjs.getDocument(TEMPLATE_URL);
      const pdf = await loadingTask.promise;
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
    })().catch((e) => {
      console.error(e);
      toast({ title: "Could not load waiver document", variant: "destructive" });
    });
    return () => { cancelled = true; };
  }, []);

  const requiredCount = TAGS.length;
  const stampedCount = Object.keys(stamped).length;
  const allStamped = stampedCount === requiredCount;

  const nextUnstamped = useMemo(() => TAGS.find(t => !stamped[t.id]) || null, [stamped]);

  const handleTagClick = (tag: Tag) => {
    if (stamped[tag.id]) return;
    if (tag.kind === "initial" && !initialsImg) {
      setActiveTagId(tag.id);
      setAdoptOpen("initial");
      return;
    }
    if (tag.kind === "signature" && !signatureImg) {
      setActiveTagId(tag.id);
      setAdoptOpen("signature");
      return;
    }
    setStamped(prev => ({ ...prev, [tag.id]: true }));
  };

  const handleAdopt = (dataUrl: string, typed: string) => {
    if (adoptOpen === "signature") {
      setSignatureImg(dataUrl);
      setSignatureTyped(typed || fullName);
    } else if (adoptOpen === "initial") {
      setInitialsImg(dataUrl);
      setInitialsTyped((typed || defaultInitials).toUpperCase().slice(0, 4));
    }
    if (activeTagId) {
      setStamped(prev => ({ ...prev, [activeTagId]: true }));
    }
    setActiveTagId(null);
    setAdoptOpen(null);
  };

  const handleFinish = async () => {
    if (!allStamped || !signatureImg || !initialsImg) return;
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
          is_minor: isMinor,
          guardian_name: isMinor ? guardianFullName : null,
          guardian_relationship: isMinor ? (prefill.guardianRelationship || null) : null,
          guardian_signature_typed: isMinor ? (signatureTyped || guardianFullName) : null,
          guardian_signature_drawn: isMinor ? signatureImg : null,
          guardian_license_number: isMinor ? (prefill.guardianLicenseNumber || null) : null,
          guardian_license_state: isMinor ? (prefill.guardianLicenseState || null) : null,
          signature_typed: signatureTyped || fullName,
          signature_drawn: signatureImg,
          initials: initialsTyped,
          consent_acknowledgments: TAGS.filter(t => t.kind === "initial").map((t, i) => ({
            key: `initial_${i + 1}`,
            label: `Initialed clause ${i + 1}`,
            initials: initialsTyped,
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
      onSigned((data as any).waiver_id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to record waiver";
      toast({ title: "Could not sign waiver", description: msg, variant: "destructive" });
      setSubmitting(false);
    }
  };

  // Convert PDF (top-down) coords to overlay px coords using current scale
  const tagStyle = (tag: Tag): React.CSSProperties => ({
    position: "absolute",
    left: tag.xPdf * renderScale,
    top: tag.yTopPdf * renderScale,
    width: tag.wPdf * renderScale,
    height: tag.hPdf * renderScale,
  });

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4 md:p-6">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-5 h-5 text-accent" />
          <h2 className="text-lg md:text-xl font-bold text-foreground">
            {isMinor ? "Parent / Guardian: Sign the CMSP Course Waiver" : "Sign Your CMSP Course Waiver"}
          </h2>
        </div>
        {isMinor && (
          <div className="mb-3 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs">
            Because <span className="font-semibold text-foreground">{studentFullName || "the student"}</span> is under 18,
            this waiver must be signed by their parent or legal guardian
            {guardianFullName ? <> — <span className="font-semibold text-foreground">{guardianFullName}</span> ({prefill.guardianRelationship})</> : null}.
            Your initials and signature below are stamped on the minor's behalf.
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          Click each highlighted <span className="font-semibold text-accent">Initial</span> or{" "}
          <span className="font-semibold text-accent">Sign</span> tag on the document. The first time you
          click, you'll adopt your signature/initials — after that they'll stamp instantly. This is
          legally binding under the federal ESIGN Act and California UETA.
        </p>
      </div>

      {/* Status bar */}
      <div className="sticky top-0 z-20 bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className={`w-4 h-4 ${allStamped ? "text-accent" : "text-muted-foreground"}`} />
            <span className="font-medium">{stampedCount} / {requiredCount} fields completed</span>
          </div>
          {nextUnstamped && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const el = document.getElementById(`tag-${nextUnstamped.id}`);
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
                el?.classList.add("ring-4", "ring-accent");
                setTimeout(() => el?.classList.remove("ring-4", "ring-accent"), 1200);
              }}
            >
              Next required field →
            </Button>
          )}
        </div>
        <Button
          type="button"
          variant="hero"
          size="sm"
          disabled={!allStamped || submitting}
          onClick={handleFinish}
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</>
          ) : (
            "Finish & Continue to Payment"
          )}
        </Button>
      </div>

      {/* Document with overlays */}
      <div className="bg-muted/30 border border-border rounded-2xl p-4 overflow-x-auto">
        <div ref={containerRef} className="mx-auto" style={{ maxWidth: 900 }}>
          <div className="relative inline-block bg-white shadow-lg" style={{ lineHeight: 0 }}>
            <canvas ref={canvasRef} />
            {!pdfReady && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading document…
              </div>
            )}

            {pdfReady && (() => {
              const today = new Date();
              const dateStr = `${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}/${today.getFullYear()}`;
              const idDisplay = prefill.licenseNumber
                ? `${prefill.licenseNumber}${prefill.licenseState ? " / " + prefill.licenseState : ""}`
                : "";
              const prefillText = (
                f: PrefillField,
                value: string,
                key: string,
              ) => value ? (
                <div
                  key={key}
                  className="absolute text-black pointer-events-none"
                  style={{
                    left: f.x * renderScale,
                    top: (f.yTop - 5) * renderScale,
                    width: f.w * renderScale,
                    fontSize: 9 * renderScale,
                    fontFamily: "Helvetica, Arial, sans-serif",
                    lineHeight: 1,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                  }}
                >
                  {value}
                </div>
              ) : null;
              const providerLines = [
                { x: 128, yTop: 158.9, w: 180, key: "prov-top" },
                { x: 128, yTop: 500.9, w: 185, key: "prov-bot" },
              ];
              return [
                ...providerLines.map(p =>
                  prefillText({ x: p.x, yTop: p.yTop, w: p.w }, "Learn To Ride VC", p.key)
                ),
                ...PREFILL_POSITIONS.flatMap((row, idx) => [
                  prefillText(row.name, studentFullName, `name-${idx}`),
                  prefillText(row.license, idDisplay, `lic-${idx}`),
                  prefillText(row.date, dateStr, `date-${idx}`),
                  row.phone ? prefillText(row.phone, prefill.phone || "", `phone-${idx}`) : null,
                ]),
              ];
            })()}

            {pdfReady && TAGS.map(tag => {
              const done = !!stamped[tag.id];
              const img = tag.kind === "initial" ? initialsImg : signatureImg;
              return (
                <button
                  key={tag.id}
                  id={`tag-${tag.id}`}
                  type="button"
                  onClick={() => handleTagClick(tag)}
                  style={tagStyle(tag)}
                  className={`group transition-all flex items-center justify-center ${
                    done
                      ? "bg-transparent"
                      : "bg-accent/30 hover:bg-accent/50 border-2 border-dashed border-accent rounded-sm cursor-pointer animate-pulse"
                  }`}
                  title={done ? "Signed" : tag.kind === "initial" ? "Click to initial" : "Click to sign"}
                >
                  {done && img ? (
                    <img
                      src={img}
                      alt={tag.kind}
                      style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center bottom" }}
                    />
                  ) : (
                    <span className="text-[10px] md:text-xs font-bold text-accent-foreground uppercase tracking-wide flex items-center gap-1 px-1">
                      <PenLine className="w-3 h-3" />
                      {tag.kind === "initial" ? "Initial" : "Sign"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>
          ← Back to information
        </Button>
        {!allStamped && (
          <p className="text-xs text-muted-foreground">
            Complete all {requiredCount} signature fields to continue.
          </p>
        )}
      </div>

      <Dialog open={adoptOpen !== null} onOpenChange={(o) => !o && setAdoptOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {adoptOpen === "signature"
                ? (isMinor ? "Adopt parent / guardian signature" : "Adopt your signature")
                : (isMinor ? "Adopt parent / guardian initials" : "Adopt your initials")}
            </DialogTitle>
          </DialogHeader>
          {adoptOpen && (
            <SignaturePad
              mode={adoptOpen}
              prompt={
                adoptOpen === "signature"
                  ? (isMinor
                      ? `Parent / legal guardian: draw or type your full legal signature. It will be stamped on every signature line on behalf of the minor (${studentFullName}).`
                      : "Draw or type your full legal signature. Once adopted it will be applied to all signature fields.")
                  : (isMinor
                      ? "Parent / legal guardian: draw or type your initials. They will be applied to every initial field on behalf of the minor."
                      : "Draw or type your initials. Once adopted they will be applied to all initial fields.")
              }
              defaultTyped={adoptOpen === "signature" ? fullName : defaultInitials}
              onCancel={() => { setAdoptOpen(null); setActiveTagId(null); }}
              onSave={handleAdopt}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WaiverDocuSign;

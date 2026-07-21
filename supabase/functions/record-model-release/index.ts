// Records a CMSP Model Release decision (SIGN or DECLINE).
// - SIGN: hashes the doc, captures IP/UA, fills the official CMSP Model
//   Release PDF template (loaded from storage) with the model's data,
//   appends a clean "Completed Release" page and an "Electronic Signature
//   Audit Trail" page, stores the resulting PDF privately, and inserts an
//   append-only audit row in signed_waivers with
//   document_type = 'cmsp_model_release'.
// - DECLINE: generates a one-page "Model Release — DECLINED" PDF that
//   memorializes the participant's refusal, stores it privately, and inserts
//   an audit row with document_type = 'cmsp_model_release_decline'. The
//   participant's likeness MUST NOT be used in any media.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEMPLATE_PATH = "cmsp_model_release_2015.pdf";

const BaseSchema = z.object({
  first_name: z.string().min(1),
  middle_name: z.string().optional().nullable(),
  last_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  address_street: z.string().optional().nullable(),
  address_city: z.string().optional().nullable(),
  address_state: z.string().optional().nullable(),
  address_zip: z.string().optional().nullable(),
  is_minor: z.boolean(),
  guardian_name: z.string().optional().nullable(),
  guardian_relationship: z.string().optional().nullable(),
  guardian_address: z.string().optional().nullable(),
  guardian_city: z.string().optional().nullable(),
  guardian_state: z.string().optional().nullable(),
  guardian_zip: z.string().optional().nullable(),
  guardian_phone: z.string().optional().nullable(),
  guardian_email: z.string().optional().nullable(),

  bike_model: z.string().optional().nullable(),
  helmet_color: z.string().optional().nullable(),
  jacket_color: z.string().optional().nullable(),
  pants_color: z.string().optional().nullable(),
  course: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  location_label: z.string().optional().nullable(),
  schedule_id: z.string().uuid().optional().nullable(),
  schedule_date: z.string().optional().nullable(),
  document_version: z.string().min(1),
  document_text: z.string().min(50),
});

const OffsetSchema = z.record(z.string(), z.object({ dx: z.number(), dy: z.number() }));

const SignSchema = BaseSchema.extend({
  decision: z.literal("sign"),
  signature_typed: z.string().min(1),
  signature_drawn: z.string().min(50),
  guardian_signature_typed: z.string().optional().nullable(),
  guardian_signature_drawn: z.string().optional().nullable(),
  consent_acknowledgments: z.array(z.object({
    key: z.string(), label: z.string(), accepted: z.literal(true),
  })),
  render_scale: z.number().positive().optional().nullable(),
  offsets: OffsetSchema.optional().nullable(),
});

const DeclineSchema = BaseSchema.extend({
  decision: z.literal("decline"),
  signature_typed: z.string().min(1),
  signature_drawn: z.string().min(50),
  decline_acknowledgments: z.array(z.object({
    key: z.string(), label: z.string(), accepted: z.literal(true),
  })),
  render_scale: z.number().positive().optional().nullable(),
  offsets: OffsetSchema.optional().nullable(),
});

const BodySchema = z.discriminatedUnion("decision", [SignSchema, DeclineSchema]);

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  const m = dataUrl.match(/^data:image\/(png|jpeg);base64,(.+)$/);
  if (!m) return null;
  const bin = atob(m[2]);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return { bytes: out, mime: m[1] };
}

async function embedSig(pdf: PDFDocument, page: any, dataUrl: string, x: number, y: number, maxW = 220, maxH = 50) {
  const parsed = dataUrlToBytes(dataUrl);
  if (!parsed) return;
  const img = parsed.mime === "png" ? await pdf.embedPng(parsed.bytes) : await pdf.embedJpg(parsed.bytes);
  const s = Math.min(maxW / img.width, maxH / img.height);
  page.drawImage(img, { x, y, width: img.width * s, height: img.height * s });
}

type SignData = z.infer<typeof SignSchema>;
type DeclineData = z.infer<typeof DeclineSchema>;
type AnyData = z.infer<typeof BodySchema>;

// Stamp a text value on the CMSP Model Release template's page 0 using yTop
// (measured from top of a 792-tall page).
function stampText(page: any, font: any, text: string, x: number, yTop: number, size = 10, maxW?: number, offset?: { dx: number; dy: number }) {
  if (!text) return;
  let t = text;
  if (maxW) {
    while (font.widthOfTextAtSize(t, size) > maxW && t.length > 1) t = t.slice(0, -1);
  }
  const dx = offset?.dx || 0;
  const dy = offset?.dy || 0;
  page.drawText(t, { x: x + dx, y: 792 - yTop + 2 + dy, size, font, color: rgb(0, 0, 0) });
}

function getOffset(offsets: Record<string, { dx: number; dy: number }> | null | undefined, key: string, scale?: number | null): { dx: number; dy: number } {
  if (!offsets || !offsets[key]) return { dx: 0, dy: 0 };
  const o = offsets[key];
  if (!scale) return o;
  return { dx: o.dx / scale, dy: o.dy / scale };
}

async function stampReleaseTemplate(
  pdf: PDFDocument, font: any, data: AnyData, meta: { signedAt: string },
) {
  const pages = pdf.getPages();
  const p0 = pages[0];
  const fullName = [data.first_name, data.middle_name || "", data.last_name]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const today = new Date(meta.signedAt);
  const dateStr = `${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}/${today.getFullYear()}`;
  const addr = data.address_street || "";
  const scale = data.render_scale || null;
  const offsets = data.offsets || {};

  // Student block
  stampText(p0, font, fullName, 86, 414.6, 10, 220, getOffset(offsets, "af_fullName", scale));
  stampText(p0, font, data.date_of_birth || "", 446, 414.6, 10, 92, getOffset(offsets, "af_dob", scale));
  stampText(p0, font, dateStr, 446, 449.4, 10, 92, getOffset(offsets, "af_date", scale));
  stampText(p0, font, addr, 86, 485.1, 10, 320, getOffset(offsets, "af_address", scale));
  stampText(p0, font, data.phone || "", 446, 487.1, 10, 152, getOffset(offsets, "af_phone", scale));
  stampText(p0, font, data.address_city || "", 86, 522.6, 10, 145, getOffset(offsets, "af_city", scale));
  stampText(p0, font, data.address_state || "", 234, 522.6, 10, 100, getOffset(offsets, "af_state", scale));
  stampText(p0, font, data.address_zip || "", 342, 522.6, 10, 65, getOffset(offsets, "af_zip", scale));
  stampText(p0, font, data.email, 446, 522.6, 10, 152, getOffset(offsets, "af_email", scale));

  const drawnSig = data.decision === "sign" ? data.signature_drawn : data.signature_drawn;
  if (drawnSig) {
    const parsed = dataUrlToBytes(drawnSig);
    if (parsed) {
      const img = parsed.mime === "png" ? await pdf.embedPng(parsed.bytes) : await pdf.embedJpg(parsed.bytes);
      const maxW = 220, maxH = 26;
      const s = Math.min(maxW / img.width, maxH / img.height);
      const tagOff = getOffset(offsets, "tag_student", scale);
      p0.drawImage(img, { x: 86 + tagOff.dx, y: 792 - 450.4 + tagOff.dy, width: img.width * s, height: img.height * s });
    }
  }

  if (data.is_minor) {
    stampText(p0, font, dateStr, 449, 583.9, 10, 92, getOffset(offsets, "gaf_date", scale));
    stampText(p0, font, addr, 86, 620.4, 10, 320, getOffset(offsets, "gaf_address", scale));
    stampText(p0, font, data.guardian_phone || data.phone || "", 446, 618.4, 10, 152, getOffset(offsets, "gaf_phone", scale));
    stampText(p0, font, data.address_city || "", 86, 656.7, 10, 145, getOffset(offsets, "gaf_city", scale));
    stampText(p0, font, data.address_state || "", 234, 656.7, 10, 100, getOffset(offsets, "gaf_state", scale));
    stampText(p0, font, data.address_zip || "", 342, 656.7, 10, 65, getOffset(offsets, "gaf_zip", scale));
    stampText(p0, font, data.guardian_email || data.email, 446, 656.7, 10, 152, getOffset(offsets, "gaf_email", scale));
    const gDrawn = data.decision === "sign" ? data.guardian_signature_drawn : null;
    if (gDrawn) {
      const parsed = dataUrlToBytes(gDrawn);
      if (parsed) {
        const img = parsed.mime === "png" ? await pdf.embedPng(parsed.bytes) : await pdf.embedJpg(parsed.bytes);
        const maxW = 220, maxH = 26;
        const s = Math.min(maxW / img.width, maxH / img.height);
        const tagOff = getOffset(offsets, "tag_guardian", scale);
        p0.drawImage(img, { x: 86 + tagOff.dx, y: 792 - 583.9 + tagOff.dy, width: img.width * s, height: img.height * s });
      }
    }
  }

  if (data.decision === "decline") {
    // Big diagonal DECLINED watermark
    p0.drawText("DECLINED", {
      x: 90, y: 380, size: 90, font, color: rgb(0.85, 0.15, 0.15),
      rotate: { type: "degrees", angle: 22 } as any, opacity: 0.35,
    });
  }
}

async function buildSignedPdf(
  templateBytes: Uint8Array,
  data: SignData,
  meta: { ip: string; userAgent: string; signedAt: string; hash: string; recordId: string },
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(templateBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  await stampReleaseTemplate(pdf, font, data, meta);

  const fullName = [data.first_name, data.middle_name || "", data.last_name]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const today = new Date(meta.signedAt);
  const dateStr = `${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}/${today.getFullYear()}`;
  const addr = [data.address_street, data.address_city, data.address_state, data.address_zip].filter(Boolean).join(", ");

  // === Completed Release page ===
  const page = pdf.addPage([612, 792]);
  let y = 760;
  const heading = (t: string) => {
    page.drawRectangle({ x: 50, y: y - 2, width: 512, height: 16, color: rgb(0.93, 0.93, 0.93) });
    page.drawText(t, { x: 56, y: y + 2, size: 11, font: bold, color: rgb(0, 0, 0) });
    y -= 22;
  };
  const row = (label: string, value: string) => {
    if (y < 60) return;
    page.drawText(`${label}:`, { x: 60, y, size: 9, font: bold });
    const maxW = 380; let line = "";
    for (const w of String(value || "—").split(" ")) {
      const t = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(t, 9) > maxW) {
        page.drawText(line, { x: 200, y, size: 9, font });
        y -= 11; line = w;
      } else line = t;
    }
    if (line) page.drawText(line, { x: 200, y, size: 9, font });
    y -= 13;
  };

  page.drawText("CMSP Model Release — Completed", { x: 50, y, size: 14, font: bold });
  y -= 20;
  page.drawText(`Signed: ${dateStr}`, { x: 50, y, size: 10, font });
  y -= 18;

  heading("Model");
  row("Print Name", fullName);
  row("Date of Birth", data.date_of_birth || "—");
  row("Address", addr || "—");
  row("Phone", data.phone || "—");
  row("Email", data.email);

  heading("Visual Reference");
  row("Bike Model", data.bike_model || "—");
  row("Helmet Color", data.helmet_color || "—");
  row("Jacket Color", data.jacket_color || "—");
  row("Pants Color", data.pants_color || "—");

  heading("Shoot");
  row("Description", "CMSP Course");
  row("Course", data.course || "—");
  row("Location", data.location_label || data.location || "—");
  row("Date", data.schedule_date || "—");

  if (data.is_minor) {
    heading("Parent / Legal Guardian");
    row("Name", data.guardian_name || "—");
    row("Relationship", data.guardian_relationship || "—");
    row("Address", data.guardian_address || "—");
    row("Phone", data.guardian_phone || "—");
    row("Email", data.guardian_email || "—");
  }

  // Signature block
  y -= 10;
  heading("Signature");
  page.drawText("Model signature:", { x: 60, y, size: 9, font: bold });
  y -= 56;
  await embedSig(pdf, page, data.signature_drawn, 60, y + 14, 220, 50);
  page.drawLine({ start: { x: 60, y: y + 10 }, end: { x: 300, y: y + 10 }, thickness: 0.5 });
  page.drawText(`Typed: ${data.signature_typed}`, { x: 60, y, size: 9, font });
  page.drawText(`Date: ${dateStr}`, { x: 320, y: y + 30, size: 9, font });

  if (data.is_minor && data.guardian_signature_drawn) {
    y -= 30;
    page.drawText("Parent / Guardian signature:", { x: 60, y, size: 9, font: bold });
    y -= 56;
    await embedSig(pdf, page, data.guardian_signature_drawn, 60, y + 14, 220, 50);
    page.drawLine({ start: { x: 60, y: y + 10 }, end: { x: 300, y: y + 10 }, thickness: 0.5 });
    page.drawText(`Typed: ${data.guardian_signature_typed || ""}`, { x: 60, y, size: 9, font });
    page.drawText(`Date: ${dateStr}`, { x: 320, y: y + 30, size: 9, font });
  }

  // Audit
  await drawAuditPage(pdf, font, bold, data, meta, "SIGNED");
  return await pdf.save();
}

async function buildDeclinePdf(
  templateBytes: Uint8Array,
  data: DeclineData,
  meta: { ip: string; userAgent: string; signedAt: string; hash: string; recordId: string },
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(templateBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  await stampReleaseTemplate(pdf, font, data, meta);

  const page = pdf.addPage([612, 792]);
  const today = new Date(meta.signedAt);
  const dateStr = `${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}/${today.getFullYear()}`;
  const fullName = [data.first_name, data.middle_name || "", data.last_name]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

  let y = 760;
  page.drawText("CMSP Model Release — DECLINED", { x: 50, y, size: 16, font: bold, color: rgb(0.7, 0.1, 0.1) });
  y -= 26;
  const intro = [
    "The participant named below has declined to sign the CMSP Model Release.",
    "Learn to Ride VC and its photographers/filmmakers MUST NOT photograph,",
    "record, or otherwise capture this participant's likeness for any media use,",
    "and MUST NOT use any incidental image of this participant in any media.",
  ];
  for (const line of intro) { page.drawText(line, { x: 50, y, size: 11, font }); y -= 14; }
  y -= 10;

  const rows: Array<[string, string]> = [
    ["Name", fullName],
    ["Date of Birth", data.date_of_birth || "—"],
    ["Email", data.email],
    ["Phone", data.phone || "—"],
    ["Course", data.course || "—"],
    ["Location", data.location_label || data.location || "—"],
    ["Class Date", data.schedule_date || "—"],
    ["Declined On", dateStr],
  ];
  for (const [k, v] of rows) {
    page.drawText(`${k}:`, { x: 60, y, size: 10, font: bold });
    page.drawText(String(v), { x: 200, y, size: 10, font });
    y -= 14;
  }

  y -= 16;
  page.drawText("Participant attestation:", { x: 60, y, size: 10, font: bold });
  y -= 16;
  for (const a of data.decline_acknowledgments) {
    const text = `[X] ${a.label}`;
    let line = "";
    for (const w of text.split(" ")) {
      const t = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(t, 10) > 500) {
        page.drawText(line, { x: 60, y, size: 10, font });
        y -= 12; line = w;
      } else line = t;
    }
    if (line) { page.drawText(line, { x: 60, y, size: 10, font }); y -= 14; }
  }

  y -= 16;
  page.drawText("Participant signature (declining):", { x: 60, y, size: 10, font: bold });
  y -= 60;
  await embedSig(pdf, page, data.signature_drawn, 60, y + 14, 240, 56);
  page.drawLine({ start: { x: 60, y: y + 10 }, end: { x: 320, y: y + 10 }, thickness: 0.5 });
  page.drawText(`Typed: ${data.signature_typed}`, { x: 60, y, size: 10, font });
  page.drawText(`Date: ${dateStr}`, { x: 340, y: y + 30, size: 10, font });

  await drawAuditPage(pdf, font, bold, data, meta, "DECLINED");
  return await pdf.save();
}

async function drawAuditPage(
  pdf: PDFDocument, font: any, bold: any,
  data: AnyData,
  meta: { ip: string; userAgent: string; signedAt: string; hash: string; recordId: string },
  decision: "SIGNED" | "DECLINED",
) {
  const page = pdf.addPage([612, 792]);
  let y = 760;
  page.drawText(`Electronic ${decision === "SIGNED" ? "Signature" : "Decline"} Audit Trail`, {
    x: 50, y, size: 14, font: bold,
  });
  y -= 24;
  for (const line of [
    "This record documents the participant's electronic decision regarding the",
    "CMSP Model Release pursuant to the federal ESIGN Act and California UETA.",
  ]) {
    page.drawText(line, { x: 50, y, size: 10, font });
    y -= 12;
  }
  y -= 10;
  const fullName = [data.first_name, data.middle_name || "", data.last_name]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const audit: Array<[string, string]> = [
    ["Record ID", meta.recordId],
    ["Decision", decision],
    ["Recorded at", meta.signedAt],
    ["Participant", `${fullName} <${data.email}>`],
    ["Phone", data.phone || "—"],
    ["Date of birth", data.date_of_birth || "—"],
    ["Course", data.course || "—"],
    ["Location", data.location_label || "—"],
    ["Class date", data.schedule_date || "—"],
    ["IP address", meta.ip],
    ["User agent", meta.userAgent],
    ["Document version", data.document_version],
    ["Document SHA-256", meta.hash],
    ["Typed", decision === "SIGNED"
      ? (data as SignData).signature_typed
      : (data as DeclineData).signature_typed],
  ];
  for (const [k, v] of audit) {
    page.drawText(`${k}:`, { x: 50, y, size: 10, font: bold });
    const maxW = 380; let line = "";
    for (const word of String(v).split(" ")) {
      const t = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(t, 10) > maxW) {
        page.drawText(line, { x: 200, y, size: 10, font });
        y -= 12; line = word;
      } else line = t;
    }
    if (line) page.drawText(line, { x: 200, y, size: 10, font });
    y -= 14;
    if (y < 80) break;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }
  try {
    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid request", details: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = parsed.data;

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
      || req.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const signedAt = new Date().toISOString();
    const docPayload = JSON.stringify({ version: data.document_version, decision: data.decision, body: data });
    const docHash = await sha256Hex(docPayload);
    const recordId = crypto.randomUUID();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load template for both sign and decline
    let templateBytes: Uint8Array | null = null;
    let lastTplErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const tpl = await supabase.storage.from("waiver-templates").download(TEMPLATE_PATH);
      if (!tpl.error && tpl.data) {
        templateBytes = new Uint8Array(await tpl.data.arrayBuffer());
        break;
      }
      lastTplErr = tpl.error;
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
    if (!templateBytes) {
      console.error("model release template download failed", lastTplErr);
      return new Response(JSON.stringify({ error: "Model release template unavailable, please try again" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let pdfBytes: Uint8Array;
    if (data.decision === "sign") {
      pdfBytes = await buildSignedPdf(templateBytes, data, { ip, userAgent, signedAt, hash: docHash, recordId });
    } else {
      pdfBytes = await buildDeclinePdf(templateBytes, data, { ip, userAgent, signedAt, hash: docHash, recordId });
    }

    const safeName = `${data.last_name}_${data.first_name}`.replace(/[^a-z0-9_-]/gi, "");
    const folder = data.decision === "sign" ? "model-releases" : "model-releases-declined";
    const pdfPath = `${folder}/${signedAt.slice(0, 10)}/${recordId}_${safeName}.pdf`;

    const up = await supabase.storage.from("waivers").upload(pdfPath, pdfBytes, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (up.error) console.error("model release pdf upload failed", up.error);

    const signaturePayload = { typed: data.signature_typed, drawn: data.signature_drawn };

    const acks = data.decision === "sign"
      ? data.consent_acknowledgments
      : data.decline_acknowledgments;

    const { error: insErr } = await supabase.from("signed_waivers").insert({
      id: recordId,
      document_type: data.decision === "sign" ? "cmsp_model_release" : "cmsp_model_release_decline",
      document_version: data.document_version,
      document_text: docPayload,
      document_hash: docHash,
      signer_first_name: data.first_name,
      signer_middle_name: data.middle_name,
      signer_last_name: data.last_name,
      signer_email: data.email,
      signer_phone: data.phone,
      date_of_birth: data.date_of_birth || null,
      is_minor: data.is_minor,
      guardian_name: data.is_minor ? data.guardian_name : null,
      guardian_relationship: data.is_minor ? data.guardian_relationship : null,
      guardian_signature_typed: data.decision === "sign" && data.is_minor ? data.guardian_signature_typed : null,
      guardian_signature_drawn: data.decision === "sign" && data.is_minor ? data.guardian_signature_drawn : null,
      signature_typed: signaturePayload.typed,
      signature_drawn: signaturePayload.drawn,
      consent_acknowledgments: acks,
      course: data.course,
      location: data.location,
      location_label: data.location_label,
      schedule_id: data.schedule_id || null,
      schedule_date: data.schedule_date || null,
      ip_address: ip,
      user_agent: userAgent,
      pdf_path: up.error ? null : pdfPath,
      signed_at: signedAt,
    });

    if (insErr) {
      console.error("model release insert failed", insErr);
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let downloadUrl: string | null = null;
    if (!up.error) {
      const { data: signed } = await supabase.storage.from("waivers").createSignedUrl(pdfPath, 60 * 60);
      downloadUrl = signed?.signedUrl || null;
    }

    return new Response(JSON.stringify({
      record_id: recordId,
      pdf_path: pdfPath,
      download_url: downloadUrl,
      decision: data.decision,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("record-model-release error", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

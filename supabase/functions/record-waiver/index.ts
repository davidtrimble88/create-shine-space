// Records a signed waiver: hashes the document, captures IP/UA,
// generates a signed PDF, stores it privately, and inserts an
// append-only audit row. Returns the waiver_id used by the booking.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  document_version: z.string().min(1),
  document_text: z.string().min(50),
  signer_first_name: z.string().min(1),
  signer_middle_name: z.string().optional().nullable(),
  signer_last_name: z.string().min(1),
  signer_email: z.string().email(),
  signer_phone: z.string().optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  license_number: z.string().optional().nullable(),
  license_state: z.string().optional().nullable(),
  is_minor: z.boolean(),
  guardian_name: z.string().optional().nullable(),
  guardian_relationship: z.string().optional().nullable(),
  guardian_signature_typed: z.string().optional().nullable(),
  guardian_signature_drawn: z.string().optional().nullable(),
  signature_typed: z.string().min(1),
  signature_drawn: z.string().min(50), // data URL of drawn signature
  consent_acknowledgments: z.array(z.object({
    key: z.string(),
    label: z.string(),
    accepted: z.literal(true),
  })),
  course: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  location_label: z.string().optional().nullable(),
  schedule_id: z.string().uuid().optional().nullable(),
  schedule_date: z.string().optional().nullable(),
});

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  const m = dataUrl.match(/^data:image\/(png|jpeg);base64,(.+)$/);
  if (!m) return null;
  const bin = atob(m[2]);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function buildPdf(payload: z.infer<typeof BodySchema>, meta: {
  ip: string; userAgent: string; signedAt: string; hash: string; waiverId: string;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const drawWrapped = (page: any, text: string, x: number, y: number, width: number, size = 10, f = font) => {
    const words = text.split(/\s+/);
    let line = "";
    let cy = y;
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) > width) {
        page.drawText(line, { x, y: cy, size, font: f, color: rgb(0, 0, 0) });
        cy -= size + 3;
        line = w;
        if (cy < 60) return cy;
      } else {
        line = test;
      }
    }
    if (line) {
      page.drawText(line, { x, y: cy, size, font: f, color: rgb(0, 0, 0) });
      cy -= size + 3;
    }
    return cy;
  };

  let page = pdf.addPage([612, 792]);
  let y = 760;
  page.drawText("CMSP COURSE WAIVER & INDEMNIFICATION", { x: 50, y, size: 14, font: bold });
  y -= 24;
  page.drawText(`Document Version: ${payload.document_version}`, { x: 50, y, size: 9, font });
  y -= 14;

  // Document body — paginate
  const paragraphs = payload.document_text.split(/\n+/);
  for (const p of paragraphs) {
    if (y < 80) { page = pdf.addPage([612, 792]); y = 760; }
    y = drawWrapped(page, p, 50, y, 512, 10);
    y -= 6;
  }

  // Signature page
  page = pdf.addPage([612, 792]);
  y = 760;
  page.drawText("ACKNOWLEDGMENTS & SIGNATURE", { x: 50, y, size: 14, font: bold });
  y -= 22;

  for (const a of payload.consent_acknowledgments) {
    if (y < 100) { page = pdf.addPage([612, 792]); y = 760; }
    y = drawWrapped(page, `[X] ${a.label}`, 50, y, 512, 10);
    y -= 4;
  }

  y -= 10;
  page.drawText("Participant:", { x: 50, y, size: 11, font: bold });
  y -= 14;
  const fullName = [payload.signer_first_name, payload.signer_middle_name, payload.signer_last_name]
    .filter(Boolean).join(" ");
  page.drawText(fullName, { x: 50, y, size: 11, font });
  y -= 14;
  page.drawText(`Email: ${payload.signer_email}`, { x: 50, y, size: 10, font });
  y -= 12;
  if (payload.signer_phone) { page.drawText(`Phone: ${payload.signer_phone}`, { x: 50, y, size: 10, font }); y -= 12; }
  if (payload.date_of_birth) { page.drawText(`DOB: ${payload.date_of_birth}`, { x: 50, y, size: 10, font }); y -= 12; }
  if (payload.license_number) {
    page.drawText(`License/ID: ${payload.license_number}${payload.license_state ? " (" + payload.license_state + ")" : ""}`, { x: 50, y, size: 10, font });
    y -= 12;
  }

  y -= 10;
  page.drawText(`Typed signature: ${payload.signature_typed}`, { x: 50, y, size: 11, font: bold });
  y -= 18;

  // Embed drawn signature
  const sigBytes = dataUrlToBytes(payload.signature_drawn);
  if (sigBytes) {
    const img = payload.signature_drawn.includes("image/png")
      ? await pdf.embedPng(sigBytes)
      : await pdf.embedJpg(sigBytes);
    const dims = img.scale(0.35);
    page.drawText("Drawn signature:", { x: 50, y, size: 10, font });
    y -= dims.height + 4;
    page.drawImage(img, { x: 50, y, width: dims.width, height: dims.height });
    y -= 10;
  }

  if (payload.is_minor) {
    y -= 16;
    page.drawText("Parent / Legal Guardian:", { x: 50, y, size: 11, font: bold });
    y -= 14;
    page.drawText(`${payload.guardian_name ?? ""} (${payload.guardian_relationship ?? ""})`, { x: 50, y, size: 10, font });
    y -= 14;
    page.drawText(`Typed: ${payload.guardian_signature_typed ?? ""}`, { x: 50, y, size: 10, font });
    y -= 14;
    if (payload.guardian_signature_drawn) {
      const gb = dataUrlToBytes(payload.guardian_signature_drawn);
      if (gb) {
        const img = payload.guardian_signature_drawn.includes("image/png")
          ? await pdf.embedPng(gb) : await pdf.embedJpg(gb);
        const dims = img.scale(0.35);
        y -= dims.height + 2;
        page.drawImage(img, { x: 50, y, width: dims.width, height: dims.height });
      }
    }
  }

  // Audit footer
  if (y < 140) { page = pdf.addPage([612, 792]); y = 760; }
  y -= 30;
  page.drawText("Audit Trail (electronic signature record)", { x: 50, y, size: 10, font: bold });
  y -= 14;
  const audit = [
    `Waiver ID: ${meta.waiverId}`,
    `Signed at: ${meta.signedAt}`,
    `IP address: ${meta.ip}`,
    `User agent: ${meta.userAgent}`,
    `Document SHA-256: ${meta.hash}`,
    `Course: ${payload.course ?? ""} | Location: ${payload.location_label ?? ""} | Date: ${payload.schedule_date ?? ""}`,
    `Consent: Signer agreed under ESIGN Act / UETA — typed name and drawn signature constitute legal signature.`,
  ];
  for (const line of audit) {
    y = drawWrapped(page, line, 50, y, 512, 9);
  }

  return await pdf.save();
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

    const hashInput = `${data.document_version}::${data.document_text}`;
    const docHash = await sha256Hex(hashInput);

    const waiverId = crypto.randomUUID();
    const pdfBytes = await buildPdf(data, { ip, userAgent, signedAt, hash: docHash, waiverId });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const safeName = `${data.signer_last_name}_${data.signer_first_name}`.replace(/[^a-z0-9_-]/gi, "");
    const pdfPath = `${signedAt.slice(0, 10)}/${waiverId}_${safeName}.pdf`;

    const up = await supabase.storage.from("waivers").upload(pdfPath, pdfBytes, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (up.error) {
      console.error("waiver pdf upload failed", up.error);
    }

    const { error: insErr } = await supabase.from("signed_waivers").insert({
      id: waiverId,
      document_type: "cmsp_waiver",
      document_version: data.document_version,
      document_text: data.document_text,
      document_hash: docHash,
      signer_first_name: data.signer_first_name,
      signer_middle_name: data.signer_middle_name,
      signer_last_name: data.signer_last_name,
      signer_email: data.signer_email,
      signer_phone: data.signer_phone,
      date_of_birth: data.date_of_birth || null,
      license_number: data.license_number,
      license_state: data.license_state,
      is_minor: data.is_minor,
      guardian_name: data.guardian_name,
      guardian_relationship: data.guardian_relationship,
      guardian_signature_typed: data.guardian_signature_typed,
      guardian_signature_drawn: data.guardian_signature_drawn,
      signature_typed: data.signature_typed,
      signature_drawn: data.signature_drawn,
      consent_acknowledgments: data.consent_acknowledgments,
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
      console.error("waiver insert failed", insErr);
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ waiver_id: waiverId, pdf_path: pdfPath }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("record-waiver error", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Records a signed waiver: hashes the doc, captures IP/UA, fills the OFFICIAL
// CMSP waiver PDF template (loaded from storage) with the participant's data
// + drawn signatures, stores the filled PDF privately, and inserts an
// append-only audit row. Returns the waiver_id.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEMPLATE_PATH = "cmsp_waiver_2026-02.pdf"; // in waiver-templates bucket
const PROVIDER_NAME = "Learn To Ride VC";

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
  guardian_license_number: z.string().optional().nullable(),
  guardian_license_state: z.string().optional().nullable(),
  signature_typed: z.string().min(1),
  signature_drawn: z.string().min(50),
  consent_acknowledgments: z.array(z.object({
    key: z.string(), label: z.string(), accepted: z.literal(true),
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

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  const m = dataUrl.match(/^data:image\/(png|jpeg);base64,(.+)$/);
  if (!m) return null;
  const bin = atob(m[2]);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return { bytes: out, mime: m[1] };
}

// Convert pdfplumber-style top-down y to pdf-lib bottom-up baseline,
// sitting just above the underline.
const PAGE_H = 792;
const above = (yTop: number, lift = 2) => PAGE_H - yTop + lift;

// Draw a participant signature (drawn image) anchored above an underline.
async function drawSignatureImage(
  pdf: PDFDocument, page: any, dataUrl: string,
  x: number, yTop: number, maxW: number, maxH = 24,
) {
  const parsed = dataUrlToBytes(dataUrl);
  if (!parsed) return;
  const img = parsed.mime === "png" ? await pdf.embedPng(parsed.bytes) : await pdf.embedJpg(parsed.bytes);
  let w = img.width, h = img.height;
  const scale = Math.min(maxW / w, maxH / h);
  w *= scale; h *= scale;
  // Position so bottom of image sits just above underline
  const y = PAGE_H - yTop + 1;
  page.drawImage(img, { x, y, width: w, height: h });
}

async function fillTemplate(
  templateBytes: Uint8Array,
  data: z.infer<typeof BodySchema>,
  meta: { ip: string; userAgent: string; signedAt: string; hash: string; waiverId: string },
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(templateBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.getPages()[0];

  const fullName = [
    data.signer_first_name,
    data.signer_middle_name || "",
    data.signer_last_name,
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

  const initials = (
    (data.signer_first_name[0] || "") +
    (data.signer_middle_name?.[0] || "") +
    (data.signer_last_name[0] || "")
  ).toUpperCase();

  const guardianInitials = data.is_minor && data.guardian_name
    ? data.guardian_name.trim().split(/\s+/).map(p => p[0]).join("").toUpperCase().slice(0, 4)
    : "";

  const idDisplay = data.license_number
    ? `${data.license_number}${data.license_state ? " / " + data.license_state : ""}`
    : "";
  const guardianIdDisplay = data.guardian_license_number
    ? `${data.guardian_license_number}${data.guardian_license_state ? " / " + data.guardian_license_state : ""}`
    : "";

  const today = new Date(meta.signedAt);
  const dateStr = `${String(today.getMonth()+1).padStart(2,"0")}/${String(today.getDate()).padStart(2,"0")}/${today.getFullYear()}`;

  const drawText = (text: string, x: number, yTop: number, size = 9, f = font) => {
    if (!text) return;
    page.drawText(text, { x, y: above(yTop), size, font: f, color: rgb(0, 0, 0) });
  };

  // ===== Top half — Waiver section =====
  // 5 "Initials" blanks (above line, x ~37, line y_top ~158.9, 203.9, 284.9, 320.9, 347.9)
  for (const yTop of [158.9, 203.9, 284.9, 320.9, 347.9]) {
    drawText(initials, 37, yTop, 9, bold);
  }
  // "In consideration of ___" — provider name (line at y_top 158.9, x 125.7–306.9)
  drawText(PROVIDER_NAME, 128, 158.9, 9);

  // Signature row 1 (y_top 419.9)
  drawText(fullName, 37, 419.9, 9);                    // Participant Name
  drawText(idDisplay, 238, 419.9, 9);                  // License or ID# and State
  // Drawn signature image (line x 360–572)
  drawSignatureImage(pdf, page, data.signature_drawn, 362, 419.9, 208, 22);

  // Date row 1 (y_top 446.9)
  drawText(dateStr, 37, 446.9, 9);                     // Date
  if (data.is_minor && data.guardian_signature_drawn) {
    drawSignatureImage(pdf, page, data.guardian_signature_drawn, 137, 446.9, 174, 22);
  }
  drawText(guardianIdDisplay, 326, 446.9, 9);          // Guardian License/ID
  drawText(data.is_minor ? (data.guardian_relationship || "") : "", 442, 446.9, 9);

  // ===== Bottom half — Indemnification section =====
  // 4 initials at y_top 500.9, 545.9, 581.9, 644.9
  for (const yTop of [500.9, 545.9, 581.9, 644.9]) {
    drawText(initials, 37, yTop, 9, bold);
  }
  // "In consideration of ___" line at y_top 500.9 (x 125.7–313.8)
  drawText(PROVIDER_NAME, 128, 500.9, 9);

  // Signature row 2 (y_top 680.9)
  drawText(fullName, 37, 680.9, 9);
  drawText(idDisplay, 238, 680.9, 9);
  drawSignatureImage(pdf, page, data.signature_drawn, 362, 680.9, 208, 22);

  // Date row 2 (y_top 707.9)
  drawText(dateStr, 37, 707.9, 9);
  if (data.is_minor && data.guardian_signature_drawn) {
    drawSignatureImage(pdf, page, data.guardian_signature_drawn, 137, 707.9, 174, 22);
  }
  drawText(guardianIdDisplay, 326, 707.9, 9);
  drawText(data.is_minor ? (data.guardian_relationship || "") : "", 442, 707.9, 9);

  // Phone # bottom right (y_top 736.7, x 467–571)
  drawText(data.signer_phone || "", 467, 736.7, 9);

  // ===== Add audit-trail page (separate, does not alter the original form) =====
  const auditPage = pdf.addPage([612, 792]);
  let y = 760;
  auditPage.drawText("Electronic Signature Audit Trail", { x: 50, y, size: 14, font: bold });
  y -= 24;
  auditPage.drawText(
    "This record is attached to the signed CMSP Course Waiver. It documents the",
    { x: 50, y, size: 10, font }
  );
  y -= 12;
  auditPage.drawText(
    "electronic signature pursuant to the federal ESIGN Act and California UETA.",
    { x: 50, y, size: 10, font }
  );
  y -= 22;

  const audit: Array<[string, string]> = [
    ["Waiver ID", meta.waiverId],
    ["Signed at", meta.signedAt],
    ["Signer", `${fullName} <${data.signer_email}>`],
    ["Phone", data.signer_phone || "—"],
    ["Date of birth", data.date_of_birth || "—"],
    ["License/ID", idDisplay || "—"],
    ["Course", data.course || "—"],
    ["Location", data.location_label || "—"],
    ["Class date", data.schedule_date || "—"],
    ["IP address", meta.ip],
    ["User agent", meta.userAgent],
    ["Document version", data.document_version],
    ["Document SHA-256", meta.hash],
    ["Typed signature", data.signature_typed],
    ["Initials applied", initials],
  ];
  if (data.is_minor) {
    audit.push(
      ["Minor", "Yes — guardian signature required and provided"],
      ["Guardian name", data.guardian_name || "—"],
      ["Guardian relationship", data.guardian_relationship || "—"],
      ["Guardian typed signature", data.guardian_signature_typed || "—"],
      ["Guardian License/ID", guardianIdDisplay || "—"],
    );
  }

  for (const [k, v] of audit) {
    auditPage.drawText(`${k}:`, { x: 50, y, size: 10, font: bold });
    // wrap long values
    const text = String(v);
    const maxW = 380;
    let line = "";
    let firstLine = true;
    for (const word of text.split(" ")) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, 10) > maxW) {
        auditPage.drawText(line, { x: 180, y, size: 10, font });
        y -= 12; line = word; firstLine = false;
      } else line = test;
    }
    if (line) {
      auditPage.drawText(line, { x: 180, y, size: 10, font });
    }
    y -= 14;
    if (y < 60) break;
  }

  y -= 10;
  if (y > 80) {
    auditPage.drawText("Acknowledgments accepted:", { x: 50, y, size: 10, font: bold });
    y -= 14;
    for (const a of data.consent_acknowledgments) {
      const text = `[X] ${a.label}`;
      let line = "";
      for (const word of text.split(" ")) {
        const test = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(test, 9) > 510) {
          auditPage.drawText(line, { x: 50, y, size: 9, font });
          y -= 11; line = word;
          if (y < 50) break;
        } else line = test;
      }
      if (line && y >= 50) { auditPage.drawText(line, { x: 50, y, size: 9, font }); y -= 13; }
    }
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
    const docHash = await sha256Hex(`${data.document_version}::${data.document_text}`);
    const waiverId = crypto.randomUUID();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load the official template from private storage (with retry on transient 5xx)
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
      console.error("template download failed after retries", lastTplErr);
      return new Response(JSON.stringify({ error: "Waiver template unavailable, please try again" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pdfBytes = await fillTemplate(templateBytes, data, {
      ip, userAgent, signedAt, hash: docHash, waiverId,
    });

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

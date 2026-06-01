// Records a signed CMSP Student Registration Form: hashes the doc, captures
// IP/UA, fills the OFFICIAL CMSP Student Registration Form PDF template
// (loaded from storage) with the participant's data + a drawn signature,
// appends a clean "Completed Responses" page mirroring every answer, and an
// "Electronic Signature Audit Trail" page. Stores the resulting PDF privately
// and inserts an append-only audit row in signed_waivers with
// document_type = 'cmsp_registration_form'. Returns the record id.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEMPLATE_PATH = "cmsp_registration_form_3.15.pdf";
const SITE_NAME = "Learn to Ride VC";

const ResponseSchema = z.object({
  // Personal data
  first_name: z.string().min(1),
  middle_name: z.string().optional().nullable(),
  last_name: z.string().min(1),
  email: z.string().email(),
  phone_mobile: z.string().optional().nullable(),
  phone_home: z.string().optional().nullable(),
  phone_work: z.string().optional().nullable(),
  date_of_birth: z.string().optional().nullable(), // YYYY-MM-DD
  age: z.number().int().nullable().optional(),
  sex: z.enum(["M", "F", ""]).optional().nullable(),
  address_street: z.string().optional().nullable(),
  address_city: z.string().optional().nullable(),
  address_state: z.string().optional().nullable(),
  address_zip: z.string().optional().nullable(),
  // Photo ID
  id_type: z.enum(["drivers_license", "permit", "state_id", "foreign_license", "passport", "other"]),
  id_number: z.string().min(1),
  id_state: z.string().optional().nullable(),
  id_country: z.string().optional().nullable(),
  id_expiration: z.string().optional().nullable(),
  // On-street riding experience
  q1_ridden_regularly_5yr: z.enum(["yes", "no", ""]).optional().nullable(),
  q2_experience_bucket: z.enum(["lt_500", "500_2000", "gt_2000", ""]).optional().nullable(),
  q3_years_riding: z.string().optional().nullable(),
  q4_off_road: z.enum(["yes", "no", ""]).optional().nullable(),
  q5_miles_past_year: z.string().optional().nullable(),
  q6_owns_motorcycle: z.enum(["yes", "no", ""]).optional().nullable(),
  q6_engine_cc: z.string().optional().nullable(),
  q7_primary_reason: z.enum(["commuting", "recreation", "other", ""]).optional().nullable(),
  q7_other: z.string().optional().nullable(),
  q8_prior_accident: z.enum(["yes", "no", ""]).optional().nullable(),
  q10_called_for_info: z.enum(["yes", "no", ""]).optional().nullable(),
  q11_taken_before: z.enum(["yes", "no", ""]).optional().nullable(),
  q12_cmsp_contact_future: z.enum(["yes", "no", ""]).optional().nullable(),
  // Signature + acknowledgments
  signature_typed: z.string().min(1),
  signature_drawn: z.string().min(50),
  consent_acknowledgments: z.array(z.object({
    key: z.string(), label: z.string(), accepted: z.literal(true),
  })),
  // Context
  course: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  location_label: z.string().optional().nullable(),
  schedule_id: z.string().uuid().optional().nullable(),
  schedule_date: z.string().optional().nullable(),
  document_version: z.string().min(1),
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

const ID_TYPE_LABELS: Record<string, string> = {
  drivers_license: "State Driver's License",
  permit: "Permit",
  state_id: "State Identification",
  foreign_license: "Foreign Driver's License",
  passport: "Passport",
  other: "Other Government Issued Photo ID",
};

const Q2_LABELS: Record<string, string> = {
  lt_500: "Less than 500 miles",
  "500_2000": "500 to 2000 miles",
  gt_2000: "More than 2000 miles",
};

const Q7_LABELS: Record<string, string> = {
  commuting: "Commuting",
  recreation: "Recreation",
  other: "Other",
};

async function buildPdf(
  templateBytes: Uint8Array,
  data: z.infer<typeof ResponseSchema>,
  meta: { ip: string; userAgent: string; signedAt: string; hash: string; recordId: string },
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(templateBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const fullName = [data.first_name, data.middle_name || "", data.last_name]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

  const formatDob = () => {
    if (!data.date_of_birth) return "—";
    const [y, m, d] = data.date_of_birth.split("-");
    return `${m}/${d}/${y.slice(2)}`;
  };
  const today = new Date(meta.signedAt);
  const dateStr = `${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}/${today.getFullYear()}`;

  const fullAddress = [
    data.address_street, data.address_city, data.address_state, data.address_zip,
  ].filter(Boolean).join(", ");

  const idLine = (() => {
    const parts: string[] = [];
    parts.push(`${ID_TYPE_LABELS[data.id_type] || data.id_type} #${data.id_number}`);
    if (data.id_state) parts.push(`State: ${data.id_state}`);
    if (data.id_country) parts.push(`Country: ${data.id_country}`);
    if (data.id_expiration) parts.push(`Exp: ${data.id_expiration}`);
    return parts.join("  •  ");
  })();

  // ===== Page 1: Completed Responses =====
  const page = pdf.addPage([612, 792]);
  let y = 760;
  const drawText = (text: string, x: number, size = 10, f = font) => {
    page.drawText(text, { x, y, size, font: f, color: rgb(0, 0, 0) });
  };
  const newLine = (h = 14) => { y -= h; };
  const heading = (text: string) => {
    if (y < 90) return;
    newLine(8);
    page.drawRectangle({ x: 50, y: y - 2, width: 512, height: 16, color: rgb(0.93, 0.93, 0.93) });
    page.drawText(text, { x: 56, y: y + 2, size: 11, font: bold, color: rgb(0, 0, 0) });
    newLine(20);
  };
  const row = (label: string, value: string) => {
    if (y < 60) return;
    page.drawText(`${label}:`, { x: 60, y, size: 9, font: bold });
    const wrapWidth = 380;
    const words = String(value || "—").split(" ");
    let line = "";
    let first = true;
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, 9) > wrapWidth) {
        page.drawText(line, { x: 200, y, size: 9, font });
        newLine(11);
        line = w;
        first = false;
      } else line = test;
      if (y < 60) return;
    }
    if (line) page.drawText(line, { x: 200, y, size: 9, font });
    newLine(13);
  };

  page.drawText("CMSP Student Registration Form — Completed Responses", {
    x: 50, y, size: 14, font: bold,
  });
  newLine(20);
  page.drawText(`Site: ${SITE_NAME}    Submitted: ${dateStr}`, { x: 50, y, size: 10, font });
  newLine(18);

  heading("Personal Data");
  row("Name", fullName);
  row("Address", fullAddress || "—");
  row("Date of Birth", formatDob());
  row("Age", data.age != null ? String(data.age) : "—");
  row("Sex", data.sex || "—");
  row("Email", data.email);
  row("Mobile Phone", data.phone_mobile || "—");
  row("Home Phone", data.phone_home || "—");
  row("Work Phone", data.phone_work || "—");

  heading("Government Issued Photo ID");
  row("ID", idLine);

  heading("On-Street Riding Experience");
  row("1. Ridden a street motorcycle regularly in the last 5 years?", data.q1_ridden_regularly_5yr || "—");
  row("2. Street riding experience", Q2_LABELS[data.q2_experience_bucket || ""] || "—");
  row("3. Years riding", data.q3_years_riding || "—");
  row("4. Ridden off road?", data.q4_off_road || "—");
  row("5. On-street miles past year", data.q5_miles_past_year || "—");
  row("6. Owns street motorcycle/scooter?", data.q6_owns_motorcycle === "yes"
      ? `Yes${data.q6_engine_cc ? ` (${data.q6_engine_cc}cc)` : ""}`
      : (data.q6_owns_motorcycle || "—"));
  row("7. Primary reason for riding",
      data.q7_primary_reason === "other"
        ? `Other: ${data.q7_other || ""}`.trim()
        : (Q7_LABELS[data.q7_primary_reason || ""] || "—"));
  row("8. Prior on-street motorcycle/scooter accident?", data.q8_prior_accident || "—");
  row("9. Called for Motorcyclist Training Course information?", data.q10_called_for_info || "—");
  row("10. Taken this course before?", data.q11_taken_before || "—");
  row("11. May CMSP contact you in the future?", data.q12_cmsp_contact_future || "—");

  heading("Course Enrollment");
  row("Course", data.course || "—");
  row("Location", data.location_label || data.location || "—");
  row("Class Date", data.schedule_date || "—");

  // Signature on the same page if room, else new page
  if (y < 180) {
    const np = pdf.addPage([612, 792]); y = 760;
    np.drawText("Signature", { x: 50, y, size: 14, font: bold });
    newLine(20);
    drawSignatureBlockOn(np, pdf, data, fullName, dateStr, font, bold, y);
  } else {
    newLine(10);
    heading("Signature");
    await drawSignatureBlockOnPage(page, pdf, data, fullName, dateStr, font, bold, y, (nh) => { y -= nh; });
  }

  // ===== Audit Trail Page =====
  const auditPage = pdf.addPage([612, 792]);
  let ay = 760;
  auditPage.drawText("Electronic Signature Audit Trail", { x: 50, y: ay, size: 14, font: bold });
  ay -= 24;
  for (const line of [
    "This record documents the electronic signature of the CMSP Student Registration",
    "Form pursuant to the federal ESIGN Act and California UETA.",
  ]) {
    auditPage.drawText(line, { x: 50, y: ay, size: 10, font });
    ay -= 12;
  }
  ay -= 10;

  const audit: Array<[string, string]> = [
    ["Record ID", meta.recordId],
    ["Signed at", meta.signedAt],
    ["Signer", `${fullName} <${data.email}>`],
    ["Mobile phone", data.phone_mobile || "—"],
    ["Date of birth", data.date_of_birth || "—"],
    ["ID", idLine],
    ["Course", data.course || "—"],
    ["Location", data.location_label || "—"],
    ["Class date", data.schedule_date || "—"],
    ["IP address", meta.ip],
    ["User agent", meta.userAgent],
    ["Document version", data.document_version],
    ["Document SHA-256", meta.hash],
    ["Typed signature", data.signature_typed],
  ];
  for (const [k, v] of audit) {
    auditPage.drawText(`${k}:`, { x: 50, y: ay, size: 10, font: bold });
    const maxW = 380;
    let line = "";
    for (const word of String(v).split(" ")) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, 10) > maxW) {
        auditPage.drawText(line, { x: 200, y: ay, size: 10, font });
        ay -= 12; line = word;
      } else line = test;
    }
    if (line) auditPage.drawText(line, { x: 200, y: ay, size: 10, font });
    ay -= 14;
    if (ay < 80) break;
  }

  ay -= 10;
  if (ay > 80) {
    auditPage.drawText("Acknowledgments accepted:", { x: 50, y: ay, size: 10, font: bold });
    ay -= 14;
    for (const a of data.consent_acknowledgments) {
      const text = `[X] ${a.label}`;
      let line = "";
      for (const word of text.split(" ")) {
        const test = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(test, 9) > 510) {
          auditPage.drawText(line, { x: 50, y: ay, size: 9, font });
          ay -= 11; line = word;
          if (ay < 50) break;
        } else line = test;
      }
      if (line && ay >= 50) { auditPage.drawText(line, { x: 50, y: ay, size: 9, font }); ay -= 13; }
    }
  }

  return await pdf.save();
}

async function drawSignatureBlockOnPage(
  page: any, pdf: PDFDocument,
  data: z.infer<typeof ResponseSchema>,
  fullName: string, dateStr: string, font: any, bold: any,
  startY: number, advance: (h: number) => void,
) {
  let y = startY;
  page.drawText("Participant signature", { x: 60, y, size: 9, font: bold });
  advance(60);
  const parsed = dataUrlToBytes(data.signature_drawn);
  if (parsed) {
    const img = parsed.mime === "png"
      ? await pdf.embedPng(parsed.bytes)
      : await pdf.embedJpg(parsed.bytes);
    const maxW = 220, maxH = 50;
    const scale = Math.min(maxW / img.width, maxH / img.height);
    page.drawImage(img, { x: 60, y: y + 14, width: img.width * scale, height: img.height * scale });
  }
  page.drawLine({ start: { x: 60, y: y + 10 }, end: { x: 300, y: y + 10 }, thickness: 0.5 });
  page.drawText(`Typed: ${data.signature_typed}`, { x: 60, y, size: 9, font });
  page.drawText(`Name: ${fullName}`, { x: 320, y: y + 30, size: 9, font });
  page.drawText(`Date: ${dateStr}`, { x: 320, y: y + 14, size: 9, font });
}

async function drawSignatureBlockOn(
  page: any, pdf: PDFDocument,
  data: z.infer<typeof ResponseSchema>,
  fullName: string, dateStr: string, font: any, bold: any,
  startY: number,
) {
  await drawSignatureBlockOnPage(page, pdf, data, fullName, dateStr, font, bold, startY, () => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }
  try {
    const json = await req.json();
    const parsed = ResponseSchema.safeParse(json);
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
    const docPayload = JSON.stringify({ version: data.document_version, responses: data });
    const docHash = await sha256Hex(docPayload);
    const recordId = crypto.randomUUID();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load template
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
      console.error("registration form template download failed", lastTplErr);
      return new Response(JSON.stringify({ error: "Registration form template unavailable, please try again" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pdfBytes = await buildPdf(templateBytes, data, {
      ip, userAgent, signedAt, hash: docHash, recordId,
    });

    const safeName = `${data.last_name}_${data.first_name}`.replace(/[^a-z0-9_-]/gi, "");
    const pdfPath = `registration-forms/${signedAt.slice(0, 10)}/${recordId}_${safeName}.pdf`;

    const up = await supabase.storage.from("waivers").upload(pdfPath, pdfBytes, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (up.error) {
      console.error("registration form pdf upload failed", up.error);
    }

    const { error: insErr } = await supabase.from("signed_waivers").insert({
      id: recordId,
      document_type: "cmsp_registration_form",
      document_version: data.document_version,
      document_text: docPayload,
      document_hash: docHash,
      signer_first_name: data.first_name,
      signer_middle_name: data.middle_name,
      signer_last_name: data.last_name,
      signer_email: data.email,
      signer_phone: data.phone_mobile || data.phone_home || data.phone_work || null,
      date_of_birth: data.date_of_birth || null,
      license_number: data.id_number,
      license_state: data.id_state,
      is_minor: false,
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
      console.error("registration form insert failed", insErr);
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let downloadUrl: string | null = null;
    if (!up.error) {
      const { data: signed } = await supabase.storage.from("waivers").createSignedUrl(pdfPath, 60 * 60);
      downloadUrl = signed?.signedUrl || null;
    }

    return new Response(JSON.stringify({ record_id: recordId, pdf_path: pdfPath, download_url: downloadUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("record-registration-form error", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

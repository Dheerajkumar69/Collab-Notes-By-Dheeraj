import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Models in order of preference. We try Pro first (best for handwriting + low-quality
// images), then fall back to Flash if Pro is rate-limited or unavailable.
const PRIMARY_MODEL = "google/gemini-2.5-pro";
const FALLBACK_MODEL = "google/gemini-2.5-flash";

// Robust, handwriting-tuned extraction prompt. We instruct the model to:
//  - transcribe EVERYTHING it can see (printed, cursive, math, diagrams, tables)
//  - preserve layout where meaningful (lists, equations, line breaks)
//  - use [?] for genuinely illegible characters instead of guessing wildly
//  - never refuse, never add commentary
const SYSTEM_PROMPT = `You are an elite OCR engine specialized in transcribing photographs of
handwritten notes, whiteboards, textbooks, lecture slides, receipts, and screenshots —
including messy cursive, mixed languages, math, diagrams, and low-quality phone photos.

RULES:
1. Transcribe ALL visible text, exactly as written. Do not summarize, translate, or rephrase.
2. Preserve structure: keep line breaks, bullet/number lists, headings, columns, and tables
   (use simple Markdown for tables and lists when appropriate).
3. For mathematical expressions, transcribe using plain text or LaTeX-style notation
   (e.g. x^2, \\int, \\frac{a}{b}) — whichever best preserves meaning.
4. For diagrams or figures, transcribe any labels/captions, then add a one-line
   description in square brackets like: [Diagram: triangle with vertices A, B, C].
5. For genuinely illegible characters, use [?]. For an illegible word, use [illegible].
   Do NOT hallucinate words you cannot read.
6. If multiple languages appear, transcribe each in its original script.
7. Output ONLY the transcribed text. No preface, no explanations, no markdown code fences,
   no "Here is the text:". If the image truly contains no text, output an empty string.`;

const USER_PROMPT = `Transcribe every word visible in this image with maximum accuracy.
Pay extra attention to handwriting — read each stroke carefully. Preserve layout.
Return ONLY the transcribed text.`;

const PDF_USER_PROMPT = `Transcribe every word visible across ALL pages of this document
with maximum accuracy. Pay extra attention to handwritten content — read each stroke
carefully. Preserve layout, page order, lists, tables, and equations. Return ONLY the
transcribed text (no page markers unless meaningful).`;

// Retry helper with exponential backoff for transient gateway errors (429/5xx).
async function callGateway(
  model: string,
  fileUrl: string,
  mimeType: string,
  attempt = 0
): Promise<Response> {
  const isPdf = mimeType === "application/pdf";
  const userText = isPdf ? PDF_USER_PROMPT : USER_PROMPT;
  // Gemini accepts both images and PDFs via the OpenAI-compatible image_url field
  // when the URL serves the right Content-Type. The gateway forwards the URL as-is.
  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: fileUrl } },
          ],
        },
      ],
      temperature: 0.1, // deterministic — we want fidelity, not creativity
      max_tokens: 8000, // allow long transcriptions (multi-page photos)
    }),
  });

  // Retry on transient failures
  if ((resp.status === 429 || resp.status >= 500) && attempt < 2) {
    const delay = 500 * Math.pow(2, attempt);
    await new Promise((r) => setTimeout(r, delay));
    return callGateway(model, fileUrl, mimeType, attempt + 1);
  }
  return resp;
}

// Strip common LLM preamble that sometimes slips through despite instructions.
function cleanExtractedText(raw: string): string {
  let text = raw.trim();
  // Remove wrapping ``` fences if present
  text = text.replace(/^```(?:\w+)?\n?/i, "").replace(/\n?```\s*$/i, "");
  // Strip common refusal/preamble patterns
  const preambles = [
    /^here(?:'s| is)\s+(?:the\s+)?(?:transcribed\s+|extracted\s+)?text:?\s*/i,
    /^the\s+text\s+(?:in\s+the\s+image\s+)?(?:reads|is|says):?\s*/i,
    /^transcription:?\s*/i,
    /^extracted\s+text:?\s*/i,
  ];
  for (const re of preambles) text = text.replace(re, "");
  return text.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "OCR service not configured", extractedText: "" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageUrl, storagePath } = await req.json();

    let finalImageUrl: string | undefined = typeof imageUrl === "string" ? imageUrl : undefined;
    let mimeType = "image/*";

    // Preferred path: caller passes a storage path; we mint a short-lived signed URL server-side
    if (typeof storagePath === "string" && storagePath.length > 0) {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
      const { data: signed, error: signErr } = await admin.storage
        .from("note-attachments")
        .createSignedUrl(storagePath, 60 * 5); // 5 minutes
      if (signErr || !signed?.signedUrl) {
        console.error("Failed to sign URL", signErr);
        return new Response(
          JSON.stringify({ error: "Could not access file", extractedText: "" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      finalImageUrl = signed.signedUrl;
      // Infer mime from extension; fall back to image
      const lower = storagePath.toLowerCase();
      if (lower.endsWith(".pdf")) mimeType = "application/pdf";
      else if (lower.endsWith(".png")) mimeType = "image/png";
      else if (lower.endsWith(".webp")) mimeType = "image/webp";
      else if (lower.endsWith(".heic") || lower.endsWith(".heif")) mimeType = "image/heic";
      else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) mimeType = "image/jpeg";
    }

    if (!finalImageUrl) {
      return new Response(
        JSON.stringify({ error: "imageUrl or storagePath is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try the high-accuracy model first, then fall back to flash on failure.
    let response = await callGateway(PRIMARY_MODEL, finalImageUrl, mimeType);
    let usedModel = PRIMARY_MODEL;

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.warn(`Primary model ${PRIMARY_MODEL} failed [${response.status}]: ${errBody.slice(0, 300)}`);

      // 402 = out of credits, surface that clearly so the client can show a real message
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted", extractedText: "" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Any other failure — fall back to the cheaper/faster model
      response = await callGateway(FALLBACK_MODEL, finalImageUrl, mimeType);
      usedModel = FALLBACK_MODEL;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("AI Gateway error (both models failed):", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "OCR processing failed", extractedText: "" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const rawText: string = data.choices?.[0]?.message?.content || "";
    const extractedText = cleanExtractedText(rawText);

    console.log(`OCR success via ${usedModel}: ${extractedText.length} chars extracted`);

    return new Response(
      JSON.stringify({ extractedText, model: usedModel }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("OCR error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", extractedText: "" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

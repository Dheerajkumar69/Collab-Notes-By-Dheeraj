import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/**
 * grammar-check — the "brain" of the writing cat.
 * Takes plain text, returns a list of spelling/grammar corrections.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const text = typeof body?.text === "string" ? body.text.slice(0, 6000) : "";
    if (!text.trim() || text.trim().length < 4) return json({ suggestions: [] });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI not configured" }, 500);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a proofreader. Find misspelled or clearly incorrect words in the user's text. " +
              "Return ONLY JSON: {\"suggestions\":[{\"wrong\":\"<exact word as written>\",\"fix\":\"<corrected word>\",\"reason\":\"<max 8 words>\"}]}. " +
              "Rules: 'wrong' MUST appear verbatim in the text and be a single word (no spaces). " +
              "Only include real errors — never style preferences, never proper nouns, never code, never URLs. " +
              "Max 12 items. If the text is clean, return an empty array.",
          },
          { role: "user", content: text },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return json({ error: "Rate limited" }, 429);
      if (res.status === 402) return json({ error: "AI credits exhausted" }, 402);
      console.error("gateway error", res.status, await res.text());
      return json({ error: "AI service error" }, 500);
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = String(raw).match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const list = Array.isArray((parsed as { suggestions?: unknown })?.suggestions)
      ? (parsed as { suggestions: unknown[] }).suggestions
      : [];

    const suggestions = list
      .map((s) => s as { wrong?: unknown; fix?: unknown; reason?: unknown })
      .filter(
        (s) =>
          typeof s.wrong === "string" &&
          typeof s.fix === "string" &&
          s.wrong.trim().length > 0 &&
          s.fix.trim().length > 0 &&
          !/\s/.test(s.wrong.trim()) &&
          s.wrong.trim().toLowerCase() !== s.fix.trim().toLowerCase() &&
          text.includes(s.wrong.trim()),
      )
      .slice(0, 12)
      .map((s) => ({
        wrong: (s.wrong as string).trim(),
        fix: (s.fix as string).trim(),
        reason: typeof s.reason === "string" ? s.reason.slice(0, 60) : "Spelling",
      }));

    return json({ suggestions });
  } catch (e) {
    console.error("grammar-check error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
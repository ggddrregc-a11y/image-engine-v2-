import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

const SUPABASE_URL = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"] ?? "";
const SUPABASE_KEY = process.env["VITE_SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";

interface ImageProvider {
  id: string;
  name: string;
  provider_type: string;
  base_url: string;
  api_key: string;
  model_name: string;
  enabled: boolean;
  is_default: boolean;
}

interface FetchedModel {
  id: string;
  name: string;
  supported: boolean;
  reason?: string;
  isFree?: boolean;
}

/* ─────────────────────────────────────────────────────────────────
   GET /api/image-providers
───────────────────────────────────────────────────────────────── */
router.get("/image-providers", async (_req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.json({ ok: true, providers: [] });
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/image_providers?enabled=eq.true&select=id,name,model_name,provider_type,base_url,api_key,is_default&order=is_default.desc`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
    );
    if (!r.ok) throw new Error("Supabase error");
    const data = await r.json() as ImageProvider[];
    return res.json({ ok: true, providers: data ?? [] });
  } catch {
    return res.json({ ok: true, providers: [] });
  }
});

/* ─────────────────────────────────────────────────────────────────
   POST /api/image-providers/fetch-models
───────────────────────────────────────────────────────────────── */
router.post("/image-providers/fetch-models", async (req, res) => {
  const { api_key, provider_type } = req.body as {
    base_url?: string;
    api_key?: string;
    provider_type?: string;
  };

  // ── Gemini (Nano Banana) ──────────────────────────────────────
  if (provider_type === "gemini") {
    return res.json({
      ok: true,
      models: [
        { id: "gemini-3.1-flash-image",      name: "Gemini 3.1 Flash Image — Nano Banana 2 (موصى به)", supported: true, isFree: true },
        { id: "gemini-3.1-flash-lite-image", name: "Gemini 3.1 Flash Lite Image — Nano Banana 2 Lite (أسرع وأرخص)", supported: true, isFree: true },
        { id: "gemini-2.5-flash-image",      name: "Gemini 2.5 Flash Image — Nano Banana (legacy)", supported: true, isFree: true },
        { id: "gemini-3-pro-image",          name: "Gemini 3 Pro Image — Nano Banana Pro (مدفوع)", supported: true, isFree: false },
      ] as FetchedModel[],
    });
  }

  // ── Pollinations (مجاني بدون key) ────────────────────────────
  if (provider_type === "pollinations") {
    return res.json({
      ok: true,
      models: [
        { id: "flux",          name: "FLUX",           supported: true, isFree: true },
        { id: "flux-realism",  name: "FLUX Realism",   supported: true, isFree: true },
        { id: "flux-anime",    name: "FLUX Anime",     supported: true, isFree: true },
        { id: "flux-3d",       name: "FLUX 3D",        supported: true, isFree: true },
        { id: "flux-pro",      name: "FLUX Pro",       supported: true, isFree: true },
        { id: "turbo",         name: "Turbo",          supported: true, isFree: true },
        { id: "any-dark",      name: "Any Dark",       supported: true, isFree: true },
      ] as FetchedModel[],
    });
  }

  // ── OpenRouter — يجيب الموديلات من /api/v1/images/models ────
  if (provider_type === "openrouter") {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (api_key) headers["Authorization"] = `Bearer ${api_key}`;

      const r = await fetch("https://openrouter.ai/api/v1/images/models", { headers });
      if (!r.ok) return res.status(502).json({ ok: false, error: `OpenRouter error: HTTP ${r.status}` });

      const data = await r.json() as { data?: { id: string; architecture?: { output_modalities?: string[] } }[] };
      const models: FetchedModel[] = (data.data ?? []).map((m) => ({
        id: m.id,
        name: m.id,
        supported: true,
        isFree: false,
      }));
      return res.json({ ok: true, models });
    } catch (err) {
      return res.status(502).json({ ok: false, error: `OpenRouter fetch failed: ${String(err)}` });
    }
  }

  // ── OpenAI — DALL·E + GPT Image ──────────────────────────────
  if (provider_type === "openai") {
    return res.json({
      ok: true,
      models: [
        { id: "gpt-image-2",   name: "GPT Image 2 (أحدث)",   supported: true, isFree: false },
        { id: "gpt-image-1",   name: "GPT Image 1",           supported: true, isFree: false },
        { id: "dall-e-3",      name: "DALL·E 3",              supported: true, isFree: false },
        { id: "dall-e-2",      name: "DALL·E 2",              supported: true, isFree: false },
      ] as FetchedModel[],
    });
  }

  // ── Stability AI — v2beta (الـ API الحالي) ───────────────────
  if (provider_type === "stability") {
    return res.json({
      ok: true,
      models: [
        { id: "core",           name: "Stable Image Core (موصى به)",      supported: true, isFree: false },
        { id: "ultra",          name: "Stable Image Ultra (جودة عالية)",  supported: true, isFree: false },
        { id: "sd3.5-large",    name: "SD 3.5 Large",                     supported: true, isFree: false },
        { id: "sd3.5-medium",   name: "SD 3.5 Medium",                    supported: true, isFree: false },
        { id: "sd3-large",      name: "SD 3 Large",                       supported: true, isFree: false },
      ] as FetchedModel[],
    });
  }

  // ── fal.ai — موديلات 2026 ─────────────────────────────────────
  if (provider_type === "fal") {
    return res.json({
      ok: true,
      models: [
        { id: "fal-ai/flux/schnell",           name: "FLUX.1 Schnell (سريع ومجاني)",     supported: true, isFree: true },
        { id: "fal-ai/flux/dev",               name: "FLUX.1 Dev",                       supported: true, isFree: false },
        { id: "fal-ai/flux-pro/v1.1-ultra",    name: "FLUX Pro v1.1 Ultra",              supported: true, isFree: false },
        { id: "fal-ai/flux.2/flash",           name: "FLUX.2 Flash (أحدث)",              supported: true, isFree: false },
        { id: "fal-ai/flux.2/max",             name: "FLUX.2 Max",                       supported: true, isFree: false },
        { id: "fal-ai/stable-diffusion-v35-large", name: "SD 3.5 Large",                supported: true, isFree: false },
      ] as FetchedModel[],
    });
  }

  // ── Replicate ─────────────────────────────────────────────────
  if (provider_type === "replicate") {
    if (!api_key) return res.status(400).json({ ok: false, error: "API Key required for Replicate" });
    try {
      const r = await fetch("https://api.replicate.com/v1/collections/text-to-image", {
        headers: { Authorization: `Token ${api_key}` },
      });
      if (!r.ok) return res.status(502).json({ ok: false, error: `Replicate error: HTTP ${r.status}` });
      const data = await r.json() as { models?: { owner: string; name: string; latest_version?: { id: string } }[] };
      const models: FetchedModel[] = (data.models ?? []).slice(0, 30).map((m) => ({
        id: `${m.owner}/${m.name}`,
        name: `${m.owner}/${m.name}`,
        supported: true,
        isFree: false,
      }));
      return res.json({ ok: true, models });
    } catch (err) {
      return res.status(502).json({ ok: false, error: `Replicate fetch failed: ${String(err)}` });
    }
  }

  // ── Custom ────────────────────────────────────────────────────
  return res.json({
    ok: true,
    models: [{ id: "custom-model", name: "Custom Model (اكتب اسم الموديل يدوياً)", supported: true, isFree: false }] as FetchedModel[],
  });
});

/* ─────────────────────────────────────────────────────────────────
   POST /api/image-providers/generate
───────────────────────────────────────────────────────────────── */
router.post("/image-providers/generate", async (req, res) => {
  const { provider_type, base_url, api_key, model, prompt, width, height } = req.body as {
    provider_type?: string;
    base_url?: string;
    api_key?: string;
    model?: string;
    prompt?: string;
    width?: number;
    height?: number;
  };

  if (!prompt) return res.status(400).json({ ok: false, error: "prompt is required" });

  const w = width ?? 1024;
  const h = height ?? 1024;

  // نحدد الـ aspect_ratio من الأبعاد
  const getAspectRatio = (w: number, h: number): string => {
    if (w === h) return "1:1";
    const ratio = w / h;
    if (ratio >= 1.7) return "16:9";
    if (ratio >= 1.4) return "3:2";
    if (ratio >= 1.2) return "4:3";
    if (ratio <= 0.6) return "9:16";
    if (ratio <= 0.72) return "2:3";
    if (ratio <= 0.8) return "3:4";
    return "1:1";
  };

  try {

    // ── Pollinations ─────────────────────────────────────────────
    if (provider_type === "pollinations") {
      const encodedPrompt = encodeURIComponent(prompt);
      const modelParam = model ?? "flux";
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${w}&height=${h}&model=${modelParam}&nologo=true&enhance=true`;
      const r = await fetch(imageUrl);
      if (!r.ok) return res.status(502).json({ ok: false, error: `Pollinations error: HTTP ${r.status}` });
      return res.json({ ok: true, imageUrl });
    }

    // ── Google Gemini (Nano Banana) — /v1beta/interactions ───────
    if (provider_type === "gemini") {
      if (!api_key) return res.status(400).json({ ok: false, error: "API Key required for Gemini" });
      const modelName = model ?? "gemini-3.1-flash-image";

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/interactions?key=${api_key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: modelName,
            input: prompt,
            response_format: {
              type: "image",
              aspect_ratio: getAspectRatio(w, h),
            },
          }),
        },
      );

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        logger.error({ status: geminiRes.status, body: errText }, "[image-gen] Gemini error");
        let errMsg = `Gemini HTTP ${geminiRes.status}`;
        try {
          const errJson = JSON.parse(errText);
          errMsg = `Gemini ${geminiRes.status}: ${errJson?.error?.message ?? errText}`;
        } catch { errMsg = `Gemini ${geminiRes.status}: ${errText.slice(0, 300)}`; }
        return res.status(502).json({ ok: false, error: errMsg });
      }

      const geminiData = await geminiRes.json() as {
        output_image?: { data: string; mimeType?: string };
        steps?: { type: string; content?: { type: string; data?: string; mimeType?: string }[] }[];
      };

      if (geminiData.output_image?.data) {
        const mime = geminiData.output_image.mimeType ?? "image/png";
        return res.json({ ok: true, imageUrl: `data:${mime};base64,${geminiData.output_image.data}` });
      }
      for (const step of geminiData.steps ?? []) {
        if (step.type === "model_output") {
          for (const block of step.content ?? []) {
            if (block.type === "image" && block.data) {
              const mime = block.mimeType ?? "image/png";
              return res.json({ ok: true, imageUrl: `data:${mime};base64,${block.data}` });
            }
          }
        }
      }
      return res.status(502).json({ ok: false, error: "Gemini لم يرجع صورة — تأكد من صلاحية الـ API Key والموديل" });
    }

    // ── OpenRouter — /api/v1/images ───────────────────────────────
    if (provider_type === "openrouter") {
      if (!api_key) return res.status(400).json({ ok: false, error: "API Key required for OpenRouter" });
      const modelName = model ?? "black-forest-labs/flux.2-flex";

      const orRes = await fetch("https://openrouter.ai/api/v1/images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${api_key}`,
        },
        body: JSON.stringify({
          model: modelName,
          prompt,
          aspect_ratio: getAspectRatio(w, h),
          n: 1,
        }),
      });

      if (!orRes.ok) {
        const errText = await orRes.text();
        let errMsg = `OpenRouter ${orRes.status}`;
        try { errMsg = `OpenRouter ${orRes.status}: ${(JSON.parse(errText) as { error?: { message?: string } }).error?.message ?? errText}`; } catch { /**/ }
        return res.status(502).json({ ok: false, error: errMsg });
      }

      const orData = await orRes.json() as { data?: { b64_json?: string; url?: string }[] };
      const item = orData.data?.[0];
      if (item?.b64_json) return res.json({ ok: true, imageUrl: `data:image/png;base64,${item.b64_json}` });
      if (item?.url) return res.json({ ok: true, imageUrl: item.url });
      return res.status(502).json({ ok: false, error: "OpenRouter لم يرجع صورة" });
    }

    // ── OpenAI DALL·E / GPT Image ────────────────────────────────
    if (provider_type === "openai") {
      if (!api_key) return res.status(400).json({ ok: false, error: "API Key required for OpenAI" });
      const base = (base_url ?? "https://api.openai.com").replace(/\/$/, "");
      const modelName = model ?? "gpt-image-2";

      // GPT Image 2 يستخدم /v1/images/generations بنفس format
      const size = w > h ? "1536x1024" : w < h ? "1024x1536" : "1024x1024";

      const openaiRes = await fetch(`${base}/v1/images/generations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${api_key}` },
        body: JSON.stringify({ model: modelName, prompt, n: 1, size, response_format: "b64_json" }),
      });

      if (!openaiRes.ok) {
        const errText = await openaiRes.text();
        return res.status(502).json({ ok: false, error: `OpenAI error: ${openaiRes.status} — ${errText.slice(0, 300)}` });
      }

      const openaiData = await openaiRes.json() as { data?: { b64_json?: string; url?: string }[] };
      const item = openaiData.data?.[0];
      if (item?.b64_json) return res.json({ ok: true, imageUrl: `data:image/png;base64,${item.b64_json}` });
      if (item?.url) return res.json({ ok: true, imageUrl: item.url });
      return res.status(502).json({ ok: false, error: "OpenAI did not return an image" });
    }

    // ── Stability AI v2beta ───────────────────────────────────────
    if (provider_type === "stability") {
      if (!api_key) return res.status(400).json({ ok: false, error: "API Key required for Stability AI" });
      const modelId = model ?? "core";

      // v2beta API — يستخدم multipart/form-data
      const formData = new FormData();
      formData.append("prompt", prompt);
      formData.append("output_format", "png");
      formData.append("aspect_ratio", getAspectRatio(w, h));

      const endpoint = modelId === "ultra"
        ? "https://api.stability.ai/v2beta/stable-image/generate/ultra"
        : modelId.startsWith("sd3")
        ? `https://api.stability.ai/v2beta/stable-image/generate/sd3`
        : "https://api.stability.ai/v2beta/stable-image/generate/core";

      const stabilityRes = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${api_key}`, Accept: "image/*" },
        body: formData,
      });

      if (!stabilityRes.ok) {
        const errText = await stabilityRes.text();
        return res.status(502).json({ ok: false, error: `Stability AI error: ${stabilityRes.status} — ${errText.slice(0, 300)}` });
      }

      const buffer = await stabilityRes.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      return res.json({ ok: true, imageUrl: `data:image/png;base64,${base64}` });
    }

    // ── fal.ai — queue.fal.run + polling ─────────────────────────
    if (provider_type === "fal") {
      if (!api_key) return res.status(400).json({ ok: false, error: "API Key required for fal.ai" });
      const modelId = model ?? "fal-ai/flux/schnell";

      // Submit
      const submitRes = await fetch(`https://queue.fal.run/${modelId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Key ${api_key}` },
        body: JSON.stringify({
          prompt,
          image_size: { width: w, height: h },
          num_images: 1,
          output_format: "jpeg",
        }),
      });

      if (!submitRes.ok) {
        const errText = await submitRes.text();
        return res.status(502).json({ ok: false, error: `fal.ai submit error: ${submitRes.status} — ${errText.slice(0, 300)}` });
      }

      const submitted = await submitRes.json() as { request_id: string };
      const requestId = submitted.request_id;
      if (!requestId) return res.status(502).json({ ok: false, error: "fal.ai did not return request_id" });

      // Polling
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const statusRes = await fetch(`https://queue.fal.run/${modelId}/requests/${requestId}/status`, {
          headers: { Authorization: `Key ${api_key}` },
        });
        const status = await statusRes.json() as { status: string };
        if (status.status === "COMPLETED") {
          const resultRes = await fetch(`https://queue.fal.run/${modelId}/requests/${requestId}`, {
            headers: { Authorization: `Key ${api_key}` },
          });
          const result = await resultRes.json() as { images?: { url: string }[] };
          const imageUrl = result.images?.[0]?.url;
          if (!imageUrl) return res.status(502).json({ ok: false, error: "fal.ai did not return image URL" });
          return res.json({ ok: true, imageUrl });
        }
        if (status.status === "FAILED") break;
      }
      return res.status(502).json({ ok: false, error: "fal.ai generation failed or timed out" });
    }

    // ── Replicate ─────────────────────────────────────────────────
    if (provider_type === "replicate") {
      if (!api_key) return res.status(400).json({ ok: false, error: "API Key required for Replicate" });
      const modelId = model ?? "black-forest-labs/flux-schnell";

      const repRes = await fetch(`https://api.replicate.com/v1/models/${modelId}/predictions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Token ${api_key}`, "Prefer": "wait" },
        body: JSON.stringify({ input: { prompt, width: w, height: h } }),
      });

      if (!repRes.ok) {
        const errText = await repRes.text();
        return res.status(502).json({ ok: false, error: `Replicate error: ${repRes.status} — ${errText.slice(0, 300)}` });
      }

      const prediction = await repRes.json() as { id: string; status: string; urls?: { get: string }; output?: string[] };

      // لو رجع مباشرة (Prefer: wait)
      if (prediction.output?.[0]) return res.json({ ok: true, imageUrl: prediction.output[0] });

      // Polling
      const pollUrl = prediction.urls?.get ?? `https://api.replicate.com/v1/predictions/${prediction.id}`;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const pollRes = await fetch(pollUrl, { headers: { Authorization: `Token ${api_key}` } });
        const pollData = await pollRes.json() as { status: string; output?: string[] };
        if (pollData.status === "succeeded" && pollData.output?.[0]) {
          return res.json({ ok: true, imageUrl: pollData.output[0] });
        }
        if (pollData.status === "failed") break;
      }
      return res.status(502).json({ ok: false, error: "Replicate generation failed or timed out" });
    }

    return res.status(400).json({ ok: false, error: `Unsupported provider_type: ${provider_type ?? "unknown"}` });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "[image-gen] generation failed");
    return res.status(502).json({ ok: false, error: `Generation failed: ${msg}` });
  }
});

export default router;

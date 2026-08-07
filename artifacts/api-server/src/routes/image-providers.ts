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
   Returns enabled image providers from Supabase
───────────────────────────────────────────────────────────────── */
router.get("/image-providers", async (_req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.json({ ok: true, providers: [] });
  }
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
   Fetches available image models from a provider
───────────────────────────────────────────────────────────────── */
router.post("/image-providers/fetch-models", async (req, res) => {
  const { base_url, api_key, provider_type } = req.body as {
    base_url?: string;
    api_key?: string;
    provider_type?: string;
  };

  // Gemini — موديلات الصور المعروفة
  if (provider_type === "gemini") {
    const geminiModels: FetchedModel[] = [
      { id: "gemini-3.1-flash-image-preview", name: "Gemini 3.1 Flash Image", supported: true, isFree: true },
      { id: "gemini-2.0-flash-exp", name: "Gemini 2.0 Flash Exp", supported: true, isFree: true },
      { id: "imagen-3.0-generate-002", name: "Imagen 3.0", supported: true, isFree: false },
      { id: "imagen-3.0-fast-generate-001", name: "Imagen 3.0 Fast", supported: true, isFree: false },
    ];
    return res.json({ ok: true, models: geminiModels });
  }

  // Pollinations — موديلات ثابتة مجانية
  if (provider_type === "pollinations") {
    const pollinationsModels: FetchedModel[] = [
      { id: "flux", name: "FLUX", supported: true, isFree: true },
      { id: "flux-realism", name: "FLUX Realism", supported: true, isFree: true },
      { id: "flux-cablyai", name: "FLUX CablyAI", supported: true, isFree: true },
      { id: "flux-anime", name: "FLUX Anime", supported: true, isFree: true },
      { id: "flux-3d", name: "FLUX 3D", supported: true, isFree: true },
      { id: "any-dark", name: "Any Dark", supported: true, isFree: true },
      { id: "flux-pro", name: "FLUX Pro", supported: true, isFree: true },
      { id: "turbo", name: "Turbo", supported: true, isFree: true },
    ];
    return res.json({ ok: true, models: pollinationsModels });
  }

  if (!base_url) {
    return res.status(400).json({ ok: false, error: "base_url is required" });
  }

  const base = base_url.replace(/\/$/, "");

  try {
    // Stability AI
    if (provider_type === "stability") {
      const r = await fetch(`${base}/v1/engines/list`, {
        headers: { Authorization: `Bearer ${api_key}`, "Content-Type": "application/json" },
      });
      if (!r.ok) return res.status(502).json({ ok: false, error: `Stability AI error: HTTP ${r.status}` });
      const data = await r.json() as { id: string; name?: string; type?: string }[];
      const models: FetchedModel[] = (Array.isArray(data) ? data : [])
        .filter((e) => !e.type || e.type !== "AUDIO")
        .map((e) => ({ id: e.id, name: e.name ?? e.id, supported: true, isFree: false }));
      return res.json({ ok: true, models });
    }

    // Replicate
    if (provider_type === "replicate") {
      if (!api_key) return res.status(400).json({ ok: false, error: "API Key is required for Replicate" });
      const r = await fetch("https://api.replicate.com/v1/models?page_size=50", {
        headers: { Authorization: `Token ${api_key}`, "Content-Type": "application/json" },
      });
      if (!r.ok) return res.status(502).json({ ok: false, error: `Replicate error: HTTP ${r.status}` });
      const data = await r.json() as { results?: { url?: string; name?: string; owner?: string }[] };
      const models: FetchedModel[] = (data.results ?? []).map((m) => ({
        id: `${m.owner ?? ""}/${m.name ?? ""}`.replace(/^\//, ""),
        name: m.name ?? "",
        supported: true,
        isFree: false,
      }));
      return res.json({ ok: true, models });
    }

    // fal.ai — موديلات ثابتة
    if (provider_type === "fal") {
      const falModels: FetchedModel[] = [
        { id: "fal-ai/flux/schnell", name: "FLUX Schnell (Fast)", supported: true, isFree: true },
        { id: "fal-ai/flux/dev", name: "FLUX Dev", supported: true, isFree: false },
        { id: "fal-ai/flux-pro", name: "FLUX Pro", supported: true, isFree: false },
        { id: "fal-ai/fast-sdxl", name: "Fast SDXL", supported: true, isFree: false },
        { id: "fal-ai/stable-diffusion-v3-medium", name: "SD v3 Medium", supported: true, isFree: false },
        { id: "fal-ai/aura-flow", name: "AuraFlow", supported: true, isFree: false },
      ];
      return res.json({ ok: true, models: falModels });
    }

    // OpenAI — DALL·E
    if (provider_type === "openai") {
      const openaiModels: FetchedModel[] = [
        { id: "dall-e-3", name: "DALL·E 3", supported: true, isFree: false },
        { id: "dall-e-2", name: "DALL·E 2", supported: true, isFree: false },
      ];
      return res.json({ ok: true, models: openaiModels });
    }

    // Custom — OpenAI-compatible /v1/models
    const r = await fetch(`${base}/v1/models`, {
      headers: { ...(api_key ? { Authorization: `Bearer ${api_key}` } : {}), "Content-Type": "application/json" },
    });
    if (!r.ok) return res.status(502).json({ ok: false, error: `Provider returned HTTP ${r.status}` });
    const data = await r.json() as { data?: Record<string, unknown>[] };
    const models: FetchedModel[] = (data.data ?? []).map((m) => ({
      id: String(m["id"] ?? ""),
      name: String(m["name"] ?? m["id"] ?? ""),
      supported: true,
      isFree: false,
    }));
    return res.json({ ok: true, models });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ ok: false, error: `Failed to fetch models: ${msg}` });
  }
});

/* ─────────────────────────────────────────────────────────────────
   POST /api/image-providers/generate
   Generates an image using the selected provider
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

  try {
    // ── Pollinations ─────────────────────────────────────────────
    if (provider_type === "pollinations") {
      const encodedPrompt = encodeURIComponent(prompt);
      const modelParam = model ?? "flux";
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${w}&height=${h}&model=${modelParam}&nologo=true`;
      // نتحقق إن الصورة اتولدت
      const r = await fetch(imageUrl);
      if (!r.ok) return res.status(502).json({ ok: false, error: `Pollinations error: HTTP ${r.status}` });
      return res.json({ ok: true, imageUrl });
    }

    // ── Google Gemini Image ───────────────────────────────────────
    if (provider_type === "gemini") {
      if (!api_key) return res.status(400).json({ ok: false, error: "API Key required for Gemini" });
      const modelName = model ?? "gemini-3.1-flash-image-preview";

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${api_key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
          }),
        },
      );

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        logger.error({ status: geminiRes.status, body: errText }, "[image-gen] Gemini error");
        return res.status(502).json({ ok: false, error: `Gemini error: ${geminiRes.status}` });
      }

      const geminiData = await geminiRes.json() as {
        candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] } }[];
      };

      const imagePart = geminiData.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (!imagePart?.inlineData) {
        return res.status(502).json({ ok: false, error: "Gemini did not return an image" });
      }

      const { mimeType, data } = imagePart.inlineData;
      const imageUrl = `data:${mimeType};base64,${data}`;
      return res.json({ ok: true, imageUrl });
    }

    // ── OpenAI DALL·E ─────────────────────────────────────────────
    if (provider_type === "openai") {
      if (!api_key) return res.status(400).json({ ok: false, error: "API Key required for OpenAI" });
      const base = (base_url ?? "https://api.openai.com").replace(/\/$/, "");
      const modelName = model ?? "dall-e-3";
      const size = w >= 1792 || h >= 1792 ? "1792x1024" : w > h ? "1792x1024" : w < h ? "1024x1792" : "1024x1024";

      const openaiRes = await fetch(`${base}/v1/images/generations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${api_key}` },
        body: JSON.stringify({ model: modelName, prompt, n: 1, size }),
      });

      if (!openaiRes.ok) {
        const errText = await openaiRes.text();
        return res.status(502).json({ ok: false, error: `OpenAI error: ${openaiRes.status} — ${errText}` });
      }

      const openaiData = await openaiRes.json() as { data?: { url?: string }[] };
      const imageUrl = openaiData.data?.[0]?.url;
      if (!imageUrl) return res.status(502).json({ ok: false, error: "OpenAI did not return an image URL" });
      return res.json({ ok: true, imageUrl });
    }

    // ── Stability AI ──────────────────────────────────────────────
    if (provider_type === "stability") {
      if (!api_key) return res.status(400).json({ ok: false, error: "API Key required for Stability AI" });
      const base = (base_url ?? "https://api.stability.ai").replace(/\/$/, "");
      const engineId = model ?? "stable-diffusion-xl-1024-v1-0";

      const stabilityRes = await fetch(`${base}/v1/generation/${engineId}/text-to-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${api_key}`, Accept: "application/json" },
        body: JSON.stringify({
          text_prompts: [{ text: prompt, weight: 1 }],
          width: w, height: h, steps: 30, cfg_scale: 7, samples: 1,
        }),
      });

      if (!stabilityRes.ok) {
        const errText = await stabilityRes.text();
        return res.status(502).json({ ok: false, error: `Stability AI error: ${stabilityRes.status} — ${errText}` });
      }

      const stabilityData = await stabilityRes.json() as { artifacts?: { base64: string; mimeType?: string }[] };
      const artifact = stabilityData.artifacts?.[0];
      if (!artifact?.base64) return res.status(502).json({ ok: false, error: "Stability AI did not return an image" });
      const imageUrl = `data:image/png;base64,${artifact.base64}`;
      return res.json({ ok: true, imageUrl });
    }

    // ── fal.ai ────────────────────────────────────────────────────
    if (provider_type === "fal") {
      if (!api_key) return res.status(400).json({ ok: false, error: "API Key required for fal.ai" });
      const modelId = model ?? "fal-ai/flux/schnell";

      const falRes = await fetch(`https://fal.run/${modelId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Key ${api_key}` },
        body: JSON.stringify({ prompt, image_size: { width: w, height: h } }),
      });

      if (!falRes.ok) {
        const errText = await falRes.text();
        return res.status(502).json({ ok: false, error: `fal.ai error: ${falRes.status} — ${errText}` });
      }

      const falData = await falRes.json() as { images?: { url: string }[] };
      const imageUrl = falData.images?.[0]?.url;
      if (!imageUrl) return res.status(502).json({ ok: false, error: "fal.ai did not return an image" });
      return res.json({ ok: true, imageUrl });
    }

    // ── Custom / Replicate ────────────────────────────────────────
    if (provider_type === "replicate") {
      if (!api_key) return res.status(400).json({ ok: false, error: "API Key required for Replicate" });
      const modelId = model ?? "stability-ai/sdxl";

      const repRes = await fetch(`https://api.replicate.com/v1/models/${modelId}/predictions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Token ${api_key}` },
        body: JSON.stringify({ input: { prompt, width: w, height: h } }),
      });

      if (!repRes.ok) {
        const errText = await repRes.text();
        return res.status(502).json({ ok: false, error: `Replicate error: ${repRes.status} — ${errText}` });
      }

      // Replicate بيحتاج polling
      const prediction = await repRes.json() as { id: string; status: string; urls?: { get: string }; output?: string[] };
      const pollUrl = prediction.urls?.get ?? `https://api.replicate.com/v1/predictions/${prediction.id}`;

      let imageUrl: string | undefined;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const pollRes = await fetch(pollUrl, { headers: { Authorization: `Token ${api_key}` } });
        const pollData = await pollRes.json() as { status: string; output?: string[] };
        if (pollData.status === "succeeded" && pollData.output?.[0]) {
          imageUrl = pollData.output[0];
          break;
        }
        if (pollData.status === "failed") break;
      }

      if (!imageUrl) return res.status(502).json({ ok: false, error: "Replicate generation failed or timed out" });
      return res.json({ ok: true, imageUrl });
    }

    return res.status(400).json({ ok: false, error: `Unsupported provider_type: ${provider_type}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "[image-gen] generation failed");
    return res.status(502).json({ ok: false, error: `Generation failed: ${msg}` });
  }
});

export default router;

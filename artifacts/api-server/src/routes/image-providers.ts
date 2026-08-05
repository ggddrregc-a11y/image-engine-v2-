import { Router } from "express";

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

// Patterns that indicate an image generation model
const IMAGE_MODEL_PATTERNS = [
  /dall-e/i, /stable-diffusion/i, /sdxl/i, /sd[- _]?xl/i,
  /flux/i, /midjourney/i, /imagen/i, /kandinsky/i,
  /playground/i, /dreamshaper/i, /realistic-vision/i,
  /juggernaut/i, /deliberate/i, /photon/i, /runway/i,
  /fal-ai/i, /fast-sdxl/i, /fast-lightning/i,
  /text-to-image/i, /image-generation/i, /txt2img/i,
  /controlnet/i, /inpainting/i, /outpainting/i,
  /upscale/i, /super-resolution/i,
];

// Patterns that are definitely NOT image generation models
const NON_IMAGE_PATTERNS = [
  /embedding/i, /whisper/i, /tts/i, /transcri/i,
  /moderat/i, /classify/i, /rerank/i, /chat/i,
  /gpt-[34]/i, /llama/i, /mistral/i, /gemma/i,
  /text-davinci/i, /curie/i, /babbage/i, /ada/i,
];

function isImageSupported(modelId: string): { supported: boolean; reason?: string } {
  const id = modelId.toLowerCase();
  for (const pat of NON_IMAGE_PATTERNS) {
    if (pat.test(id)) return { supported: false, reason: "Not an image model" };
  }
  for (const pat of IMAGE_MODEL_PATTERNS) {
    if (pat.test(id)) return { supported: true };
  }
  // If we can't determine, mark as supported (let user decide)
  return { supported: true };
}

/**
 * POST /api/image-providers/fetch-models
 * Fetches available image generation models from a provider
 */
router.post("/image-providers/fetch-models", async (req, res) => {
  const { base_url, api_key, provider_type } = req.body as {
    base_url?: string;
    api_key?: string;
    provider_type?: string;
  };

  if (!base_url) {
    return res.status(400).json({ ok: false, error: "base_url is required" });
  }

  const base = base_url.replace(/\/$/, "");

  try {
    // ComfyUI — fetch available checkpoints from /object_info or /models
    if (provider_type === "comfyui") {
      try {
        const r = await fetch(`${base}/object_info/CheckpointLoaderSimple`);
        if (r.ok) {
          const data = await r.json() as {
            CheckpointLoaderSimple?: {
              input?: { required?: { ckpt_name?: [string[]] } };
            };
          };
          const checkpoints = data?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] ?? [];
          const models: FetchedModel[] = checkpoints.map((name: string) => ({
            id: name,
            name,
            supported: true,
          }));
          return res.json({ ok: true, models });
        }
      } catch { /* fall through */ }

      // Fallback: try /models endpoint
      try {
        const r = await fetch(`${base}/models/checkpoints`);
        if (r.ok) {
          const data = await r.json() as string[];
          const models: FetchedModel[] = (Array.isArray(data) ? data : []).map((name: string) => ({
            id: name,
            name,
            supported: true,
          }));
          return res.json({ ok: true, models });
        }
      } catch { /* fall through */ }

      return res.status(502).json({ ok: false, error: "Could not connect to ComfyUI — check the Base URL" });
    }

    // Stability AI — list engines
    if (provider_type === "stability") {
      const r = await fetch(`${base}/v1/engines/list`, {
        headers: { Authorization: `Bearer ${api_key}`, "Content-Type": "application/json" },
      });
      if (!r.ok) return res.status(502).json({ ok: false, error: `Stability AI error: HTTP ${r.status}` });
      const data = await r.json() as { id: string; name?: string; description?: string; type?: string }[];
      const models: FetchedModel[] = (Array.isArray(data) ? data : [])
        .filter((e) => !e.type || e.type !== "AUDIO")
        .map((e) => ({
          id: e.id,
          name: e.name ?? e.id,
          supported: true,
          isFree: false,
        }));
      return res.json({ ok: true, models });
    }

    // HuggingFace — static well-known image models (API doesn't list them easily)
    if (provider_type === "huggingface") {
      const knownModels: FetchedModel[] = [
        { id: "stabilityai/stable-diffusion-xl-base-1.0", name: "SDXL Base 1.0", supported: true, isFree: true },
        { id: "stabilityai/stable-diffusion-2-1", name: "Stable Diffusion 2.1", supported: true, isFree: true },
        { id: "runwayml/stable-diffusion-v1-5", name: "Stable Diffusion 1.5", supported: true, isFree: true },
        { id: "CompVis/stable-diffusion-v1-4", name: "Stable Diffusion 1.4", supported: true, isFree: true },
        { id: "prompthero/openjourney", name: "OpenJourney", supported: true, isFree: true },
        { id: "dreamlike-art/dreamlike-photoreal-2.0", name: "Dreamlike Photoreal 2.0", supported: true, isFree: true },
      ];
      return res.json({ ok: true, models: knownModels });
    }

    // Replicate — list public image models
    if (provider_type === "replicate") {
      if (!api_key) return res.status(400).json({ ok: false, error: "API Key is required for Replicate" });
      const r = await fetch("https://api.replicate.com/v1/models?page_size=50", {
        headers: { Authorization: `Token ${api_key}`, "Content-Type": "application/json" },
      });
      if (!r.ok) return res.status(502).json({ ok: false, error: `Replicate error: HTTP ${r.status}` });
      const data = await r.json() as { results?: { url?: string; name?: string; owner?: string; description?: string }[] };
      const models: FetchedModel[] = (data.results ?? []).map((m) => ({
        id: `${m.owner ?? ""}/${m.name ?? ""}`.replace(/^\//, ""),
        name: m.name ?? "",
        supported: true,
        isFree: false,
      }));
      return res.json({ ok: true, models });
    }

    // fal.ai — static well-known models
    if (provider_type === "fal") {
      const knownModels: FetchedModel[] = [
        { id: "fal-ai/fast-sdxl", name: "Fast SDXL", supported: true, isFree: false },
        { id: "fal-ai/flux/schnell", name: "FLUX Schnell (Fast)", supported: true, isFree: true },
        { id: "fal-ai/flux/dev", name: "FLUX Dev", supported: true, isFree: false },
        { id: "fal-ai/flux-pro", name: "FLUX Pro", supported: true, isFree: false },
        { id: "fal-ai/stable-diffusion-v3-medium", name: "SD v3 Medium", supported: true, isFree: false },
        { id: "fal-ai/aura-flow", name: "AuraFlow", supported: true, isFree: false },
        { id: "fal-ai/kolors", name: "Kolors", supported: true, isFree: false },
        { id: "fal-ai/pixart-sigma", name: "PixArt Sigma", supported: true, isFree: false },
      ];
      return res.json({ ok: true, models: knownModels });
    }

    // OpenAI — static DALL·E models
    if (provider_type === "openai") {
      const knownModels: FetchedModel[] = [
        { id: "dall-e-3", name: "DALL·E 3", supported: true, isFree: false },
        { id: "dall-e-2", name: "DALL·E 2", supported: true, isFree: false },
      ];
      return res.json({ ok: true, models: knownModels });
    }

    // Custom / Other — try OpenAI-compatible /v1/models
    const r = await fetch(`${base}/v1/models`, {
      headers: {
        ...(api_key ? { Authorization: `Bearer ${api_key}` } : {}),
        "Content-Type": "application/json",
      },
    });

    if (!r.ok) {
      return res.status(502).json({ ok: false, error: `Provider returned HTTP ${r.status} — check Base URL and API Key` });
    }

    const data = await r.json() as { data?: Record<string, unknown>[] };
    const rawModels = data.data ?? [];

    const models: FetchedModel[] = rawModels.map((m) => {
      const id = String(m["id"] ?? "");
      const { supported, reason } = isImageSupported(id);
      return {
        id,
        name: String(m["name"] ?? id),
        supported,
        reason,
        isFree: false,
      };
    });

    models.sort((a, b) => {
      if (a.supported !== b.supported) return a.supported ? -1 : 1;
      return a.id.localeCompare(b.id);
    });

    return res.json({ ok: true, models, total: models.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ ok: false, error: `Failed to fetch models: ${msg}` });
  }
});

/**
 * POST /api/image-providers/test
 * Tests connectivity to an image provider
 */
router.post("/image-providers/test", async (req, res) => {
  const { provider_type, base_url, api_key } = req.body as {
    provider_type?: string;
    base_url?: string;
    api_key?: string;
  };

  if (!base_url) {
    return res.status(400).json({ ok: false, error: "base_url is required" });
  }

  const base = base_url.replace(/\/$/, "");
  const start = Date.now();

  try {
    if (provider_type === "comfyui") {
      const r = await fetch(`${base}/system_stats`);
      const latencyMs = Date.now() - start;
      if (!r.ok) return res.json({ ok: false, latencyMs, error: `HTTP ${r.status}` });
      return res.json({ ok: true, latencyMs });
    }

    if (provider_type === "stability") {
      const r = await fetch(`${base}/v1/user/account`, {
        headers: { Authorization: `Bearer ${api_key}` },
      });
      const latencyMs = Date.now() - start;
      if (!r.ok) return res.json({ ok: false, latencyMs, error: `HTTP ${r.status}` });
      return res.json({ ok: true, latencyMs });
    }

    if (provider_type === "huggingface") {
      const r = await fetch("https://huggingface.co/api/whoami", {
        headers: { Authorization: `Bearer ${api_key}` },
      });
      const latencyMs = Date.now() - start;
      if (!r.ok) return res.json({ ok: false, latencyMs, error: `HTTP ${r.status}` });
      return res.json({ ok: true, latencyMs });
    }

    if (provider_type === "replicate") {
      const r = await fetch("https://api.replicate.com/v1/account", {
        headers: { Authorization: `Token ${api_key}` },
      });
      const latencyMs = Date.now() - start;
      if (!r.ok) return res.json({ ok: false, latencyMs, error: `HTTP ${r.status}` });
      return res.json({ ok: true, latencyMs });
    }

    if (provider_type === "fal") {
      const r = await fetch("https://fal.run/fal-ai/fast-sdxl", {
        method: "HEAD",
        headers: { Authorization: `Key ${api_key}` },
      });
      const latencyMs = Date.now() - start;
      // fal.ai returns 405 for HEAD on valid endpoints — that still means reachable
      if (r.status === 405 || r.ok) return res.json({ ok: true, latencyMs });
      return res.json({ ok: false, latencyMs, error: `HTTP ${r.status}` });
    }

    // OpenAI / custom
    const r = await fetch(`${base}/v1/models`, {
      headers: { ...(api_key ? { Authorization: `Bearer ${api_key}` } : {}) },
    });
    const latencyMs = Date.now() - start;
    if (!r.ok) return res.json({ ok: false, latencyMs, error: `HTTP ${r.status}` });
    return res.json({ ok: true, latencyMs });
  } catch (err) {
    return res.json({ ok: false, latencyMs: Date.now() - start, error: String(err) });
  }
});

/**
 * GET /api/image-providers
 * Returns enabled image providers (used by generate page)
 */
router.get("/image-providers", async (_req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.json({ ok: true, providers: [] });
  }
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/image_providers?enabled=eq.true&select=id,name,model_name,provider_type,base_url,is_default&order=is_default.desc`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
    );
    if (!r.ok) throw new Error("Supabase error");
    const data = await r.json() as ImageProvider[];
    return res.json({ ok: true, providers: data ?? [] });
  } catch {
    return res.json({ ok: true, providers: [] });
  }
});

export default router;

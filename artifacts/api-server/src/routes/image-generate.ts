import { Router } from "express";

const router = Router();

const SUPABASE_URL = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"] ?? "";
const SUPABASE_KEY = process.env["VITE_SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
const COMFYUI_BASE = (process.env["COMFYUI_BASE_URL"] ?? "").replace(/\/$/, "");

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

interface GenerateRequest {
  provider_id?: string;
  provider_type?: string;
  base_url?: string;
  api_key?: string;
  model?: string;
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg_scale?: number;
  sampler?: string;
  quality?: string;
  // ComfyUI specific
  workflow?: Record<string, unknown>;
}

// ── Fetch provider from Supabase ─────────────────────────────────
async function getProvider(providerId: string): Promise<ImageProvider | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/image_providers?id=eq.${providerId}&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
    );
    if (!res.ok) return null;
    const data = await res.json() as ImageProvider[];
    return data[0] ?? null;
  } catch { return null; }
}

// ── Provider handlers ────────────────────────────────────────────

// ComfyUI — poll until image ready
async function generateComfyUI(
  base: string,
  workflow: Record<string, unknown>,
): Promise<{ imageUrl: string; downloadUrl: string }> {
  const comfyRes = await fetch(`${base}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
  });
  if (!comfyRes.ok) throw new Error(`ComfyUI error: ${await comfyRes.text()}`);
  const { prompt_id } = await comfyRes.json() as { prompt_id?: string };
  if (!prompt_id) throw new Error("ComfyUI did not return a prompt_id");

  for (let i = 0; i < 300; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const histRes = await fetch(`${base}/history/${prompt_id}`);
    if (!histRes.ok) continue;
    const hist = await histRes.json() as Record<string, unknown>;
    const entry = hist[prompt_id] as Record<string, unknown> | undefined;
    if (!entry) continue;
    const outputs = entry.outputs as Record<string, unknown> | undefined;
    if (!outputs) continue;
    for (const nodeOutput of Object.values(outputs)) {
      const node = nodeOutput as { images?: Array<{ filename: string; subfolder: string; type: string }> };
      if (node.images && node.images.length > 0) {
        const img = node.images[0];
        const imageUrl = `${base}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${encodeURIComponent(img.type)}`;
        const downloadUrl = `/api/comfy/image?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${encodeURIComponent(img.type)}`;
        return { imageUrl, downloadUrl };
      }
    }
  }
  throw new Error("Timed out waiting for ComfyUI");
}

// HuggingFace — Inference API
async function generateHuggingFace(
  apiKey: string,
  model: string,
  prompt: string,
  width = 512,
  height = 512,
  steps = 20,
): Promise<{ imageUrl: string; downloadUrl: string }> {
  const res = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: { width, height, num_inference_steps: steps },
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`HuggingFace error ${res.status}: ${err}`);
  }
  const buffer = await res.arrayBuffer();
  const b64 = Buffer.from(buffer).toString("base64");
  const dataUrl = `data:image/png;base64,${b64}`;
  return { imageUrl: dataUrl, downloadUrl: dataUrl };
}

// OpenAI DALL·E
async function generateOpenAI(
  apiKey: string,
  model: string,
  prompt: string,
  width = 1024,
  height = 1024,
): Promise<{ imageUrl: string; downloadUrl: string }> {
  const size = `${width}x${height}` as string;
  const validSizes = ["256x256", "512x512", "1024x1024", "1024x1792", "1792x1024"];
  const resolvedSize = validSizes.includes(size) ? size : "1024x1024";

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, n: 1, size: resolvedSize, response_format: "url" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(`OpenAI error ${res.status}: ${err?.error?.message ?? "unknown"}`);
  }
  const data = await res.json() as { data?: { url?: string }[] };
  const url = data.data?.[0]?.url;
  if (!url) throw new Error("OpenAI did not return an image URL");
  return { imageUrl: url, downloadUrl: url };
}

// Stability AI
async function generateStability(
  apiKey: string,
  model: string,
  prompt: string,
  width = 1024,
  height = 1024,
  steps = 30,
  cfgScale = 7,
): Promise<{ imageUrl: string; downloadUrl: string }> {
  const res = await fetch(`https://api.stability.ai/v1/generation/${model}/text-to-image`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      text_prompts: [{ text: prompt, weight: 1 }],
      cfg_scale: cfgScale,
      width,
      height,
      steps,
      samples: 1,
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Stability AI error ${res.status}: ${err}`);
  }
  const data = await res.json() as { artifacts?: { base64?: string }[] };
  const b64 = data.artifacts?.[0]?.base64;
  if (!b64) throw new Error("Stability AI did not return an image");
  const dataUrl = `data:image/png;base64,${b64}`;
  return { imageUrl: dataUrl, downloadUrl: dataUrl };
}

// fal.ai
async function generateFal(
  apiKey: string,
  model: string,
  prompt: string,
  width = 1024,
  height = 1024,
  steps = 4,
): Promise<{ imageUrl: string; downloadUrl: string }> {
  const res = await fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, image_size: { width, height }, num_inference_steps: steps }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`fal.ai error ${res.status}: ${err}`);
  }
  const data = await res.json() as { images?: { url?: string }[] };
  const url = data.images?.[0]?.url;
  if (!url) throw new Error("fal.ai did not return an image URL");
  return { imageUrl: url, downloadUrl: url };
}

// Replicate
async function generateReplicate(
  apiKey: string,
  model: string,
  prompt: string,
  width = 1024,
  height = 1024,
  steps = 4,
): Promise<{ imageUrl: string; downloadUrl: string }> {
  // Submit prediction
  const submitRes = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({ input: { prompt, width, height, num_inference_steps: steps } }),
  });
  if (!submitRes.ok) {
    const err = await submitRes.text().catch(() => `HTTP ${submitRes.status}`);
    throw new Error(`Replicate error ${submitRes.status}: ${err}`);
  }
  const prediction = await submitRes.json() as {
    id?: string;
    status?: string;
    output?: string | string[];
    urls?: { get?: string };
  };

  // If already done (Prefer: wait)
  if (prediction.status === "succeeded" && prediction.output) {
    const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    return { imageUrl: url, downloadUrl: url };
  }

  // Poll until done
  const pollUrl = prediction.urls?.get;
  if (!pollUrl) throw new Error("Replicate did not return a poll URL");

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Token ${apiKey}` },
    });
    if (!pollRes.ok) continue;
    const result = await pollRes.json() as { status?: string; output?: string | string[] };
    if (result.status === "succeeded" && result.output) {
      const url = Array.isArray(result.output) ? result.output[0] : result.output;
      return { imageUrl: url, downloadUrl: url };
    }
    if (result.status === "failed") throw new Error("Replicate prediction failed");
  }
  throw new Error("Timed out waiting for Replicate");
}

// Custom OpenAI-compatible
async function generateCustom(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  width = 1024,
  height = 1024,
): Promise<{ imageUrl: string; downloadUrl: string }> {
  const base = baseUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/v1/images/generations`, {
    method: "POST",
    headers: {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, prompt, n: 1, size: `${width}x${height}`, response_format: "url" }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Custom provider error ${res.status}: ${err}`);
  }
  const data = await res.json() as { data?: { url?: string }[] };
  const url = data.data?.[0]?.url;
  if (!url) throw new Error("Custom provider did not return an image URL");
  return { imageUrl: url, downloadUrl: url };
}

// ── Main route ───────────────────────────────────────────────────

/**
 * POST /api/image/generate
 * Unified image generation endpoint for all providers
 */
router.post("/image/generate", async (req, res) => {
  const body = req.body as GenerateRequest;

  if (!body.prompt?.trim()) {
    return res.status(400).json({ ok: false, error: "prompt is required" });
  }

  // Resolve provider — from request body or fetch from Supabase by id
  let providerType = body.provider_type;
  let baseUrl      = body.base_url ?? "";
  let apiKey       = body.api_key  ?? "";
  let model        = body.model    ?? "";

  if (body.provider_id && (!providerType || !model)) {
    const provider = await getProvider(body.provider_id);
    if (provider) {
      providerType = provider.provider_type;
      baseUrl      = provider.base_url;
      apiKey       = provider.api_key;
      model        = provider.model_name;
    }
  }

  if (!providerType) {
    return res.status(400).json({ ok: false, error: "provider_type is required" });
  }

  const prompt   = body.prompt.trim();
  const width    = body.width  ?? 1024;
  const height   = body.height ?? 1024;
  const steps    = body.steps  ?? 20;
  const cfgScale = body.cfg_scale ?? 7;

  req.log.info({ providerType, model }, "[image/generate] starting generation");

  try {
    let result: { imageUrl: string; downloadUrl: string };

    switch (providerType) {
      case "comfyui": {
        const base = baseUrl || COMFYUI_BASE;
        if (!base) throw new Error("ComfyUI base URL is not configured");
        if (!body.workflow) throw new Error("ComfyUI requires a workflow JSON");
        result = await generateComfyUI(base, body.workflow);
        break;
      }

      case "huggingface":
        if (!apiKey) throw new Error("HuggingFace requires an API key");
        result = await generateHuggingFace(apiKey, model, prompt, width, height, steps);
        break;

      case "openai":
        if (!apiKey) throw new Error("OpenAI requires an API key");
        result = await generateOpenAI(apiKey, model || "dall-e-3", prompt, width, height);
        break;

      case "stability":
        if (!apiKey) throw new Error("Stability AI requires an API key");
        result = await generateStability(apiKey, model || "stable-diffusion-xl-1024-v1-0", prompt, width, height, steps, cfgScale);
        break;

      case "fal":
        if (!apiKey) throw new Error("fal.ai requires an API key");
        result = await generateFal(apiKey, model || "fal-ai/fast-sdxl", prompt, width, height, steps);
        break;

      case "replicate":
        if (!apiKey) throw new Error("Replicate requires an API key");
        result = await generateReplicate(apiKey, model, prompt, width, height, steps);
        break;

      case "custom":
        result = await generateCustom(baseUrl, apiKey, model, prompt, width, height);
        break;

      default:
        return res.status(400).json({ ok: false, error: `Unknown provider type: ${providerType}` });
    }

    req.log.info({ providerType, model }, "[image/generate] generation successful");
    return res.json({ ok: true, imageUrl: result.imageUrl, downloadUrl: result.downloadUrl });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err: msg, providerType, model }, "[image/generate] generation failed");
    return res.status(502).json({ ok: false, error: msg });
  }
});

export default router;

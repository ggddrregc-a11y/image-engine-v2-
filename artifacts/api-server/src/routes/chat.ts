import { Router } from "express";

const router = Router();

const VISCODEV_URL = "https://viscodev.x10.mx/gpt-4o-mini/api.php";
const SUPABASE_URL = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"] ?? "";
const SUPABASE_KEY = process.env["VITE_SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";

interface ChatProvider {
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
  context?: number;
}

/** Fetch a provider from Supabase by id, or the default one if no id given */
async function getProvider(providerId?: string): Promise<ChatProvider | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const filter = providerId
      ? `id=eq.${providerId}`
      : `is_default=eq.true&enabled=eq.true`;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/chat_providers?${filter}&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" } }
    );
    if (!res.ok) return null;
    const data = await res.json() as ChatProvider[];
    return data[0] ?? null;
  } catch { return null; }
}

/** Send message to OpenAI-compatible API */
async function callOpenAICompatible(baseUrl: string, apiKey: string, model: string, message: string): Promise<string> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: "user", content: message }], max_tokens: 2048 }),
  });
  if (!res.ok) { const err = await res.text().catch(() => `HTTP ${res.status}`); throw new Error(`API error ${res.status}: ${err}`); }
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

/** Send message to Google Gemini API */
async function callGemini(apiKey: string, model: string, message: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: message }] }] }) }
  );
  if (!res.ok) { const err = await res.text().catch(() => `HTTP ${res.status}`); throw new Error(`Gemini error ${res.status}: ${err}`); }
  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

/** Fallback: viscodev proxy */
async function callViscodev(message: string): Promise<string> {
  const url = `${VISCODEV_URL}?text=${encodeURIComponent(message)}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`Viscodev error ${res.status}`);
  const data = await res.json() as { success: boolean; text?: string };
  if (!data.success) throw new Error("Viscodev returned failure");
  return data.text ?? "";
}

// Chat-capable model prefixes/patterns
const CHAT_MODEL_PATTERNS = [
  /^gpt-/i, /^o1/i, /^o3/i, /^o4/i, /^chatgpt/i,
  /llama/i, /mistral/i, /mixtral/i, /gemma/i, /qwen/i,
  /claude/i, /command/i, /falcon/i, /phi/i, /deepseek/i,
  /hermes/i, /neural/i, /openchat/i, /vicuna/i, /zephyr/i,
  /solar/i, /nous/i, /wizard/i, /dolphin/i, /orca/i,
  /openai\/gpt/i, /meta-llama/i, /google\/gemma/i,
];

const NON_CHAT_PATTERNS = [
  /embedding/i, /embed/i, /whisper/i, /tts/i, /dall-e/i,
  /image/i, /vision(?!.*instruct)/i, /audio/i, /transcri/i,
  /moderat/i, /guard/i, /classify/i, /rerank/i,
  /text-davinci-00[12]/i,
];

function isChatSupported(modelId: string, modelObject?: Record<string, unknown>): { supported: boolean; reason?: string } {
  const id = modelId.toLowerCase();

  // Check non-chat patterns first
  for (const pat of NON_CHAT_PATTERNS) {
    if (pat.test(id)) return { supported: false, reason: "Not a chat model" };
  }

  // Check known chat patterns
  for (const pat of CHAT_MODEL_PATTERNS) {
    if (pat.test(id)) return { supported: true };
  }

  // Check object type field if available
  const objType = String(modelObject?.["object"] ?? "").toLowerCase();
  if (objType === "model") {
    // Try context window as signal — chat models usually have large context
    const ctx = Number(modelObject?.["context_length"] ?? modelObject?.["context_window"] ?? 0);
    if (ctx >= 4096) return { supported: true };
  }

  return { supported: false, reason: "Unknown model type" };
}

/**
 * POST /api/chat/fetch-models
 * Body: { base_url, api_key, provider_type }
 * Returns list of models with supported/unsupported flag
 */
router.post("/chat/fetch-models", async (req, res) => {
  const { base_url, api_key, provider_type } = req.body as {
    base_url?: string;
    api_key?: string;
    provider_type?: string;
  };

  if (!base_url || !api_key) {
    return res.status(400).json({ ok: false, error: "base_url and api_key are required" });
  }

  const base = base_url.replace(/\/$/, "");

  try {
    // Gemini has a different endpoint
    if (provider_type === "gemini") {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${api_key}`
      );
      if (!r.ok) return res.status(502).json({ ok: false, error: `Gemini error: HTTP ${r.status}` });
      const data = await r.json() as { models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[] };
      const models: FetchedModel[] = (data.models ?? [])
        .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
        .map(m => ({
          id: m.name.replace("models/", ""),
          name: m.displayName ?? m.name.replace("models/", ""),
          supported: true,
          isFree: m.name.includes("flash") || m.name.includes("1.5"),
        }));
      return res.json({ ok: true, models });
    }

    // OpenAI-compatible: /v1/models
    const endpoint = `${base}/v1/models`;
    const r = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${api_key}`, "Content-Type": "application/json" },
    });

    if (!r.ok) {
      return res.status(502).json({ ok: false, error: `Provider returned HTTP ${r.status} — check Base URL and API Key` });
    }

    const data = await r.json() as { data?: Record<string, unknown>[] };
    const rawModels = data.data ?? [];

    const models: FetchedModel[] = rawModels.map((m) => {
      const id = String(m["id"] ?? "");
      const { supported, reason } = isChatSupported(id, m);

      // OpenRouter pricing field
      let isFree = false;
      const pricing = m["pricing"] as Record<string, unknown> | undefined;
      if (pricing) {
        const promptPrice = parseFloat(String(pricing["prompt"] ?? "1"));
        isFree = promptPrice === 0;
      }

      return {
        id,
        name: String(m["name"] ?? id),
        supported,
        reason,
        isFree,
        context: Number(m["context_length"] ?? m["context_window"] ?? 0) || undefined,
      };
    });

    // Sort: supported first, then free, then by name
    models.sort((a, b) => {
      if (a.supported !== b.supported) return a.supported ? -1 : 1;
      if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
      return a.id.localeCompare(b.id);
    });

    return res.json({ ok: true, models, total: models.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ ok: false, error: `Failed to fetch models: ${msg}` });
  }
});

/**
 * GET /api/chat/providers
 * Returns all enabled chat providers for the frontend selector
 */
router.get("/chat/providers", async (_req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.json({ ok: true, providers: [{ id: "viscodev", name: "GPT-4o Mini (Default)", model_name: "gpt-4o-mini" }] });
  }
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/chat_providers?enabled=eq.true&select=id,name,model_name,is_default&order=is_default.desc`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (!r.ok) throw new Error("Supabase error");
    const data = await r.json() as ChatProvider[];
    if (!data || data.length === 0) {
      return res.json({ ok: true, providers: [{ id: "viscodev", name: "GPT-4o Mini (Default)", model_name: "gpt-4o-mini" }] });
    }
    return res.json({ ok: true, providers: data });
  } catch {
    return res.json({ ok: true, providers: [{ id: "viscodev", name: "GPT-4o Mini (Default)", model_name: "gpt-4o-mini" }] });
  }
});

/**
 * POST /api/chat
 * Body: { message: string, providerId?: string }
 */
router.post("/chat", async (req, res) => {
  const { message, providerId } = req.body as { message?: string; providerId?: string };
  if (!message || !message.trim()) return res.status(400).json({ ok: false, error: "message is required" });

  if (!providerId || providerId === "viscodev") {
    try { return res.json({ ok: true, reply: await callViscodev(message.trim()) }); }
    catch (err) { return res.status(502).json({ ok: false, error: String(err) }); }
  }

  const provider = await getProvider(providerId);
  if (!provider) {
    try { return res.json({ ok: true, reply: await callViscodev(message.trim()) }); }
    catch (err) { return res.status(502).json({ ok: false, error: String(err) }); }
  }

  try {
    const reply = provider.provider_type === "gemini"
      ? await callGemini(provider.api_key, provider.model_name, message.trim())
      : await callOpenAICompatible(provider.base_url, provider.api_key, provider.model_name, message.trim());
    req.log.info({ provider: provider.name, model: provider.model_name }, "[chat] reply received");
    return res.json({ ok: true, reply });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err: msg }, "[chat] provider request failed");
    return res.status(502).json({ ok: false, error: `Chat API error: ${msg}` });
  }
});

export default router;

const router = Router();

const VISCODEV_URL = "https://viscodev.x10.mx/gpt-4o-mini/api.php";
const SUPABASE_URL = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"] ?? "";
const SUPABASE_KEY = process.env["VITE_SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";

interface ChatProvider {
  id: string;
  name: string;
  provider_type: string;
  base_url: string;
  api_key: string;
  model_name: string;
  enabled: boolean;
  is_default: boolean;
}

/** Fetch a provider from Supabase by id, or the default one if no id given */
async function getProvider(providerId?: string): Promise<ChatProvider | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;

  try {
    const filter = providerId
      ? `id=eq.${providerId}`
      : `is_default=eq.true&enabled=eq.true`;

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/chat_providers?${filter}&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as ChatProvider[];
    return data[0] ?? null;
  } catch {
    return null;
  }
}

/** Send message to OpenAI-compatible API (OpenAI, Groq, OpenRouter, Custom) */
async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  message: string
): Promise<string> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: message }],
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`API error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

/** Send message to Google Gemini API */
async function callGemini(
  apiKey: string,
  model: string,
  message: string
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: message }] }],
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

/** Fallback: viscodev proxy (no API key needed) */
async function callViscodev(message: string): Promise<string> {
  const url = `${VISCODEV_URL}?text=${encodeURIComponent(message)}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`Viscodev error ${res.status}`);
  const data = await res.json() as { success: boolean; text?: string };
  if (!data.success) throw new Error("Viscodev returned failure");
  return data.text ?? "";
}

/**
 * GET /api/chat/providers
 * Returns all enabled chat providers (name, id, model_name) for the frontend selector
 */
router.get("/chat/providers", async (_req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.json({
      ok: true,
      providers: [{ id: "viscodev", name: "GPT-4o Mini (Default)", model_name: "gpt-4o-mini" }],
    });
  }

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/chat_providers?enabled=eq.true&select=id,name,model_name,is_default&order=is_default.desc`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    if (!r.ok) throw new Error("Supabase error");
    const data = await r.json() as ChatProvider[];

    if (!data || data.length === 0) {
      return res.json({
        ok: true,
        providers: [{ id: "viscodev", name: "GPT-4o Mini (Default)", model_name: "gpt-4o-mini" }],
      });
    }

    return res.json({ ok: true, providers: data });
  } catch {
    return res.json({
      ok: true,
      providers: [{ id: "viscodev", name: "GPT-4o Mini (Default)", model_name: "gpt-4o-mini" }],
    });
  }
});

/**
 * POST /api/chat
 * Body: { message: string, providerId?: string }
 */
router.post("/chat", async (req, res) => {
  const { message, providerId } = req.body as {
    message?: string;
    providerId?: string;
  };

  if (!message || !message.trim()) {
    return res.status(400).json({ ok: false, error: "message is required" });
  }

  // viscodev fallback when no provider specified or Supabase not configured
  if (!providerId || providerId === "viscodev") {
    try {
      const reply = await callViscodev(message.trim());
      return res.json({ ok: true, reply });
    } catch (err) {
      return res.status(502).json({ ok: false, error: String(err) });
    }
  }

  // Get provider from Supabase
  const provider = await getProvider(providerId);

  if (!provider) {
    // Fallback to viscodev
    try {
      const reply = await callViscodev(message.trim());
      return res.json({ ok: true, reply });
    } catch (err) {
      return res.status(502).json({ ok: false, error: String(err) });
    }
  }

  try {
    let reply = "";

    if (provider.provider_type === "gemini") {
      reply = await callGemini(provider.api_key, provider.model_name, message.trim());
    } else {
      // openai / groq / openrouter / custom — all OpenAI-compatible
      reply = await callOpenAICompatible(
        provider.base_url,
        provider.api_key,
        provider.model_name,
        message.trim()
      );
    }

    req.log.info({ provider: provider.name, model: provider.model_name }, "[chat] reply received");
    return res.json({ ok: true, reply });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err: msg }, "[chat] provider request failed");
    return res.status(502).json({ ok: false, error: `Chat API error: ${msg}` });
  }
});

export default router;

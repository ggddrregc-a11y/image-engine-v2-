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

async function callOpenAICompatible(baseUrl: string, apiKey: string, model: string, message: string, attachments?: { data: string; mimeType: string; name: string }[], history?: { role: string; content: string }[]): Promise<string> {
  // بناء الـ content للرسالة الحالية
  let content: unknown;
  if (attachments && attachments.length > 0) {
    const parts: unknown[] = [];
    for (const att of attachments) {
      if (att.mimeType.startsWith("image/")) {
        parts.push({ type: "image_url", image_url: { url: `data:${att.mimeType};base64,${att.data}` } });
      } else {
        try {
          const decoded = Buffer.from(att.data, "base64").toString("utf-8");
          parts.push({ type: "text", text: `[ملف: ${att.name}]\n${decoded}` });
        } catch {
          parts.push({ type: "text", text: `[ملف: ${att.name} — لا يمكن قراءة محتواه]` });
        }
      }
    }
    if (message.trim()) parts.push({ type: "text", text: message });
    content = parts;
  } else {
    content = message;
  }

  // بناء قائمة الرسائل مع التاريخ
  const messages: { role: string; content: unknown }[] = [
    ...(history ?? []).map(h => ({ role: h.role, content: h.content })),
    { role: "user", content },
  ];

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: 4096 }),
  });
  if (!res.ok) { const err = await res.text().catch(() => `HTTP ${res.status}`); throw new Error(`API error ${res.status}: ${err}`); }
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGemini(apiKey: string, model: string, message: string, attachments?: { data: string; mimeType: string; name: string }[], history?: { role: string; content: string }[]): Promise<string> {
  const parts: unknown[] = [];

  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      if (att.mimeType.startsWith("image/") || att.mimeType === "application/pdf") {
        parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
      } else {
        try {
          const decoded = Buffer.from(att.data, "base64").toString("utf-8");
          parts.push({ text: `[ملف: ${att.name}]\n${decoded}` });
        } catch {
          parts.push({ text: `[ملف: ${att.name} — لا يمكن قراءة محتواه]` });
        }
      }
    }
  }

  if (message.trim()) parts.push({ text: message });

  // بناء الـ contents مع التاريخ — Gemini يستخدم "model" بدل "assistant"
  const contents: { role: string; parts: unknown[] }[] = [
    ...(history ?? []).map(h => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }],
    })),
    { role: "user", parts },
  ];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents }) }
  );
  if (!res.ok) { const err = await res.text().catch(() => `HTTP ${res.status}`); throw new Error(`Gemini error ${res.status}: ${err}`); }
  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callViscodev(message: string): Promise<string> {
  const url = `${VISCODEV_URL}?text=${encodeURIComponent(message)}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`Viscodev error ${res.status}`);
  const data = await res.json() as { success: boolean; text?: string };
  if (!data.success) throw new Error("Viscodev returned failure");
  return data.text ?? "";
}

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
  /image/i, /audio/i, /transcri/i, /moderat/i, /guard/i,
  /classify/i, /rerank/i, /text-davinci-00[12]/i,
];

function isChatSupported(modelId: string, modelObject?: Record<string, unknown>): { supported: boolean; reason?: string } {
  const id = modelId.toLowerCase();
  for (const pat of NON_CHAT_PATTERNS) {
    if (pat.test(id)) return { supported: false, reason: "Not a chat model" };
  }
  for (const pat of CHAT_MODEL_PATTERNS) {
    if (pat.test(id)) return { supported: true };
  }
  const ctx = Number(modelObject?.["context_length"] ?? modelObject?.["context_window"] ?? 0);
  if (ctx >= 4096) return { supported: true };
  return { supported: false, reason: "Unknown model type" };
}

/* ─── Session helpers ────────────────────────────────────────────── */

async function supabaseFetch(path: string, options: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
}

/**
 * GET /api/chat/sessions — جلب كل الجلسات مرتبة من الأحدث
 */
router.get("/chat/sessions", async (_req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.json({ ok: true, sessions: [] });
  try {
    const r = await supabaseFetch("/chat_sessions?select=id,title,created_at,updated_at&order=updated_at.desc");
    if (!r.ok) throw new Error(`Supabase error ${r.status}`);
    const data = await r.json();
    return res.json({ ok: true, sessions: data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/**
 * POST /api/chat/sessions — إنشاء جلسة جديدة
 * body: { title: string }
 */
router.post("/chat/sessions", async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ ok: false, error: "Supabase not configured" });
  const { title } = req.body as { title?: string };
  try {
    const r = await supabaseFetch("/chat_sessions", {
      method: "POST",
      body: JSON.stringify({ title: title?.trim() || "محادثة جديدة" }),
    });
    if (!r.ok) throw new Error(`Supabase error ${r.status}`);
    const data = await r.json();
    const session = Array.isArray(data) ? data[0] : data;
    return res.json({ ok: true, session });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/**
 * DELETE /api/chat/sessions/:id — حذف جلسة (والرسائل بتاعتها cascade)
 */
router.delete("/chat/sessions/:id", async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ ok: false, error: "Supabase not configured" });
  const { id } = req.params;
  try {
    const r = await supabaseFetch(`/chat_sessions?id=eq.${id}`, { method: "DELETE" });
    if (!r.ok) throw new Error(`Supabase error ${r.status}`);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/**
 * GET /api/chat/sessions/:id/messages — جلب رسائل جلسة معينة
 */
router.get("/chat/sessions/:id/messages", async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.json({ ok: true, messages: [] });
  const { id } = req.params;
  try {
    const r = await supabaseFetch(`/chat_messages?session_id=eq.${id}&order=created_at.asc&select=id,role,content,created_at`);
    if (!r.ok) throw new Error(`Supabase error ${r.status}`);
    const data = await r.json();
    return res.json({ ok: true, messages: data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/**
 * POST /api/chat/sessions/:id/messages — حفظ رسالة في جلسة
 * body: { role: 'user'|'assistant', content: string }
 */
router.post("/chat/sessions/:id/messages", async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ ok: false, error: "Supabase not configured" });
  const { id } = req.params;
  const { role, content } = req.body as { role?: string; content?: string };
  try {
    // حفظ الرسالة
    const r = await supabaseFetch("/chat_messages", {
      method: "POST",
      body: JSON.stringify({ session_id: id, role, content }),
    });
    if (!r.ok) throw new Error(`Supabase error ${r.status}`);
    const data = await r.json();
    const message = Array.isArray(data) ? data[0] : data;
    // تحديث updated_at للـ session
    await supabaseFetch(`/chat_sessions?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ updated_at: new Date().toISOString() }),
    });
    return res.json({ ok: true, message });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/**
 * POST /api/chat/fetch-models
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
    if (provider_type === "gemini") {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${api_key}`);
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

    const r = await fetch(`${base}/v1/models`, {
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
 */
router.get("/chat/providers", async (_req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.json({ ok: true, providers: [] });
  }
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/chat_providers?enabled=eq.true&select=id,name,model_name,is_default&order=is_default.desc`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (!r.ok) throw new Error("Supabase error");
    const data = await r.json() as ChatProvider[];
    // Filter out viscodev — it works as a fallback, not a selectable provider
    const filtered = (data ?? []).filter(p => !p.base_url?.includes("viscodev.x10.mx"));
    return res.json({ ok: true, providers: filtered });
  } catch {
    return res.json({ ok: true, providers: [] });
  }
});

/**
 * POST /api/chat
 */
router.post("/chat", async (req, res) => {
  const { message, providerId, attachments, history } = req.body as {
    message?: string;
    providerId?: string;
    attachments?: { data: string; mimeType: string; name: string }[];
    history?: { role: string; content: string }[];
  };
  if (!message?.trim() && (!attachments || attachments.length === 0)) {
    return res.status(400).json({ ok: false, error: "message or attachment is required" });
  }

  const msg = message?.trim() ?? "";

  if (!providerId || providerId === "viscodev") {
    try { return res.json({ ok: true, reply: await callViscodev(msg) }); }
    catch (err) { return res.status(502).json({ ok: false, error: String(err) }); }
  }

  const provider = await getProvider(providerId);
  if (!provider || provider.base_url.includes("viscodev.x10.mx")) {
    try { return res.json({ ok: true, reply: await callViscodev(msg) }); }
    catch (err) { return res.status(502).json({ ok: false, error: String(err) }); }
  }

  try {
    let reply = "";
    if (provider.base_url.includes("viscodev.x10.mx")) {
      const url = `${provider.base_url.replace(/\/$/, "")}?text=${encodeURIComponent(msg)}`;
      const r = await fetch(url, { method: "GET" });
      if (!r.ok) throw new Error(`Viscodev error ${r.status}`);
      const d = await r.json() as { success: boolean; text?: string; reply?: string };
      if (!d.success) throw new Error("Viscodev returned failure");
      reply = d.text ?? d.reply ?? "";
    } else if (provider.provider_type === "gemini") {
      reply = await callGemini(provider.api_key, provider.model_name, msg, attachments, history);
    } else {
      reply = await callOpenAICompatible(provider.base_url, provider.api_key, provider.model_name, msg, attachments, history);
    }
    req.log.info({ provider: provider.name, model: provider.model_name }, "[chat] reply received");
    return res.json({ ok: true, reply });
  } catch (err) {
    const msg2 = err instanceof Error ? err.message : String(err);
    req.log.error({ err: msg2 }, "[chat] provider request failed");
    return res.status(502).json({ ok: false, error: `Chat API error: ${msg2}` });
  }
});

export default router;

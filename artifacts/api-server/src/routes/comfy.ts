import { Router } from "express";

const router = Router();

const getBase = () => (process.env["COMFYUI_BASE_URL"] ?? "").replace(/\/$/, "");

const parseJson = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

/**
 * POST /api/comfy/generate
 *
 * Direct proxy to COMFYUI_BASE_URL/prompt. Safely handles a `prompt` field
 * that may arrive as a stringified JSON string (preventing double-stringification).
 */
router.post("/comfy/generate", async (req, res) => {
  const base = getBase();
  if (!base) {
    return res.status(500).json({ error: "COMFYUI_BASE_URL is not configured" });
  }

  const body = req.body as unknown;

  try {
    const promptBody = parseJson(body);
    const rawPrompt =
      promptBody !== null &&
      typeof promptBody === "object" &&
      "prompt" in (promptBody as object)
        ? (promptBody as Record<string, unknown>).prompt
        : promptBody;
    const parsedPrompt = parseJson(rawPrompt);
    const payload = { prompt: parsedPrompt };

    req.log.info({ base }, "[comfy/generate] sending payload to /prompt");

    const comfyRes = await fetch(`${base}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const contentType = comfyRes.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = await comfyRes.json();
      return res.status(comfyRes.ok ? 200 : 502).json({ ok: comfyRes.ok, data: json });
    }
    const text = await comfyRes.text();
    return res.status(comfyRes.ok ? 200 : 502).json({ ok: comfyRes.ok, data: text });
  } catch (err) {
    return res.status(502).json({ error: String(err) });
  }
});

/**
 * GET /api/comfy/check
 *
 * Checks connectivity to the ComfyUI instance by calling /system_stats.
 */
router.get("/comfy/check", async (req, res) => {
  const base = getBase();
  if (!base) {
    return res.status(500).json({ error: "COMFYUI_BASE_URL is not configured" });
  }

  try {
    const comfyRes = await fetch(`${base}/system_stats`, { method: "GET" });
    const contentType = comfyRes.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = await comfyRes.json();
      return res.status(comfyRes.ok ? 200 : 502).json({ ok: comfyRes.ok, data: json });
    }
    const text = await comfyRes.text();
    return res.status(comfyRes.ok ? 200 : 502).json({ ok: comfyRes.ok, data: text });
  } catch (err) {
    return res.status(502).json({ error: String(err) });
  }
});

export default router;

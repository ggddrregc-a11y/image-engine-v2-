import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

const getBase = () => (process.env["COMFYUI_BASE_URL"] ?? "").replace(/\/$/, "");

/**
 * POST /api/generate
 *
 * Safely proxies a ComfyUI workflow to COMFYUI_BASE_URL/prompt.
 * The `prompt` field in the request body must be a ComfyUI workflow JSON object.
 * If it arrives as a stringified JSON string it is parsed automatically.
 */
router.post("/generate", async (req, res) => {
  const base = getBase();
  if (!base) {
    return res.status(500).json({ error: "COMFYUI_BASE_URL is not configured on the server" });
  }

  const body = req.body as { prompt?: unknown };

  if (body.prompt === undefined || body.prompt === null) {
    return res.status(400).json({ error: "Missing required field: prompt" });
  }

  // Safely parse the prompt — handles both a JSON object and a double-stringified string
  let parsedPrompt: unknown;
  try {
    parsedPrompt =
      typeof body.prompt === "string" ? JSON.parse(body.prompt) : body.prompt;
  } catch (err) {
    return res.status(400).json({
      error: "Invalid prompt: must be a ComfyUI workflow JSON object or a valid JSON string",
      detail: String(err),
    });
  }

  if (typeof parsedPrompt !== "object" || parsedPrompt === null) {
    return res.status(400).json({
      error: "Invalid prompt: must resolve to a JSON object (ComfyUI workflow node map)",
    });
  }

  try {
    req.log.info({ base }, "[generate] forwarding to ComfyUI /prompt");

    const comfyRes = await fetch(`${base}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Send { prompt: <workflowNodeMap> } — exactly what ComfyUI's /prompt endpoint expects
      body: JSON.stringify({ prompt: parsedPrompt }),
    });

    const contentType = comfyRes.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = await comfyRes.json();
      return res.status(comfyRes.ok ? 200 : 502).json({ ok: comfyRes.ok, data: json });
    }

    const text = await comfyRes.text();
    return res.status(comfyRes.ok ? 200 : 502).json({ ok: comfyRes.ok, data: text });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ err: message }, "[generate] ComfyUI request failed");
    return res.status(502).json({ error: `ComfyUI unreachable: ${message}` });
  }
});

export default router;

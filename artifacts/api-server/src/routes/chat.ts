import { Router } from "express";

const router = Router();

const CHAT_API_URL = "https://viscodev.x10.mx/gpt-4o-mini/api.php";

/**
 * POST /api/chat
 *
 * Proxies a user message to the Claude Sonnet 5 external API and returns the reply.
 * Body: { message: string }
 * Response: { ok: true, reply: string } | { ok: false, error: string }
 */
router.post("/chat", async (req, res) => {
  const { message } = req.body as { message?: string };

  if (!message || !message.trim()) {
    return res.status(400).json({ ok: false, error: "message is required" });
  }

  try {
    req.log.info({ url: CHAT_API_URL }, "[chat] sending message to Claude API");

    const url = `${CHAT_API_URL}?text=${encodeURIComponent(message.trim())}`;
    const response = await fetch(url, { method: "GET" });

    if (!response.ok) {
      const text = await response.text().catch(() => "unknown error");
      req.log.error({ status: response.status }, "[chat] API returned error");
      return res.status(502).json({ ok: false, error: `Chat API error: ${response.status} — ${text}` });
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      req.log.error({ contentType }, "[chat] API returned non-JSON");
      return res.status(503).json({ ok: false, error: "Service unavailable. Try again later." });
    }

    const data = await response.json() as { success: boolean; text?: string; error?: string };

    if (!data.success) {
      return res.status(422).json({ ok: false, error: data.error ?? "Chat API returned failure" });
    }

    req.log.info("[chat] reply received successfully");
    return res.json({ ok: true, reply: data.text ?? "" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ err: message }, "[chat] request failed");
    return res.status(502).json({ ok: false, error: `Chat API unreachable: ${message}` });
  }
});

export default router;

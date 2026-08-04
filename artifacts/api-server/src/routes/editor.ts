import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

/**
 * POST /api/edit
 *
 * Proxies an image editing request to the external AI editing API.
 * Accepts: { text: string, imageUrl: string, width?: number, height?: number }
 * Returns: { ok: boolean, imageUrl?: string, imageData?: string, error?: string }
 */
router.post("/edit", async (req, res) => {
  const { text, imageUrl, width, height } = req.body as {
    text: string;
    imageUrl: string;
    width?: number;
    height?: number;
  };

  if (!text || !imageUrl) {
    return res.status(400).json({ ok: false, error: "text and imageUrl are required" });
  }

  // Get API URL from env or use default
  const apiUrl = process.env["IMAGE_EDITOR_API_URL"] ?? "https://viscodev.x10.mx/img_editing/api.php";

  try {
    req.log.info({ apiUrl, width, height }, "[edit] sending request to image editor API");

    const payload: Record<string, unknown> = { text, links: imageUrl };
    if (width) payload.width = width;
    if (height) payload.height = height;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "unknown error");
      req.log.error({ status: response.status, errText }, "[edit] API returned error");
      return res.status(502).json({ ok: false, error: `Editor API error: ${response.status}` });
    }

    const result = await response.json() as Record<string, unknown>;

    if (!result.success) {
      return res.status(422).json({ ok: false, error: (result.error as string) ?? "Editing failed" });
    }

    // Return image data or URL
    if (result.image_data) {
      // Convert base64 to image URL via our server
      const base64 = result.image_data as string;
      const buffer = Buffer.from(base64, "base64");
      res.setHeader("Content-Type", "image/png");
      res.setHeader("X-Image-Result", "base64");
      return res.json({ ok: true, imageData: base64 });
    }

    if (result.image_url) {
      return res.json({ ok: true, imageUrl: result.image_url });
    }

    return res.status(422).json({ ok: false, error: "No image in response" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ err: message }, "[edit] request failed");
    return res.status(502).json({ ok: false, error: `Editor unreachable: ${message}` });
  }
});

export default router;

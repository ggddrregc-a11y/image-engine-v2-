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

    // If imageUrl is a base64 data URL, upload it to a temporary host first
    let resolvedImageUrl = imageUrl;

    if (imageUrl.startsWith("data:image")) {
      // Extract base64 content and upload to tmpfiles.org
      const base64Match = imageUrl.match(/^data:image\/\w+;base64,(.+)$/);
      if (!base64Match) {
        return res.status(400).json({ ok: false, error: "Invalid image data" });
      }
      const base64Data = base64Match[1];
      const buffer = Buffer.from(base64Data, "base64");

      // Upload to tmpfiles.org (free, no auth needed)
      const formData = new FormData();
      const blob = new Blob([buffer], { type: "image/png" });
      formData.append("file", blob, "image.png");

      const uploadRes = await fetch("https://tmpfiles.org/api/v1/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        return res.status(502).json({ ok: false, error: "Failed to upload image for processing" });
      }

      const uploadData = await uploadRes.json() as { data?: { url?: string } };
      const tmpUrl = uploadData?.data?.url;
      if (!tmpUrl) {
        return res.status(502).json({ ok: false, error: "Failed to get upload URL" });
      }

      // tmpfiles.org returns https://tmpfiles.org/XXXXXX/image.png
      // direct download link is https://tmpfiles.org/dl/XXXXXX/image.png
      resolvedImageUrl = tmpUrl.replace("tmpfiles.org/", "tmpfiles.org/dl/");
      req.log.info({ resolvedImageUrl }, "[edit] uploaded base64 image to temp host");
    }

    const payload: Record<string, unknown> = { text, links: resolvedImageUrl };
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
      return res.json({ ok: true, imageData: result.image_data as string });
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

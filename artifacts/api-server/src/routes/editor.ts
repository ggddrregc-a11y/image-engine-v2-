import { Router } from "express";
import https from "https";
import http from "http";

const router = Router();

/**
 * Makes an HTTP/HTTPS POST request ignoring SSL errors (like Python's verify=False).
 */
function postJson(url: string, body: string, timeoutMs: number): Promise<{ status: number; contentType: string; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === "https:";
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
      // Disable SSL verification — same as Python's verify=False
      rejectUnauthorized: false,
    };

    const lib = isHttps ? https : http;
    const req = lib.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode ?? 0,
          contentType: (res.headers["content-type"] as string) ?? "",
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

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

  const apiUrl = process.env["IMAGE_EDITOR_API_URL"] ?? "https://viscodev.x10.mx/img_editing/api.php";

  try {
    req.log.info({ apiUrl, width, height }, "[edit] sending request to image editor API");

    // If imageUrl is a base64 data URL, upload it to a temporary host first
    let resolvedImageUrl = imageUrl;

    if (imageUrl.startsWith("data:image")) {
      const base64Match = imageUrl.match(/^data:image\/\w+;base64,(.+)$/);
      if (!base64Match) {
        return res.status(400).json({ ok: false, error: "Invalid image data" });
      }
      const base64Data = base64Match[1];
      const buffer = Buffer.from(base64Data, "base64");

      const formData = new FormData();
      const blob = new Blob([buffer], { type: "image/png" });
      formData.append("file", blob, "image.png");

      const uploadRes = await fetch("https://0x0.st", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        return res.status(502).json({ ok: false, error: "Failed to upload image for processing" });
      }

      resolvedImageUrl = (await uploadRes.text()).trim();
      if (!resolvedImageUrl.startsWith("http")) {
        return res.status(502).json({ ok: false, error: "Failed to get upload URL" });
      }

      req.log.info({ resolvedImageUrl }, "[edit] uploaded base64 image to 0x0.st");
      req.log.info({ resolvedImageUrl }, "[edit] uploaded base64 image to temp host");
    }

    const payload: Record<string, unknown> = { text, links: resolvedImageUrl };
    if (width) payload.width = width;
    if (height) payload.height = height;

    const jsonBody = JSON.stringify(payload);

    req.log.info({ resolvedImageUrl }, "[edit] calling viscodev API");

    const response = await postJson(apiUrl, jsonBody, 120000);

    if (response.status < 200 || response.status >= 300) {
      req.log.error({ status: response.status }, "[edit] API returned error");
      return res.status(502).json({ ok: false, error: `Editor API error: ${response.status}` });
    }

    if (!response.contentType.includes("application/json")) {
      req.log.error({ contentType: response.contentType }, "[edit] API returned non-JSON (likely bot protection)");
      return res.status(503).json({ ok: false, error: "Service unavailable. Try again later." });
    }

    const result = JSON.parse(response.body) as Record<string, unknown>;

    if (!result.success) {
      return res.status(422).json({ ok: false, error: (result.error as string) ?? "Editing failed" });
    }

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

import { Router } from "express";
import https from "https";
import http from "http";
import crypto from "crypto";

const router = Router();

// In-memory temp image store: token -> { buffer, expires }
const _tmpImages = new Map<string, { buffer: Buffer; expires: number }>();

// Cleanup expired images every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of _tmpImages) {
    if (val.expires < now) _tmpImages.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * GET /api/tmp/:token — serves a temporarily stored image
 */
router.get("/tmp/:token", (req, res) => {
  const entry = _tmpImages.get(req.params.token);
  if (!entry || entry.expires < Date.now()) {
    return res.status(404).send("Not found");
  }
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "no-store");
  return res.send(entry.buffer);
});

/**
 * POST request with SSL verification disabled (equivalent to Python's verify=False).
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

  // Determine the public base URL of this server
  const host = process.env["PUBLIC_URL"] ?? `https://${req.headers.host}`;

  try {
    req.log.info({ apiUrl, width, height }, "[edit] sending request to image editor API");

    let resolvedImageUrl = imageUrl;

    if (imageUrl.startsWith("data:image")) {
      const base64Match = imageUrl.match(/^data:image\/\w+;base64,(.+)$/);
      if (!base64Match) {
        return res.status(400).json({ ok: false, error: "Invalid image data" });
      }
      const buffer = Buffer.from(base64Match[1], "base64");

      // Store image in memory and expose it via /api/tmp/:token
      const token = crypto.randomBytes(16).toString("hex");
      _tmpImages.set(token, { buffer, expires: Date.now() + 10 * 60 * 1000 }); // 10 min TTL

      resolvedImageUrl = `${host}/api/tmp/${token}`;
      req.log.info({ resolvedImageUrl }, "[edit] stored image temporarily on server");
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
      req.log.error({ contentType: response.contentType }, "[edit] API returned non-JSON");
      return res.status(503).json({ ok: false, error: "Service unavailable. Try again later." });
    }

    const result = JSON.parse(response.body) as Record<string, unknown>;

    req.log.info({ success: result.success, hasImageData: !!result.image_data, imageUrl: result.image_url }, "[edit] API response");

    if (!result.success) {
      return res.status(422).json({ ok: false, error: (result.error as string) ?? "Editing failed" });
    }

    if (result.image_data) {
      return res.json({ ok: true, imageData: result.image_data as string });
    }

    if (result.image_url) {
      // Download the image and return it as base64 to avoid CORS issues on the frontend
      try {
        const imgUrl = result.image_url as string;
        const imgResponse = await postJson(imgUrl, "", 30000).catch(() => null);
        // postJson is for POST only — use https.get instead
        const imgBase64 = await new Promise<string>((resolve, reject) => {
          const parsed = new URL(imgUrl);
          const lib = parsed.protocol === "https:" ? https : http;
          lib.get({ hostname: parsed.hostname, path: parsed.pathname + parsed.search, rejectUnauthorized: false }, (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (c: Buffer) => chunks.push(c));
            res.on("end", () => resolve(Buffer.concat(chunks).toString("base64")));
          }).on("error", reject);
        });
        return res.json({ ok: true, imageData: imgBase64 });
      } catch {
        return res.json({ ok: true, imageUrl: result.image_url });
      }
    }

    return res.status(422).json({ ok: false, error: "No image in response" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ err: message }, "[edit] request failed");
    return res.status(502).json({ ok: false, error: `Editor unreachable: ${message}` });
  }
});

export default router;

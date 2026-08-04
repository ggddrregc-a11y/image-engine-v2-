import { Router } from "express";
import https from "https";
import http from "http";

const router = Router();

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
 * Upload buffer to catbox.moe and return direct URL.
 */
async function uploadToCatbox(buffer: Buffer): Promise<string> {
  const boundary = `----FormBoundary${Date.now()}`;
  const filename = "image.png";
  const contentType = "image/png";

  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="reqtype"\r\n\r\nfileupload\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="fileToUpload"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "catbox.moe",
      port: 443,
      path: "/user/api.php",
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": body.length,
      },
      rejectUnauthorized: false,
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8").trim();
        if (text.startsWith("http")) {
          resolve(text);
        } else {
          reject(new Error(`catbox.moe returned: ${text}`));
        }
      });
    });

    req.setTimeout(30000, () => { req.destroy(); reject(new Error("catbox upload timeout")); });
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

  try {
    req.log.info({ apiUrl, width, height }, "[edit] sending request to image editor API");

    let resolvedImageUrl = imageUrl;

    if (imageUrl.startsWith("data:image")) {
      const base64Match = imageUrl.match(/^data:image\/\w+;base64,(.+)$/);
      if (!base64Match) {
        return res.status(400).json({ ok: false, error: "Invalid image data" });
      }
      const buffer = Buffer.from(base64Match[1], "base64");

      try {
        resolvedImageUrl = await uploadToCatbox(buffer);
        req.log.info({ resolvedImageUrl }, "[edit] uploaded to catbox.moe");
      } catch (uploadErr) {
        const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
        req.log.error({ err: msg }, "[edit] catbox upload failed");
        return res.status(502).json({ ok: false, error: "Failed to upload image for processing" });
      }
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

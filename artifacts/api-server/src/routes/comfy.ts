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
 * Proxies a ComfyUI workflow, waits for completion via polling, and returns the image URL.
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

    // Step 1: Submit the prompt to ComfyUI
    const comfyRes = await fetch(`${base}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!comfyRes.ok) {
      const text = await comfyRes.text().catch(() => "unknown error");
      return res.status(502).json({ error: `ComfyUI rejected prompt: ${text}` });
    }

    const comfyData = await comfyRes.json() as { prompt_id?: string };
    const promptId = comfyData.prompt_id;

    if (!promptId) {
      return res.status(502).json({ error: "ComfyUI did not return a prompt_id", data: comfyData });
    }

    req.log.info({ promptId }, "[comfy/generate] prompt queued, polling for result...");

    // Step 2: Poll /history/{prompt_id} until done (max 5 minutes)
    const maxAttempts = 300; // 300 * 1s = 5 min
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 1000));

      const histRes = await fetch(`${base}/history/${promptId}`);
      if (!histRes.ok) continue;

      const hist = await histRes.json() as Record<string, unknown>;
      const entry = hist[promptId] as Record<string, unknown> | undefined;
      if (!entry) continue;

      const outputs = entry.outputs as Record<string, unknown> | undefined;
      if (!outputs) continue;

      // Find first image in outputs
      for (const nodeOutput of Object.values(outputs)) {
        const node = nodeOutput as { images?: Array<{ filename: string; subfolder: string; type: string }> };
        if (node.images && node.images.length > 0) {
          const img = node.images[0];
          const imageUrl = `${base}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${encodeURIComponent(img.type)}`;
          const downloadUrl = `/api/comfy/image?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${encodeURIComponent(img.type)}`;
          req.log.info({ imageUrl }, "[comfy/generate] image ready");
          return res.json({ ok: true, promptId, imageUrl, downloadUrl });
        }
      }
    }

    return res.status(504).json({ error: "Timed out waiting for ComfyUI to finish" });
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

router.get("/comfy/image", async (req, res) => {
  const base = getBase();
  if (!base) {
    return res.status(500).json({ error: "COMFYUI_BASE_URL is not configured" });
  }

  const { filename, subfolder, type } = req.query as Record<string, string>;
  if (!filename) {
    return res.status(400).json({ error: "filename is required" });
  }

  try {
    const url = `${base}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder ?? "")}&type=${encodeURIComponent(type ?? "output")}`;
    const imgRes = await fetch(url);
    if (!imgRes.ok) {
      return res.status(502).json({ error: `ComfyUI returned ${imgRes.status}` });
    }
    const contentType = imgRes.headers.get("content-type") ?? "image/png";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    const buffer = await imgRes.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (err) {
    return res.status(502).json({ error: String(err) });
  }
});

export default router;

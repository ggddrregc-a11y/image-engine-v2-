import { Router } from "express";
import { extractSingleVideo, extractPageVideos } from "./extractor.js";

const router = Router();

const SUPABASE_URL = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"] ?? "";
const SUPABASE_KEY = process.env["VITE_SUPABASE_SERVICE_KEY"] ?? process.env["SUPABASE_SERVICE_KEY"] ??
  process.env["VITE_SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";

/* ─── Supabase helper ───────────────────────────────────────────── */
async function sbFetch(path: string, options: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
}

/* ─── GET /api/videos ─────────────────────────────────────────── */
router.get("/videos", async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.json({ ok: true, videos: [], total: 0 });

  const search = String(req.query["search"] ?? "").trim();
  const page = Math.max(1, parseInt(String(req.query["page"] ?? "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query["limit"] ?? "20"), 10)));
  const offset = (page - 1) * limit;

  let filter = "order=published_at.desc.nullslast";
  if (search) {
    const encoded = encodeURIComponent(`%${search}%`);
    filter += `&title=ilike.${encoded}`;
  }
  filter += `&limit=${limit}&offset=${offset}`;

  try {
    const [dataRes, countRes] = await Promise.all([
      sbFetch(`/page_videos?select=id,fb_video_id,title,thumbnail_url,published_at,duration_seconds,post_url,download_formats&${filter}`),
      sbFetch(`/page_videos?select=id&${search ? `title=ilike.${encodeURIComponent(`%${search}%`)}&` : ""}limit=1`, {
        headers: { Prefer: "count=exact" },
      }),
    ]);

    if (!dataRes.ok) throw new Error(`Supabase error ${dataRes.status}`);
    const videos = await dataRes.json();
    const totalHeader = countRes.headers.get("content-range");
    const total = totalHeader ? parseInt(totalHeader.split("/")[1] ?? "0", 10) : 0;

    return res.json({ ok: true, videos, total, page, limit });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ─── GET /api/videos/stats ───────────────────────────────────── */
router.get("/videos/stats", async (_req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.json({ ok: true, total: 0, lastSync: null });
  try {
    const [countRes, syncRes] = await Promise.all([
      sbFetch("/page_videos?select=id", { headers: { Prefer: "count=exact" } }),
      sbFetch("/video_sync_logs?select=started_at,status&order=started_at.desc&limit=1"),
    ]);
    const totalHeader = countRes.headers.get("content-range");
    const total = totalHeader ? parseInt(totalHeader.split("/")[1] ?? "0", 10) : 0;
    const syncData = await syncRes.json() as { started_at: string; status: string }[];
    return res.json({ ok: true, total, lastSync: syncData[0] ?? null });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ─── GET /api/videos/sync-logs ──────────────────────────────── */
router.get("/videos/sync-logs", async (_req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.json({ ok: true, logs: [] });
  try {
    const r = await sbFetch("/video_sync_logs?select=*&order=started_at.desc&limit=20");
    if (!r.ok) throw new Error(`Supabase error ${r.status}`);
    const logs = await r.json();
    return res.json({ ok: true, logs });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ─── POST /api/videos/extract-single ────────────────────────── */
// استخراج وحفظ فيديو واحد من رابطه
router.post("/videos/extract-single", async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url?.trim()) return res.status(400).json({ ok: false, error: "url is required" });

  const result = await extractSingleVideo(url.trim());
  if (!result.ok || !result.videos?.length) {
    return res.status(502).json({ ok: false, error: result.error ?? "فشل الاستخراج" });
  }

  const video = result.videos[0];
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.json({ ok: true, video, saved: false, message: "Supabase غير مُهيأ — البيانات غير محفوظة" });
  }

  try {
    // upsert — لو موجود يحدّث
    const r = await sbFetch("/page_videos", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        fb_video_id: video.fb_video_id,
        title: video.title,
        thumbnail_url: video.thumbnail_url,
        published_at: video.published_at,
        duration_seconds: video.duration_seconds,
        post_url: video.post_url,
        download_formats: video.download_formats,
        raw_metadata: video.raw_metadata,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!r.ok) throw new Error(`Supabase error ${r.status}`);
    const saved = await r.json();
    return res.json({ ok: true, video: Array.isArray(saved) ? saved[0] : saved, saved: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ─── POST /api/videos/sync ──────────────────────────────────── */
// مزامنة كاملة لصفحة فيسبوك — بيستخدم SSE لإرسال progress
router.post("/videos/sync", async (req, res) => {
  const { page_url } = req.body as { page_url?: string };
  if (!page_url?.trim()) return res.status(400).json({ ok: false, error: "page_url is required" });

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // إنشاء سجل مزامنة
  let logId: string | null = null;
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const r = await sbFetch("/video_sync_logs", {
        method: "POST",
        body: JSON.stringify({ page_url: page_url.trim(), status: "running" }),
      });
      const d = await r.json();
      logId = (Array.isArray(d) ? d[0] : d)?.id ?? null;
    } catch { /* نكمل */ }
  }

  send({ type: "start", message: "بدأت المزامنة..." });

  let added = 0, updated = 0, skipped = 0, errors = 0;
  const errorDetails: string[] = [];

  try {
    for await (const event of extractPageVideos(page_url.trim())) {
      if (event.type === "error") {
        errors++;
        errorDetails.push(event.error);
        send({ type: "error", message: event.error });
        continue;
      }

      const video = event.video;
      send({ type: "progress", message: `جاري معالجة: ${video.title}` });

      if (!SUPABASE_URL || !SUPABASE_KEY) {
        added++;
        send({ type: "video", action: "added", title: video.title });
        continue;
      }

      try {
        // نتحقق لو الفيديو موجود
        const checkRes = await sbFetch(`/page_videos?fb_video_id=eq.${encodeURIComponent(video.fb_video_id)}&select=id,title,thumbnail_url`);
        const existing = await checkRes.json() as { id: string; title: string; thumbnail_url: string }[];

        if (existing.length > 0) {
          const ex = existing[0];
          const changed = ex.title !== video.title || ex.thumbnail_url !== video.thumbnail_url;
          if (changed) {
            await sbFetch(`/page_videos?id=eq.${ex.id}`, {
              method: "PATCH",
              body: JSON.stringify({
                title: video.title,
                thumbnail_url: video.thumbnail_url,
                download_formats: video.download_formats,
                raw_metadata: video.raw_metadata,
                updated_at: new Date().toISOString(),
              }),
            });
            updated++;
            send({ type: "video", action: "updated", title: video.title });
          } else {
            skipped++;
            send({ type: "video", action: "skipped", title: video.title });
          }
        } else {
          await sbFetch("/page_videos", {
            method: "POST",
            body: JSON.stringify({
              fb_video_id: video.fb_video_id,
              title: video.title,
              thumbnail_url: video.thumbnail_url,
              published_at: video.published_at,
              duration_seconds: video.duration_seconds,
              post_url: video.post_url,
              download_formats: video.download_formats,
              raw_metadata: video.raw_metadata,
            }),
          });
          added++;
          send({ type: "video", action: "added", title: video.title });
        }
      } catch (dbErr) {
        errors++;
        const msg = `خطأ حفظ "${video.title}": ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`;
        errorDetails.push(msg);
        send({ type: "error", message: msg });
      }
    }
  } catch (err) {
    errors++;
    const msg = err instanceof Error ? err.message : String(err);
    errorDetails.push(msg);
    send({ type: "error", message: msg });
  }

  // تحديث سجل المزامنة
  if (logId && SUPABASE_URL && SUPABASE_KEY) {
    await sbFetch(`/video_sync_logs?id=eq.${logId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: errors > 0 && added === 0 && updated === 0 ? "failed" : "completed",
        added_count: added,
        updated_count: updated,
        skipped_count: skipped,
        error_count: errors,
        error_details: errorDetails,
        finished_at: new Date().toISOString(),
      }),
    }).catch(() => {});
  }

  send({ type: "done", added, updated, skipped, errors });
  res.end();
});

/* ─── PATCH /api/videos/:id ──────────────────────────────────── */
router.patch("/videos/:id", async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ ok: false, error: "Supabase غير مُهيأ" });
  const { id } = req.params;
  const { title, thumbnail_url, published_at, duration_seconds, post_url } = req.body as Record<string, unknown>;
  try {
    const r = await sbFetch(`/page_videos?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title, thumbnail_url, published_at, duration_seconds, post_url, updated_at: new Date().toISOString() }),
    });
    if (!r.ok) throw new Error(`Supabase error ${r.status}`);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ─── DELETE /api/videos/:id ─────────────────────────────────── */
router.delete("/videos/:id", async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ ok: false, error: "Supabase غير مُهيأ" });
  const { id } = req.params;
  try {
    const r = await sbFetch(`/page_videos?id=eq.${id}`, { method: "DELETE" });
    if (!r.ok) throw new Error(`Supabase error ${r.status}`);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ─── DELETE /api/videos ─────────────────────────────────────── */
// حذف جميع الفيديوهات
router.delete("/videos", async (_req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ ok: false, error: "Supabase غير مُهيأ" });
  try {
    const r = await sbFetch("/page_videos?id=neq.00000000-0000-0000-0000-000000000000", { method: "DELETE" });
    if (!r.ok) throw new Error(`Supabase error ${r.status}`);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;

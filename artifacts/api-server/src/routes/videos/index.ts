import { Router } from "express";
import { extractSingleVideo, extractPageVideos } from "./extractor.js";
import { testConnection, getConfig } from "./facebook-graph.js";

const router = Router();

/* ─── Supabase config ────────────────────────────────────────────── */
const SUPABASE_URL = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"] ?? "";
const SUPABASE_KEY =
  process.env["VITE_SUPABASE_SERVICE_KEY"] ??
  process.env["SUPABASE_SERVICE_KEY"] ??
  process.env["VITE_SUPABASE_ANON_KEY"] ??
  process.env["SUPABASE_ANON_KEY"] ??
  "";

async function sbFetch(path: string, options: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
}

/* ═══════════════════════════════════════════════════════════════════
   GET /api/videos
   جلب الفيديوهات مع pagination وبحث
═══════════════════════════════════════════════════════════════════ */
router.get("/videos", async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY)
    return res.json({ ok: true, videos: [], total: 0 });

  const search = String(req.query["search"] ?? "").trim();
  const page = Math.max(1, parseInt(String(req.query["page"] ?? "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query["limit"] ?? "20"), 10)));
  const offset = (page - 1) * limit;

  let filter = "order=published_at.desc.nullslast";
  if (search) {
    filter += `&title=ilike.${encodeURIComponent(`%${search}%`)}`;
  }
  filter += `&limit=${limit}&offset=${offset}`;

  try {
    const [dataRes, countRes] = await Promise.all([
      sbFetch(
        `/page_videos?select=id,fb_video_id,title,thumbnail_url,published_at,duration_seconds,post_url,download_formats&${filter}`
      ),
      sbFetch(
        `/page_videos?select=id${search ? `&title=ilike.${encodeURIComponent(`%${search}%`)}` : ""}&limit=1`,
        { headers: { Prefer: "count=exact" } }
      ),
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

/* ═══════════════════════════════════════════════════════════════════
   GET /api/videos/stats
   إحصاءات سريعة + حالة الـ Facebook config
═══════════════════════════════════════════════════════════════════ */
router.get("/videos/stats", async (_req, res) => {
  const { ready } = getConfig();

  if (!SUPABASE_URL || !SUPABASE_KEY)
    return res.json({ ok: true, total: 0, lastSync: null, fbConfigured: ready });

  try {
    const [countRes, syncRes] = await Promise.all([
      sbFetch("/page_videos?select=id", { headers: { Prefer: "count=exact" } }),
      sbFetch("/video_sync_logs?select=started_at,status,added_count&order=started_at.desc&limit=1"),
    ]);

    const totalHeader = countRes.headers.get("content-range");
    const total = totalHeader ? parseInt(totalHeader.split("/")[1] ?? "0", 10) : 0;
    const syncData = (await syncRes.json()) as {
      started_at: string;
      status: string;
      added_count: number;
    }[];

    return res.json({
      ok: true,
      total,
      lastSync: syncData[0] ?? null,
      fbConfigured: ready,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   GET /api/videos/sync-logs
   آخر 20 سجل مزامنة
═══════════════════════════════════════════════════════════════════ */
router.get("/videos/sync-logs", async (_req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY)
    return res.json({ ok: true, logs: [] });

  try {
    const r = await sbFetch(
      "/video_sync_logs?select=*&order=started_at.desc&limit=20"
    );
    if (!r.ok) throw new Error(`Supabase error ${r.status}`);
    const logs = await r.json();
    return res.json({ ok: true, logs });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   POST /api/videos/test-connection
   اختبار الاتصال بـ Facebook Graph API
═══════════════════════════════════════════════════════════════════ */
router.post("/videos/test-connection", async (_req, res) => {
  const { token, pageId, ready } = getConfig();

  if (!ready) {
    return res.status(400).json({
      ok: false,
      error: "FACEBOOK_ACCESS_TOKEN أو FACEBOOK_PAGE_ID غير مُهيأ في متغيرات البيئة.",
    });
  }

  const result = await testConnection(token, pageId);

  if (!result.ok) {
    return res.status(502).json({ ok: false, error: result.error });
  }

  return res.json({
    ok: true,
    pageName: result.pageName,
    videoCount: result.videoCount,
  });
});

/* ═══════════════════════════════════════════════════════════════════
   POST /api/videos/extract-single
   استخراج وحفظ فيديو واحد (رابط مباشر أو Video ID)
═══════════════════════════════════════════════════════════════════ */
router.post("/videos/extract-single", async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url?.trim())
    return res.status(400).json({ ok: false, error: "url is required" });

  const result = await extractSingleVideo(url.trim());

  if (!result.ok || !result.videos?.length) {
    return res.status(502).json({ ok: false, error: result.error ?? "فشل الاستخراج" });
  }

  const video = result.videos[0];

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.json({
      ok: true,
      video,
      saved: false,
      message: "Supabase غير مُهيأ — البيانات غير محفوظة",
    });
  }

  try {
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
    return res.json({
      ok: true,
      video: Array.isArray(saved) ? saved[0] : saved,
      saved: true,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   POST /api/videos/sync
   مزامنة كاملة لكل فيديوهات الصفحة — SSE streaming
═══════════════════════════════════════════════════════════════════ */
router.post("/videos/sync", async (req, res): Promise<void> => {
  const { page_url } = req.body as { page_url?: string };

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
  const syncTarget = page_url?.trim() ?? "graph-api";

  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const r = await sbFetch("/video_sync_logs", {
        method: "POST",
        body: JSON.stringify({ page_url: syncTarget, status: "running" }),
      });
      const d = (await r.json()) as { id?: string } | { id?: string }[];
      logId = (Array.isArray(d) ? d[0] : d)?.id ?? null;
    } catch { /* نكمل بدون سجل */ }
  }

  send({ type: "start", message: "جاري الاتصال بـ Facebook Graph API..." });

  let added = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  try {
    for await (const event of extractPageVideos(syncTarget)) {
      // حدث خطأ من الـ extractor
      if (event.type === "error") {
        errors++;
        errorDetails.push(event.error);
        send({ type: "error", message: event.error });
        continue;
      }

      // حدث progress (pagination)
      if (event.type === "progress") {
        send({ type: "progress", fetched: event.fetched, message: event.message });
        continue;
      }

      // حدث فيديو
      const video = event.video;
      send({ type: "processing", message: `جاري معالجة: ${video.title}` });

      if (!SUPABASE_URL || !SUPABASE_KEY) {
        added++;
        send({ type: "video", action: "added", title: video.title });
        continue;
      }

      try {
        // تحقق هل الفيديو موجود
        const checkRes = await sbFetch(
          `/page_videos?fb_video_id=eq.${encodeURIComponent(video.fb_video_id)}&select=id,title,thumbnail_url,published_at`
        );
        const existing = (await checkRes.json()) as {
          id: string;
          title: string;
          thumbnail_url: string;
          published_at: string | null;
        }[];

        if (existing.length > 0) {
          const ex = existing[0];
          const changed =
            ex.title !== video.title ||
            ex.thumbnail_url !== video.thumbnail_url ||
            ex.published_at !== video.published_at;

          if (changed) {
            await sbFetch(`/page_videos?id=eq.${ex.id}`, {
              method: "PATCH",
              body: JSON.stringify({
                title: video.title,
                thumbnail_url: video.thumbnail_url,
                published_at: video.published_at,
                duration_seconds: video.duration_seconds,
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
        const msg = `خطأ في حفظ "${video.title}": ${
          dbErr instanceof Error ? dbErr.message : String(dbErr)
        }`;
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

/* ═══════════════════════════════════════════════════════════════════
   GET /api/videos/download
   Proxy تحميل الفيديو بالاسم الصحيح (يتجاوز قيود cross-origin filename)
   Query params: url (رابط التحميل), filename (اسم الملف)
═══════════════════════════════════════════════════════════════════ */
router.get("/videos/download", async (req, res): Promise<void> => {
  const { url, filename } = req.query as { url?: string; filename?: string };

  if (!url?.trim()) {
    res.status(400).json({ ok: false, error: "url is required" });
    return;
  }

  // تحقق بسيط — الرابط لازم يكون من فيسبوك أو CDN بتاعه
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    res.status(400).json({ ok: false, error: "Invalid URL" });
    return;
  }

  const allowedHosts = ["facebook.com", "fbcdn.net", "fb.com", "cdninstagram.com"];
  const isAllowed = allowedHosts.some(h => parsedUrl.hostname.endsWith(h));
  if (!isAllowed) {
    res.status(403).json({ ok: false, error: "URL غير مسموح به" });
    return;
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.facebook.com/",
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!upstream.ok) {
      res.status(502).json({ ok: false, error: `Upstream error ${upstream.status}` });
      return;
    }

    // اسم الملف — ننظفه من الأحرف الغريبة
    const rawName = (filename ?? "video").trim();
    const safeName = rawName
      .replace(/[^\u0600-\u06FF\w\s\-_.]/g, "")  // احتفظ بالعربي والإنجليزي
      .replace(/\s+/g, "_")
      .slice(0, 100) || "video";
    const finalName = `${safeName}.mp4`;

    const contentType = upstream.headers.get("content-type") ?? "video/mp4";
    const contentLength = upstream.headers.get("content-length");

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(finalName)}`);
    if (contentLength) res.setHeader("Content-Length", contentLength);
    res.setHeader("Cache-Control", "no-store");

    // stream مباشر بدون تحميل في الذاكرة
    const reader = upstream.body?.getReader();
    if (!reader) { res.status(502).end(); return; }

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!res.writable) break;
      res.write(value);
    }
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  }
});

/* ═══════════════════════════════════════════════════════════════════
   PATCH /api/videos/:id
   تعديل بيانات فيديو
═══════════════════════════════════════════════════════════════════ */
router.patch("/videos/:id", async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY)
    return res.status(503).json({ ok: false, error: "Supabase غير مُهيأ" });

  const { id } = req.params;
  const { title, thumbnail_url, published_at, duration_seconds, post_url } =
    req.body as Record<string, unknown>;

  try {
    const r = await sbFetch(`/page_videos?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title,
        thumbnail_url,
        published_at,
        duration_seconds,
        post_url,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!r.ok) throw new Error(`Supabase error ${r.status}`);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   DELETE /api/videos/:id
   حذف فيديو واحد
═══════════════════════════════════════════════════════════════════ */
router.delete("/videos/:id", async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY)
    return res.status(503).json({ ok: false, error: "Supabase غير مُهيأ" });

  const { id } = req.params;
  try {
    const r = await sbFetch(`/page_videos?id=eq.${id}`, { method: "DELETE" });
    if (!r.ok) throw new Error(`Supabase error ${r.status}`);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   DELETE /api/videos
   حذف جميع الفيديوهات
═══════════════════════════════════════════════════════════════════ */
router.delete("/videos", async (_req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY)
    return res.status(503).json({ ok: false, error: "Supabase غير مُهيأ" });

  try {
    // Supabase يحتاج filter — نستخدم id != uuid-صفري كطريقة لحذف الكل
    const r = await sbFetch(
      "/page_videos?id=neq.00000000-0000-0000-0000-000000000000",
      { method: "DELETE" }
    );
    if (!r.ok) throw new Error(`Supabase error ${r.status}`);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;

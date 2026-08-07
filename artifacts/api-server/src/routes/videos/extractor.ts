/**
 * Extractor Layer — طبقة مستقلة لاستخراج بيانات الفيديو
 *
 * الأداة الحالية: fb-downloader-scrapper (Node.js scraper)
 * لو احتجت تغير الأداة مستقبلاً، عدّل هنا بس.
 */

/* ─── Types ─────────────────────────────────────────────────────── */

export interface VideoFormat {
  quality: string;
  format_id: string;
  ext: string;
  url: string;
  filesize?: number;
}

export interface ExtractedVideo {
  fb_video_id: string;
  title: string;
  thumbnail_url: string;
  published_at: string | null;
  duration_seconds: number;
  post_url: string;
  download_formats: VideoFormat[];
  raw_metadata: Record<string, unknown>;
}

export interface ExtractorResult {
  ok: boolean;
  videos?: ExtractedVideo[];
  error?: string;
}

/* ─── Helpers ───────────────────────────────────────────────────── */

function extractVideoId(url: string): string {
  const patterns = [
    /videos\/(\d+)/,
    /v=(\d+)/,
    /reel\/(\d+)/,
    /watch\?v=(\d+)/,
    /\/(\d{10,})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return Buffer.from(url).toString("base64").slice(0, 20);
}

/* ─── Public API ────────────────────────────────────────────────── */

/**
 * استخراج بيانات فيديو واحد من رابطه
 */
export async function extractSingleVideo(url: string): Promise<ExtractorResult> {
  try {
    // استيراد المكتبة ديناميكياً
    const { getFbVideoInfo } = await import("fb-downloader-scrapper") as {
      getFbVideoInfo: (url: string) => Promise<{
        title?: string;
        thumbnail?: string;
        sd?: string;
        hd?: string;
        duration?: number | string;
      }>;
    };

    const data = await getFbVideoInfo(url);

    if (!data || (!data.sd && !data.hd)) {
      return { ok: false, error: "لم يتم العثور على روابط تحميل لهذا الفيديو. تأكد إن الفيديو عام وليس خاص." };
    }

    const formats: VideoFormat[] = [];
    if (data.hd) {
      formats.push({ quality: "HD", format_id: "hd", ext: "mp4", url: data.hd });
    }
    if (data.sd) {
      formats.push({ quality: "SD", format_id: "sd", ext: "mp4", url: data.sd });
    }

    const duration = data.duration ? Number(data.duration) : 0;

    const video: ExtractedVideo = {
      fb_video_id: extractVideoId(url),
      title: data.title?.trim() || "فيديو فيسبوك",
      thumbnail_url: data.thumbnail || "",
      published_at: null,
      duration_seconds: Math.round(duration),
      post_url: url,
      download_formats: formats,
      raw_metadata: data as Record<string, unknown>,
    };

    return { ok: true, videos: [video] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `فشل الاستخراج: ${msg}` };
  }
}

/**
 * مزامنة صفحة كاملة — غير متاحة بدون Graph API
 */
export async function* extractPageVideos(
  _pageUrl: string
): AsyncGenerator<{ type: "video"; video: ExtractedVideo } | { type: "error"; error: string; url?: string }> {
  yield {
    type: "error",
    error: "مزامنة الصفحة الكاملة غير متاحة. استخدم 'إضافة فيديو واحد برابطه'.",
  };
}

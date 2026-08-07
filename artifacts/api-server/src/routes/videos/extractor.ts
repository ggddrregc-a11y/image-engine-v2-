/**
 * Extractor Layer — طبقة مستقلة لاستخراج بيانات الفيديو
 *
 * الأداة الحالية: Facebook Media Downloader API (RapidAPI)
 * endpoint: POST https://facebook-media-downloader1.p.rapidapi.com/get_media
 *
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

/* ─── Config ────────────────────────────────────────────────────── */

const RAPIDAPI_KEY = process.env["RAPIDAPI_KEY"] ?? "67260a3d7bmshfbf35a9b7c828a8p17174fjsnba7c2fca67ca";
const RAPIDAPI_HOST = "facebook-media-downloader1.p.rapidapi.com";
const RAPIDAPI_URL  = `https://${RAPIDAPI_HOST}/get_media`;

/* ─── Helpers ───────────────────────────────────────────────────── */

function extractVideoId(url: string): string {
  // استخراج الـ ID من روابط فيسبوك المختلفة
  const patterns = [
    /videos\/(\d+)/,
    /v=(\d+)/,
    /\/(\d{10,})/,
    /reel\/(\d+)/,
    /watch\?v=(\d+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  // fallback: hash من الـ URL
  return Buffer.from(url).toString("base64").slice(0, 20);
}

function buildFormats(data: Record<string, unknown>): VideoFormat[] {
  const formats: VideoFormat[] = [];

  // direct_media_url — الجودة الأساسية
  if (data["direct_media_url"] && typeof data["direct_media_url"] === "string") {
    formats.push({
      quality: "HD",
      format_id: "hd",
      ext: "mp4",
      url: data["direct_media_url"],
    });
  }

  // sd_url لو موجود
  if (data["sd_url"] && typeof data["sd_url"] === "string") {
    formats.push({
      quality: "SD",
      format_id: "sd",
      ext: "mp4",
      url: data["sd_url"] as string,
    });
  }

  // hd_url لو موجود
  if (data["hd_url"] && typeof data["hd_url"] === "string" && data["hd_url"] !== data["direct_media_url"]) {
    formats.unshift({
      quality: "HD",
      format_id: "hd",
      ext: "mp4",
      url: data["hd_url"] as string,
    });
  }

  // لو في qualities array
  const qualities = data["qualities"] as Record<string, unknown>[] | undefined;
  if (Array.isArray(qualities) && qualities.length > 0) {
    for (const q of qualities) {
      const qUrl = String(q["url"] ?? q["download_url"] ?? "");
      if (!qUrl) continue;
      formats.push({
        quality: String(q["quality"] ?? q["resolution"] ?? "unknown"),
        format_id: String(q["format_id"] ?? q["quality"] ?? "unknown"),
        ext: String(q["ext"] ?? "mp4"),
        url: qUrl,
      });
    }
  }

  // إزالة duplicates
  const seen = new Set<string>();
  return formats.filter(f => {
    if (seen.has(f.quality)) return false;
    seen.add(f.quality);
    return true;
  });
}

/* ─── Public API ────────────────────────────────────────────────── */

/**
 * استخراج بيانات فيديو واحد من رابطه
 */
export async function extractSingleVideo(url: string): Promise<ExtractorResult> {
  try {
    const res = await fetch(RAPIDAPI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-rapidapi-host": RAPIDAPI_HOST,
        "x-rapidapi-key": RAPIDAPI_KEY,
      },
      body: JSON.stringify({ url }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => `HTTP ${res.status}`);
      return { ok: false, error: `API error ${res.status}: ${errText}` };
    }

    const data = await res.json() as Record<string, unknown>;

    if (data["status"] !== 200 && data["status"] !== "200") {
      return { ok: false, error: `API returned status ${data["status"]}` };
    }

    const videoId = extractVideoId(url);
    const title = String(data["title"] ?? data["description"] ?? "فيديو فيسبوك").trim() || "فيديو فيسبوك";
    const thumbnail = String(data["thumbnail"] ?? data["thumb"] ?? data["cover"] ?? "");
    const duration = Number(data["duration"] ?? data["duration_ms"] ? Number(data["duration_ms"]) / 1000 : 0);
    const formats = buildFormats(data);

    const video: ExtractedVideo = {
      fb_video_id: videoId,
      title,
      thumbnail_url: thumbnail,
      published_at: null,
      duration_seconds: Math.round(duration),
      post_url: String(data["source_url"] ?? url),
      download_formats: formats,
      raw_metadata: data,
    };

    return { ok: true, videos: [video] };
  } catch (err) {
    return { ok: false, error: `Extractor error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * استخراج فيديوهات صفحة — بيرجع async generator
 * في الوقت الحالي بيعتمد على إضافة الفيديوهات يدوياً برابط
 * لأن فيسبوك لا يدعم استخراج الصفحة الكاملة بدون Graph API
 */
export async function* extractPageVideos(
  _pageUrl: string
): AsyncGenerator<{ type: "video"; video: ExtractedVideo } | { type: "error"; error: string; url?: string }> {
  yield {
    type: "error",
    error: "مزامنة الصفحة الكاملة غير متاحة. استخدم 'إضافة فيديو واحد برابطه' بدلاً من ذلك.",
  };
}

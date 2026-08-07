/**
 * Extractor Layer — طبقة مستقلة لاستخراج بيانات الفيديو
 *
 * كل الكود التاني ما يعرفش أي أداة استخراج بتتستخدم.
 * لو احتجت تغير الأداة مستقبلاً، عدّل هنا بس.
 *
 * الأداة الحالية: yt-dlp (عبر child_process)
 * البديل: أي أداة تانية تنفذ نفس الـ interface
 */

import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/* ─── Types ─────────────────────────────────────────────────────── */

export interface VideoFormat {
  quality: string;        // "1080p" | "720p" | "480p" | "360p" | "audio"
  format_id: string;
  ext: string;
  url: string;
  filesize?: number;
}

export interface ExtractedVideo {
  fb_video_id: string;
  title: string;
  thumbnail_url: string;
  published_at: string | null;  // ISO string أو null
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

function resolveYtDlp(): string {
  // بيدور على yt-dlp في PATH أو في مكان ثابت
  return process.env["YTDLP_PATH"] ?? "yt-dlp";
}

function parseFormats(formats: Record<string, unknown>[]): VideoFormat[] {
  if (!Array.isArray(formats)) return [];

  const result: VideoFormat[] = [];
  const seen = new Set<string>();

  for (const f of formats) {
    const height = Number(f["height"] ?? 0);
    const vcodec = String(f["vcodec"] ?? "none");
    const acodec = String(f["acodec"] ?? "none");
    const url = String(f["url"] ?? "");
    if (!url || url === "none") continue;

    let quality = "unknown";
    if (vcodec !== "none") {
      if (height >= 1080) quality = "1080p";
      else if (height >= 720) quality = "720p";
      else if (height >= 480) quality = "480p";
      else if (height >= 360) quality = "360p";
      else if (height > 0) quality = `${height}p`;
      else quality = String(f["format_note"] ?? f["format_id"] ?? "video");
    } else if (acodec !== "none") {
      quality = "audio";
    } else {
      continue;
    }

    if (seen.has(quality)) continue;
    seen.add(quality);

    result.push({
      quality,
      format_id: String(f["format_id"] ?? ""),
      ext: String(f["ext"] ?? "mp4"),
      url,
      filesize: f["filesize"] ? Number(f["filesize"]) : undefined,
    });
  }

  // ترتيب: الأعلى جودة أولاً
  const order = ["1080p", "720p", "480p", "360p", "audio"];
  result.sort((a, b) => {
    const ai = order.indexOf(a.quality);
    const bi = order.indexOf(b.quality);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return result;
}

function parseVideoInfo(info: Record<string, unknown>, originalUrl?: string): ExtractedVideo {
  const id = String(info["id"] ?? info["display_id"] ?? "");
  const title = String(info["title"] ?? "").trim() || "بدون عنوان";
  const thumbnail = String(
    info["thumbnail"] ??
    (Array.isArray(info["thumbnails"]) && info["thumbnails"].length > 0
      ? (info["thumbnails"] as Record<string, unknown>[])[0]["url"]
      : "") ??
    ""
  );

  const uploadTimestamp = info["timestamp"] ?? info["upload_date"];
  let publishedAt: string | null = null;
  if (typeof uploadTimestamp === "number") {
    publishedAt = new Date(uploadTimestamp * 1000).toISOString();
  } else if (typeof uploadTimestamp === "string" && uploadTimestamp.length === 8) {
    // YYYYMMDD format from yt-dlp
    const y = uploadTimestamp.slice(0, 4);
    const m = uploadTimestamp.slice(4, 6);
    const d = uploadTimestamp.slice(6, 8);
    publishedAt = new Date(`${y}-${m}-${d}`).toISOString();
  }

  const duration = Number(info["duration"] ?? 0);
  const postUrl = String(info["webpage_url"] ?? originalUrl ?? "");
  const formats = parseFormats((info["formats"] as Record<string, unknown>[]) ?? []);

  return {
    fb_video_id: id,
    title,
    thumbnail_url: thumbnail,
    published_at: publishedAt,
    duration_seconds: Math.round(duration),
    post_url: postUrl,
    download_formats: formats,
    raw_metadata: info,
  };
}

/* ─── Public API ────────────────────────────────────────────────── */

/**
 * استخراج بيانات فيديو واحد من رابطه
 */
export async function extractSingleVideo(url: string): Promise<ExtractorResult> {
  try {
    const ytdlp = resolveYtDlp();
    const { stdout } = await execFileAsync(ytdlp, [
      "--dump-json",
      "--no-playlist",
      "--no-warnings",
      url,
    ], { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 });

    const info = JSON.parse(stdout.trim()) as Record<string, unknown>;
    const video = parseVideoInfo(info, url);
    return { ok: true, videos: [video] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `yt-dlp error: ${msg}` };
  }
}

/**
 * استخراج كل فيديوهات صفحة فيسبوك
 * بيرجع async generator عشان نقدر نبعت progress
 */
export async function* extractPageVideos(
  pageUrl: string
): AsyncGenerator<{ type: "video"; video: ExtractedVideo } | { type: "error"; error: string; url?: string }> {
  const ytdlp = resolveYtDlp();

  // yt-dlp بيدعم صفحات فيسبوك العامة عبر flat-playlist
  const args = [
    "--flat-playlist",
    "--dump-single-json",
    "--no-warnings",
    "--ignore-errors",
    pageUrl,
  ];

  let playlistJson: Record<string, unknown>;
  try {
    const { stdout } = await execFileAsync(ytdlp, args, {
      timeout: 120_000,
      maxBuffer: 20 * 1024 * 1024,
    });
    playlistJson = JSON.parse(stdout.trim()) as Record<string, unknown>;
  } catch (err) {
    yield { type: "error", error: `فشل جلب قائمة الفيديوهات: ${err instanceof Error ? err.message : String(err)}` };
    return;
  }

  const entries = (playlistJson["entries"] as Record<string, unknown>[]) ?? [];
  if (entries.length === 0) {
    yield { type: "error", error: "لم يتم العثور على فيديوهات في الصفحة" };
    return;
  }

  for (const entry of entries) {
    const videoUrl = String(entry["url"] ?? entry["webpage_url"] ?? "");
    if (!videoUrl) continue;

    try {
      const { stdout } = await execFileAsync(ytdlp, [
        "--dump-json",
        "--no-playlist",
        "--no-warnings",
        videoUrl,
      ], { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 });

      const info = JSON.parse(stdout.trim()) as Record<string, unknown>;
      yield { type: "video", video: parseVideoInfo(info, videoUrl) };
    } catch (err) {
      yield {
        type: "error",
        error: `خطأ في استخراج: ${videoUrl} — ${err instanceof Error ? err.message : String(err)}`,
        url: videoUrl,
      };
    }
  }
}

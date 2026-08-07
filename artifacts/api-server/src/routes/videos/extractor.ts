/**
 * extractor.ts
 * طبقة الاستخراج — تعتمد كلياً على Facebook Graph API
 *
 * المتغيرات البيئية المطلوبة:
 *   FACEBOOK_ACCESS_TOKEN  — Page Access Token
 *   FACEBOOK_PAGE_ID       — رقم الصفحة أو اسمها
 */

import {
  getConfig,
  fetchSingleVideo,
  fetchAllPageVideos,
  type FbVideo,
  type FbVideoFormat,
} from "./facebook-graph.js";

/* ─── Re-export Types ────────────────────────────────────────────── */

export type VideoFormat = FbVideoFormat;
export type ExtractedVideo = FbVideo;

export interface ExtractorResult {
  ok: boolean;
  videos?: ExtractedVideo[];
  error?: string;
}

/* ─── extractSingleVideo ─────────────────────────────────────────── */

/**
 * استخراج فيديو واحد من رابطه المباشر أو Video ID
 */
export async function extractSingleVideo(urlOrId: string): Promise<ExtractorResult> {
  const { token, pageId, ready } = getConfig();

  if (!ready) {
    return {
      ok: false,
      error: "Facebook Access Token أو Page ID غير مُهيأ — أضفهما في متغيرات البيئة.",
    };
  }

  const result = await fetchSingleVideo(urlOrId, token, pageId);

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, videos: [result.video] };
}

/* ─── extractPageVideos ──────────────────────────────────────────── */

type VideoEvent =
  | { type: "video"; video: ExtractedVideo }
  | { type: "error"; error: string; url?: string }
  | { type: "progress"; fetched: number; message: string };

/**
 * مزامنة كاملة لكل فيديوهات الصفحة عبر Graph API pagination
 * AsyncGenerator — يُرسل حدث لكل فيديو أو progress أو خطأ
 */
export async function* extractPageVideos(
  _pageUrl: string
): AsyncGenerator<VideoEvent> {
  const { token, pageId, ready } = getConfig();

  if (!ready) {
    yield {
      type: "error",
      error: "Facebook Access Token أو Page ID غير مُهيأ — أضفهما في متغيرات البيئة.",
    };
    return;
  }

  yield* fetchAllPageVideos(token, pageId);
}

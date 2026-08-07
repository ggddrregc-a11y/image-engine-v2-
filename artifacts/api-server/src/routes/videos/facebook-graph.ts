/**
 * facebook-graph.ts
 * طبقة التواصل مع Facebook Graph API
 *
 * المتغيرات البيئية المطلوبة:
 *   FACEBOOK_ACCESS_TOKEN  — Page Access Token (أو Long-lived User Token)
 *   FACEBOOK_PAGE_ID       — رقم الـ Page أو اسمها (مثال: 123456789 أو mypage)
 */

/* ─── Types ──────────────────────────────────────────────────────── */

export interface FbVideoFormat {
  quality: string;   // "HD" | "SD"
  format_id: string; // "hd" | "sd"
  ext: string;       // "mp4"
  url: string;       // رابط تحميل مباشر
}

export interface FbVideo {
  fb_video_id: string;
  title: string;
  thumbnail_url: string;
  published_at: string | null;
  duration_seconds: number;
  post_url: string;
  download_formats: FbVideoFormat[];
  raw_metadata: Record<string, unknown>;
}

export interface FbGraphError {
  message: string;
  type?: string;
  code?: number;
}

/** نتيجة جلب صفحة واحدة من الـ API */
interface FbPageResult {
  data: RawFbVideo[];
  paging?: {
    cursors?: { before: string; after: string };
    next?: string;
  };
}

/** شكل الفيديو الخام كما يأتي من Graph API */
interface RawFbVideo {
  id: string;
  title?: string;
  description?: string;
  picture?: string;           // thumbnail
  source?: string;            // رابط تحميل مباشر (HD غالباً)
  length?: number;            // المدة بالثواني
  created_time?: string;      // ISO 8601
  permalink_url?: string;     // رابط المنشور
  format?: RawFbVideoFormat[];
}

interface RawFbVideoFormat {
  embed_html?: string;
  filter?: string;            // "130x130" | "native" | ...
  height?: number;
  picture?: string;
  width?: number;
}

/* ─── Config helpers ─────────────────────────────────────────────── */

export function getConfig() {
  const token = process.env["FACEBOOK_ACCESS_TOKEN"] ?? "";
  const pageId = process.env["FACEBOOK_PAGE_ID"] ?? "";
  return { token, pageId, ready: !!(token && pageId) };
}

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

/* ─── Core fetch ─────────────────────────────────────────────────── */

async function graphFetch<T>(path: string, token: string): Promise<{ data: T; error?: never } | { data?: never; error: FbGraphError }> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${GRAPH_BASE}${path}${sep}access_token=${encodeURIComponent(token)}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "image-engine-v2/1.0" },
      signal: AbortSignal.timeout(30_000),
    });

    const json = await res.json() as T & { error?: FbGraphError };

    if (!res.ok || json.error) {
      return { error: json.error ?? { message: `HTTP ${res.status}` } };
    }

    return { data: json };
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : String(err) } };
  }
}

/* ─── Video normalizer ───────────────────────────────────────────── */

function normalizeVideo(raw: RawFbVideo, pageId: string): FbVideo {
  const formats: FbVideoFormat[] = [];

  // source من Graph API = رابط تحميل HD مباشر
  if (raw.source) {
    formats.push({ quality: "HD", format_id: "hd", ext: "mp4", url: raw.source });
  }

  // thumbnail — نختار أعلى دقة من format[] لو موجود
  let thumbnail = raw.picture ?? "";
  if (raw.format?.length) {
    const native = raw.format.find(f => f.filter === "native") ?? raw.format.at(-1);
    if (native?.picture) thumbnail = native.picture;
  }

  // رابط المنشور — نتأكد إنه absolute URL
  let postUrl = raw.permalink_url ?? "";
  if (postUrl && !postUrl.startsWith("http")) {
    postUrl = `https://www.facebook.com${postUrl.startsWith("/") ? "" : "/"}${postUrl}`;
  }
  if (!postUrl) {
    postUrl = `https://www.facebook.com/${pageId}/videos/${raw.id}`;
  }

  return {
    fb_video_id: raw.id,
    title: (raw.title ?? raw.description ?? "").trim() || "فيديو فيسبوك",
    thumbnail_url: thumbnail,
    published_at: raw.created_time ?? null,
    duration_seconds: Math.round(raw.length ?? 0),
    post_url: postUrl,
    download_formats: formats,
    raw_metadata: raw as unknown as Record<string, unknown>,
  };
}

/* ─── Public API ─────────────────────────────────────────────────── */

/**
 * جلب فيديو واحد بمعرّفه أو رابطه
 */
export async function fetchSingleVideo(
  videoIdOrUrl: string,
  token: string,
  pageId: string
): Promise<{ ok: true; video: FbVideo } | { ok: false; error: string }> {
  // استخراج الـ ID من الـ URL لو أُعطي رابط
  const id = extractVideoId(videoIdOrUrl);

  const fields = "id,title,description,picture,source,length,created_time,permalink_url,format";
  const result = await graphFetch<RawFbVideo>(`/${id}?fields=${fields}`, token);

  if (result.error) {
    return { ok: false, error: result.error.message };
  }

  return { ok: true, video: normalizeVideo(result.data, pageId) };
}

/**
 * جلب كل فيديوهات الصفحة مع pagination كاملة
 * AsyncGenerator — يُرسل فيديو بعد فيديو أثناء الجلب
 */
export async function* fetchAllPageVideos(
  token: string,
  pageId: string,
  options: { limit?: number; maxPages?: number } = {}
): AsyncGenerator<
  | { type: "video"; video: FbVideo }
  | { type: "progress"; fetched: number; message: string }
  | { type: "error"; error: string }
> {
  const batchSize = Math.min(options.limit ?? 25, 100);
  const maxPages = options.maxPages ?? 200; // حد أقصى للأمان

  const fields = "id,title,description,picture,source,length,created_time,permalink_url";
  let cursor = "";
  let pagesFetched = 0;
  let totalFetched = 0;

  while (pagesFetched < maxPages) {
    const cursorParam = cursor ? `&after=${encodeURIComponent(cursor)}` : "";
    const path = `/${pageId}/videos?fields=${fields}&limit=${batchSize}${cursorParam}`;

    const result = await graphFetch<FbPageResult>(path, token);

    if (result.error) {
      yield { type: "error", error: result.error.message };
      return;
    }

    const { data, paging } = result.data;

    if (!data || data.length === 0) break; // انتهت الفيديوهات

    for (const raw of data) {
      yield { type: "video", video: normalizeVideo(raw, pageId) };
      totalFetched++;
    }

    pagesFetched++;
    yield {
      type: "progress",
      fetched: totalFetched,
      message: `جُلب ${totalFetched} فيديو حتى الآن...`,
    };

    // هل يوجد صفحة تالية؟
    if (!paging?.next || !paging.cursors?.after) break;
    cursor = paging.cursors.after;

    // تأخير بسيط لتجنب rate limiting
    await sleep(200);
  }
}

/**
 * اختبار الاتصال والصلاحيات
 */
export async function testConnection(
  token: string,
  pageId: string
): Promise<{ ok: true; pageName: string; videoCount: number } | { ok: false; error: string }> {
  // 1. تحقق من صلاحية التوكن
  const meResult = await graphFetch<{ id: string; name: string }>(`/${pageId}?fields=id,name`, token);
  if (meResult.error) {
    return { ok: false, error: `خطأ في التوكن أو الـ Page ID: ${meResult.error.message}` };
  }

  // 2. جلب عدد الفيديوهات
  const countResult = await graphFetch<{ data: unknown[]; summary?: { total_count?: number } }>(
    `/${pageId}/videos?fields=id&limit=1&summary=true`,
    token
  );

  const videoCount = countResult.data?.summary?.total_count ?? 0;

  return {
    ok: true,
    pageName: meResult.data.name,
    videoCount,
  };
}

/* ─── Helpers ────────────────────────────────────────────────────── */

function extractVideoId(input: string): string {
  // لو رابط — استخرج الـ ID
  if (input.startsWith("http")) {
    const patterns = [
      /videos\/(\d+)/,
      /v=(\d+)/,
      /reel\/(\d+)/,
      /watch\?v=(\d+)/,
      /\/(\d{10,})/,
    ];
    for (const p of patterns) {
      const m = input.match(p);
      if (m?.[1]) return m[1];
    }
  }
  // لو ID مباشر أو رقم
  return input.trim();
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

/**
 * stats.ts — Site Statistics Routes
 *
 * GET  /api/stats        — جلب كل الإحصاءات (+ يزود زيارة واحدة)
 * POST /api/stats/edit   — يزود عداد التحريرات
 */

import { Router } from "express";

const router = Router();

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

/* ─── GET /api/stats ─────────────────────────────────────────────── */
// يجيب الإحصاءات كلها + يزود عداد الزيارات
router.get("/stats", async (_req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.json({ ok: true, visits: 0, edits: 0, videos: 0, lastUpdate: null });
  }

  try {
    // زود الزيارات بـ atomic increment
    await sbFetch("/site_stats?key=eq.total_visits", {
      method: "PATCH",
      body: JSON.stringify({
        value: 0, // placeholder — Supabase مش بيدعم increment مباشر بـ REST
        updated_at: new Date().toISOString(),
      }),
    });

    // نستخدم RPC لـ atomic increment
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_stat`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ stat_key: "total_visits" }),
    });

    // جلب كل الإحصاءات بالتوازي
    const [statsRes, videosRes] = await Promise.all([
      sbFetch("/site_stats?select=key,value"),
      sbFetch("/page_videos?select=id", { headers: { Prefer: "count=exact" } }),
    ]);

    const statsData = (await statsRes.json()) as { key: string; value: number }[];
    const totalHeader = videosRes.headers.get("content-range");
    const videos = totalHeader ? parseInt(totalHeader.split("/")[1] ?? "0", 10) : 0;

    const visits = statsData.find((s) => s.key === "total_visits")?.value ?? 0;
    const edits = statsData.find((s) => s.key === "total_edits")?.value ?? 0;

    // آخر تحديث للمكتبة
    const lastVideoRes = await sbFetch("/page_videos?select=updated_at&order=updated_at.desc&limit=1");
    const lastVideoData = (await lastVideoRes.json()) as { updated_at: string }[];
    const lastUpdate = lastVideoData[0]?.updated_at ?? null;

    return res.json({ ok: true, visits, edits, videos, lastUpdate });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

/* ─── POST /api/stats/edit ───────────────────────────────────────── */
// يُستدعى بعد كل تحرير ناجح
router.post("/stats/edit", async (_req, res) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.json({ ok: true });
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_stat`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ stat_key: "total_edits" }),
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;

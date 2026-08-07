/*
# Page Videos — Database Schema

## Overview
Creates tables to support the "إدارة فيديوهات الصفحة" section.
Videos are extracted from a Facebook page using yt-dlp or similar tools,
stored here, and shown in the public "مركز تحميل الفيديوهات" page.

## Tables

1. **page_videos** — One row per video
   - id, fb_video_id (unique), title, thumbnail_url, published_at, duration_seconds,
     post_url, download_formats (jsonb), raw_metadata (jsonb), created_at, updated_at

2. **video_sync_logs** — One row per sync operation
   - id, page_url, status, added_count, updated_count, skipped_count, error_count,
     error_details (jsonb), started_at, finished_at
*/

-- 1. page_videos
CREATE TABLE IF NOT EXISTS page_videos (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fb_video_id       text        NOT NULL UNIQUE,
  title             text        NOT NULL DEFAULT '',
  thumbnail_url     text        NOT NULL DEFAULT '',
  published_at      timestamptz,
  duration_seconds  integer     DEFAULT 0,
  post_url          text        NOT NULL DEFAULT '',
  download_formats  jsonb       NOT NULL DEFAULT '[]',
  raw_metadata      jsonb       NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE page_videos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_page_videos" ON page_videos;
CREATE POLICY "anon_crud_page_videos" ON page_videos FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_page_videos_fb_id      ON page_videos(fb_video_id);
CREATE INDEX IF NOT EXISTS idx_page_videos_published  ON page_videos(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_videos_title      ON page_videos USING gin(to_tsvector('simple', title));

-- 2. video_sync_logs
CREATE TABLE IF NOT EXISTS video_sync_logs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  page_url       text        NOT NULL DEFAULT '',
  status         text        NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  added_count    integer     NOT NULL DEFAULT 0,
  updated_count  integer     NOT NULL DEFAULT 0,
  skipped_count  integer     NOT NULL DEFAULT 0,
  error_count    integer     NOT NULL DEFAULT 0,
  error_details  jsonb       NOT NULL DEFAULT '[]',
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz
);

ALTER TABLE video_sync_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_video_sync_logs" ON video_sync_logs;
CREATE POLICY "anon_crud_video_sync_logs" ON video_sync_logs FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_video_sync_logs_started ON video_sync_logs(started_at DESC);

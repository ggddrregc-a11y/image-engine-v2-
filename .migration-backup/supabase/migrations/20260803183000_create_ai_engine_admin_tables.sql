/*
# AI Engine Control Center — Database Schema

## Overview
Creates the full database schema for the admin panel's AI Engine Management system.
This is a single-tenant app (no sign-in screen), so all policies allow anon+authenticated CRUD.

## New Tables

1. **ai_providers** — AI generation backends (ComfyUI, OpenAI-compatible, Ollama, Stability AI, HuggingFace, Custom REST API)
   - id, name, provider_type, enabled, priority, notes, created_at, updated_at

2. **comfyui_workflows** — ComfyUI workflow configurations
   - id, provider_id (FK to ai_providers), server_url, workflow_json (jsonb), workflow_name, input_nodes (jsonb), output_nodes (jsonb), created_at, updated_at

3. **api_configs** — Authentication configuration for each provider
   - id, provider_id (FK), auth_type (api_key/bearer/custom_headers/basic/cookie/none), endpoint_path, headers (jsonb), request_body (jsonb), created_at, updated_at

4. **ai_models** — Model definitions per provider
   - id, name, provider_id (FK), model_type (image/text/video/audio), enabled, is_default, max_resolution, max_steps, sampler, scheduler, cfg, seed_mode, custom_params (jsonb), created_at, updated_at

5. **prompt_templates** — Reusable prompt templates with categories
   - id, name, prompt_text, category, negative_prompt, created_at, updated_at

6. **generation_settings** — Global generation defaults (single row)
   - id, width, height, cfg, sampler, scheduler, seed, steps, batch_count, batch_size, negative_prompt, safety_filter, watermark, save_metadata, updated_at

7. **generation_jobs** — Real-time generation queue
   - id, prompt, model, status (queued/running/complete/failed/canceled), progress, current_node, provider_id, started_at, completed_at, eta_seconds, error_message, image_url, created_at

8. **stored_images** — Generated image storage metadata
   - id, url, prompt, model, width, height, favorite, tags (text[]), created_at

9. **system_logs** — Searchable system logs
   - id, log_type (api/generation/error/webhook/connection), message, details (jsonb), level (info/warning/error), created_at

10. **admin_users** — User management with roles
    - id, name, email, role (super_admin/admin/moderator/user/guest), status (active/suspended), permissions (jsonb), created_at, updated_at

## Security
- RLS enabled on all tables.
- All policies use `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)` — this is a single-tenant no-auth app where all data is intentionally shared.
*/

-- 1. ai_providers
CREATE TABLE IF NOT EXISTS ai_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider_type text NOT NULL DEFAULT 'comfyui',
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_ai_providers" ON ai_providers;
CREATE POLICY "anon_crud_ai_providers" ON ai_providers FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- 2. comfyui_workflows
CREATE TABLE IF NOT EXISTS comfyui_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES ai_providers(id) ON DELETE CASCADE,
  server_url text NOT NULL DEFAULT '',
  workflow_name text NOT NULL DEFAULT '',
  workflow_json jsonb DEFAULT '{}',
  input_nodes jsonb DEFAULT '[]',
  output_nodes jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE comfyui_workflows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_comfyui_workflows" ON comfyui_workflows;
CREATE POLICY "anon_crud_comfyui_workflows" ON comfyui_workflows FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- 3. api_configs
CREATE TABLE IF NOT EXISTS api_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
  auth_type text NOT NULL DEFAULT 'none',
  endpoint_path text NOT NULL DEFAULT '',
  headers jsonb DEFAULT '{}',
  request_body jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE api_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_api_configs" ON api_configs;
CREATE POLICY "anon_crud_api_configs" ON api_configs FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- 4. ai_models
CREATE TABLE IF NOT EXISTS ai_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider_id uuid REFERENCES ai_providers(id) ON DELETE SET NULL,
  model_type text NOT NULL DEFAULT 'image',
  enabled boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  max_resolution text NOT NULL DEFAULT '1024x1024',
  max_steps integer NOT NULL DEFAULT 50,
  sampler text NOT NULL DEFAULT 'DPM++ 2M Karras',
  scheduler text NOT NULL DEFAULT 'karras',
  cfg numeric NOT NULL DEFAULT 7.0,
  seed_mode text NOT NULL DEFAULT 'random',
  custom_params jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_ai_models" ON ai_models;
CREATE POLICY "anon_crud_ai_models" ON ai_models FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- 5. prompt_templates
CREATE TABLE IF NOT EXISTS prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  prompt_text text NOT NULL,
  category text NOT NULL DEFAULT 'realistic',
  negative_prompt text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_prompt_templates" ON prompt_templates;
CREATE POLICY "anon_crud_prompt_templates" ON prompt_templates FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- 6. generation_settings (single-row table)
CREATE TABLE IF NOT EXISTS generation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  width integer NOT NULL DEFAULT 1024,
  height integer NOT NULL DEFAULT 1024,
  cfg numeric NOT NULL DEFAULT 7.0,
  sampler text NOT NULL DEFAULT 'DPM++ 2M Karras',
  scheduler text NOT NULL DEFAULT 'karras',
  seed text NOT NULL DEFAULT '-1',
  steps integer NOT NULL DEFAULT 30,
  batch_count integer NOT NULL DEFAULT 1,
  batch_size integer NOT NULL DEFAULT 1,
  negative_prompt text NOT NULL DEFAULT '',
  safety_filter boolean NOT NULL DEFAULT true,
  watermark boolean NOT NULL DEFAULT false,
  save_metadata boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE generation_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_generation_settings" ON generation_settings;
CREATE POLICY "anon_crud_generation_settings" ON generation_settings FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- 7. generation_jobs
CREATE TABLE IF NOT EXISTS generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'queued',
  progress integer NOT NULL DEFAULT 0,
  current_node text DEFAULT '',
  provider_id uuid REFERENCES ai_providers(id) ON DELETE SET NULL,
  started_at timestamptz,
  completed_at timestamptz,
  eta_seconds integer DEFAULT 0,
  error_message text DEFAULT '',
  image_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_generation_jobs" ON generation_jobs;
CREATE POLICY "anon_crud_generation_jobs" ON generation_jobs FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- 8. stored_images
CREATE TABLE IF NOT EXISTS stored_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  prompt text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  width integer DEFAULT 1024,
  height integer DEFAULT 1024,
  favorite boolean NOT NULL DEFAULT false,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE stored_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_stored_images" ON stored_images;
CREATE POLICY "anon_crud_stored_images" ON stored_images FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- 9. system_logs
CREATE TABLE IF NOT EXISTS system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_type text NOT NULL DEFAULT 'info',
  message text NOT NULL DEFAULT '',
  details jsonb DEFAULT '{}',
  level text NOT NULL DEFAULT 'info',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_system_logs" ON system_logs;
CREATE POLICY "anon_crud_system_logs" ON system_logs FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_system_logs_log_type ON system_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);

-- 10. admin_users
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'user',
  status text NOT NULL DEFAULT 'active',
  permissions jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_admin_users" ON admin_users;
CREATE POLICY "anon_crud_admin_users" ON admin_users FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Seed default generation settings if none exist
INSERT INTO generation_settings (width, height, cfg, sampler, scheduler, seed, steps, batch_count, batch_size, negative_prompt, safety_filter, watermark, save_metadata)
SELECT 1024, 1024, 7.0, 'DPM++ 2M Karras', 'karras', '-1', 30, 1, 1, '', true, false, true
WHERE NOT EXISTS (SELECT 1 FROM generation_settings);

-- Seed a default provider
INSERT INTO ai_providers (name, provider_type, enabled, priority, notes)
SELECT 'Local ComfyUI', 'comfyui', true, 1, 'Default local ComfyUI instance'
WHERE NOT EXISTS (SELECT 1 FROM ai_providers);

/*
# Chat Sessions — Database Schema

## Overview
Creates two tables to support multi-session chat history in the AI Chat section.
Each session stores its title (first user message) and its messages.

## New Tables

1. **chat_sessions** — One row per conversation
   - id, title, created_at, updated_at

2. **chat_messages** — All messages belonging to a session
   - id, session_id (FK → chat_sessions), role, content, created_at

## Security
- RLS enabled on both tables.
- Policies use `TO anon, authenticated` with `USING (true)` — same pattern as the rest of the app.
*/

-- 1. chat_sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text        NOT NULL DEFAULT 'محادثة جديدة',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_chat_sessions" ON chat_sessions;
CREATE POLICY "anon_crud_chat_sessions" ON chat_sessions FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);

-- 2. chat_messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid        NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role       text        NOT NULL CHECK (role IN ('user', 'assistant')),
  content    text        NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_chat_messages" ON chat_messages;
CREATE POLICY "anon_crud_chat_messages" ON chat_messages FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at ASC);

-- Hacking Hub Admin Dashboard - Gemma AI Assistant
-- Run this in the Supabase SQL Editor after 002-008 have already been applied.
--
-- Stores conversation history for Gemma, the member-facing AI assistant. Only the
-- gemma-chat Edge Function ever writes here (using the service-role key, which
-- bypasses RLS) - there is deliberately no client-facing INSERT policy, so even a
-- leaked member JWT can't be used to forge fake "assistant" messages into their own
-- history. Members can only ever read their own conversation; admins can read
-- everything, same is_admin() pattern used everywhere else in this schema.

CREATE TABLE public.gemma_messages (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX gemma_messages_email_created_at_idx ON public.gemma_messages (email, created_at);

ALTER TABLE public.gemma_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read own gemma messages"
  ON public.gemma_messages FOR SELECT
  USING (email = lower(auth.jwt() ->> 'email'));

CREATE POLICY "admins read all gemma messages"
  ON public.gemma_messages FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Migration: 004_tasks.sql
-- Task management system for Mission Control

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Task content
  title TEXT NOT NULL,
  description TEXT, -- optional longer description
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'queued' 
    CHECK (status IN ('queued', 'active', 'done', 'failed', 'cancelled')),
  
  -- Agent execution
  run_id TEXT, -- OpenClaw run ID when executing
  session_key TEXT, -- OpenClaw session key
  
  -- Results
  result_summary TEXT, -- Brief summary of what the agent did
  error_message TEXT, -- If failed, why
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Ordering
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);

-- RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks"
  ON tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tasks"
  ON tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
  ON tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks"
  ON tasks FOR DELETE
  USING (auth.uid() = user_id);

-- Add deploy provider columns to gateway_connections if they don't exist
ALTER TABLE gateway_connections 
  ADD COLUMN IF NOT EXISTS deploy_provider TEXT 
    CHECK (deploy_provider IN ('flyio', 'railway', 'manual')),
  ADD COLUMN IF NOT EXISTS deploy_app_name TEXT,
  ADD COLUMN IF NOT EXISTS last_health_check TIMESTAMPTZ;

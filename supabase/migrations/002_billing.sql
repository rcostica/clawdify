-- ============================================================
-- Migration 002: Billing & onboarding columns + usage tracking
-- ============================================================

-- Add billing columns to profiles (create profiles table if it doesn't exist)
-- Note: profiles table may already exist from Supabase Auth triggers.
-- Using IF NOT EXISTS for safety.

-- Create profiles table if not exists (many Supabase projects create this via trigger)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add billing & onboarding columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS api_key_encrypted TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS api_provider TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gateway_mode TEXT DEFAULT 'hosted';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- ============================================================
-- Usage tracking table
-- ============================================================
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 🔒 SECURITY: Row Level Security
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only read/update their own profile
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_select_own') THEN
    CREATE POLICY "profiles_select_own" ON profiles
      FOR SELECT USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_update_own') THEN
    CREATE POLICY "profiles_update_own" ON profiles
      FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Usage logs: users can read their own usage
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own usage') THEN
    CREATE POLICY "Users can read own usage" ON usage_logs
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Usage logs: service role can insert (for server-side usage tracking)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service can insert usage') THEN
    CREATE POLICY "Service can insert usage" ON usage_logs
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_usage_user_date ON usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_plan ON profiles(plan);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

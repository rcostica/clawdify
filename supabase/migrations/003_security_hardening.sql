-- ============================================================
-- Migration 003: Security Hardening
-- Applied: 2026-02-04 (Security Audit)
-- ============================================================

-- ── C1 FIX: Remove hardcoded encryption key fallback ──────────────────────
-- The encrypt/decrypt functions previously fell back to a hardcoded key
-- 'CHANGE_ME_IN_PRODUCTION_32_BYTES!' if app.gateway_token_key was not set.
-- This meant deployments without the setting had NO real encryption.
-- Now they RAISE an exception instead of silently using a known key.

CREATE OR REPLACE FUNCTION encrypt_gateway_token(plain_token text)
RETURNS bytea AS $$
DECLARE
  v_key text;
BEGIN
  v_key := current_setting('app.gateway_token_key', true);
  IF v_key IS NULL OR v_key = '' OR v_key = 'CHANGE_ME_IN_PRODUCTION_32_BYTES!' THEN
    RAISE EXCEPTION 'SECURITY: app.gateway_token_key is not configured. '
      'Set it in your Supabase database settings before storing tokens. '
      'See: https://supabase.com/docs/guides/database/vault';
  END IF;
  RETURN pgp_sym_encrypt(plain_token, v_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_gateway_token(encrypted_token bytea)
RETURNS text AS $$
DECLARE
  v_key text;
BEGIN
  v_key := current_setting('app.gateway_token_key', true);
  IF v_key IS NULL OR v_key = '' OR v_key = 'CHANGE_ME_IN_PRODUCTION_32_BYTES!' THEN
    RAISE EXCEPTION 'SECURITY: app.gateway_token_key is not configured. '
      'Cannot decrypt tokens without a valid encryption key.';
  END IF;
  RETURN pgp_sym_decrypt(encrypted_token, v_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── H1 FIX: Restrict usage_logs INSERT to own user_id ─────────────────────
-- The previous policy allowed ANY authenticated user to insert records
-- with any user_id. Now restricted to own records only.

DROP POLICY IF EXISTS "Service can insert usage" ON usage_logs;

CREATE POLICY "Users can insert own usage" ON usage_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

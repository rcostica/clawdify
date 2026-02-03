-- ============================================================
-- 🔒 SECURITY: Enable pgcrypto for gateway token encryption
-- ============================================================
create extension if not exists pgcrypto;

-- Connection settings per user
create table gateway_connections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'Default',
  gateway_url text not null,
  -- 🔒 SECURITY: Token stored as encrypted bytea, NOT plaintext.
  gateway_token_encrypted bytea,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, name)
);

-- 🔒 SECURITY: Server-side functions for token encrypt/decrypt.
create or replace function encrypt_gateway_token(plain_token text)
returns bytea as $$
begin
  return pgp_sym_encrypt(
    plain_token,
    coalesce(
      current_setting('app.gateway_token_key', true),
      'CHANGE_ME_IN_PRODUCTION_32_BYTES!'
    )
  );
end;
$$ language plpgsql security definer;

create or replace function decrypt_gateway_token(encrypted_token bytea)
returns text as $$
begin
  return pgp_sym_decrypt(
    encrypted_token,
    coalesce(
      current_setting('app.gateway_token_key', true),
      'CHANGE_ME_IN_PRODUCTION_32_BYTES!'
    )
  );
end;
$$ language plpgsql security definer;

-- 🔒 SECURITY: Helper to save a connection (encrypts token server-side)
create or replace function save_gateway_connection(
  p_name text,
  p_gateway_url text,
  p_gateway_token text default null
)
returns uuid as $$
declare
  v_id uuid;
begin
  insert into gateway_connections (user_id, name, gateway_url, gateway_token_encrypted)
  values (
    auth.uid(),
    p_name,
    p_gateway_url,
    case when p_gateway_token is not null
      then encrypt_gateway_token(p_gateway_token)
      else null
    end
  )
  on conflict (user_id, name)
  do update set
    gateway_url = excluded.gateway_url,
    gateway_token_encrypted = case when p_gateway_token is not null
      then encrypt_gateway_token(p_gateway_token)
      else gateway_connections.gateway_token_encrypted
    end,
    updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer;

-- 🔒 SECURITY: Helper to retrieve a connection (decrypts token server-side)
create or replace function get_gateway_connection(p_name text default 'Default')
returns table (
  id uuid,
  name text,
  gateway_url text,
  gateway_token text,
  is_active boolean
) as $$
begin
  return query
  select
    gc.id,
    gc.name,
    gc.gateway_url,
    case when gc.gateway_token_encrypted is not null
      then decrypt_gateway_token(gc.gateway_token_encrypted)
      else null
    end as gateway_token,
    gc.is_active
  from gateway_connections gc
  where gc.user_id = auth.uid()
    and gc.name = p_name;
end;
$$ language plpgsql security definer;

-- Projects
create table projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  icon text default '📁',
  color text default '#6366f1',
  session_key text not null,
  model text,
  custom_instructions text,
  archived boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, session_key)
);

-- Chat messages (local mirror of Gateway transcripts)
create table messages (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  tool_calls jsonb default '[]',
  run_id text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- Artifacts extracted from messages
create table artifacts (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade not null,
  message_id uuid references messages(id) on delete set null,
  name text not null,
  type text not null check (type in ('html', 'markdown', 'code', 'image', 'file')),
  language text,
  content text,
  file_url text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz default now()
);

-- Indexes
create index idx_messages_project_id on messages(project_id);
create index idx_messages_created_at on messages(project_id, created_at desc);
create index idx_artifacts_project_id on artifacts(project_id);
create index idx_projects_user_id on projects(user_id);

-- ============================================================
-- 🔒 SECURITY: Row Level Security (MANDATORY — every table)
-- ============================================================
alter table gateway_connections enable row level security;
alter table projects enable row level security;
alter table messages enable row level security;
alter table artifacts enable row level security;

-- Gateway connections: users see only their own
create policy "connections_select" on gateway_connections
  for select using (auth.uid() = user_id);
create policy "connections_insert" on gateway_connections
  for insert with check (auth.uid() = user_id);
create policy "connections_update" on gateway_connections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "connections_delete" on gateway_connections
  for delete using (auth.uid() = user_id);

-- Projects: users see only their own
create policy "projects_select" on projects
  for select using (auth.uid() = user_id);
create policy "projects_insert" on projects
  for insert with check (auth.uid() = user_id);
create policy "projects_update" on projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "projects_delete" on projects
  for delete using (auth.uid() = user_id);

-- Messages: users access messages in their own projects only
create policy "messages_select" on messages
  for select using (project_id in (select id from projects where user_id = auth.uid()));
create policy "messages_insert" on messages
  for insert with check (project_id in (select id from projects where user_id = auth.uid()));
create policy "messages_update" on messages
  for update using (project_id in (select id from projects where user_id = auth.uid()));
create policy "messages_delete" on messages
  for delete using (project_id in (select id from projects where user_id = auth.uid()));

-- Artifacts: same pattern as messages
create policy "artifacts_select" on artifacts
  for select using (project_id in (select id from projects where user_id = auth.uid()));
create policy "artifacts_insert" on artifacts
  for insert with check (project_id in (select id from projects where user_id = auth.uid()));
create policy "artifacts_update" on artifacts
  for update using (project_id in (select id from projects where user_id = auth.uid()));
create policy "artifacts_delete" on artifacts
  for delete using (project_id in (select id from projects where user_id = auth.uid()));

-- Updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

create trigger gateway_connections_updated_at
  before update on gateway_connections
  for each row execute function update_updated_at();

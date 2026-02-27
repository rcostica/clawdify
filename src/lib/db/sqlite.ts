import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Database path - store in user's home directory
export const DB_PATH = process.env.CLAWDIFY_DB_PATH || path.join(process.env.HOME || '/tmp', '.clawdify', 'clawdify.db');

// Ensure directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Create SQLite connection (singleton)
export const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');

// ─── Core tables (auto-created on first run) ─────────────────────────────

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    parent_id TEXT,
    icon TEXT DEFAULT '📁',
    color TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    sort_order INTEGER NOT NULL DEFAULT 0,
    workspace_path TEXT NOT NULL,
    session_key TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    title TEXT NOT NULL,
    session_key TEXT NOT NULL,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES threads(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    model TEXT,
    tokens_used INTEGER,
    bookmarked INTEGER NOT NULL DEFAULT 0,
    attached_files TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'backlog',
    priority TEXT NOT NULL DEFAULT 'medium',
    assigned_to TEXT,
    sub_agent_session_id TEXT,
    due_date INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    parent_task_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    last_accessed_at INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS vault (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

// ─── Migration tables (added after initial release) ──────────────────────

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS session_summaries (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES threads(id),
    content TEXT NOT NULL,
    message_count INTEGER NOT NULL,
    first_message_at INTEGER NOT NULL,
    last_message_at INTEGER NOT NULL,
    last_message_id TEXT,
    created_at INTEGER NOT NULL
  );
`);

// Auto-migration: add parent_task_id column to tasks table (for sub-tasks)
try {
  sqlite.exec(`ALTER TABLE tasks ADD COLUMN parent_task_id TEXT`);
} catch {
  // Column already exists — ignore
}

// Migration: message_reactions table
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS message_reactions (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id),
    emoji TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

// Unique constraint on (message_id, emoji) — one of each emoji per message
try {
  sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_message_reactions_unique ON message_reactions(message_id, emoji);`);
} catch { /* index already exists */ }

// Migration: bookmarked column on messages
try {
  sqlite.exec(`ALTER TABLE messages ADD COLUMN bookmarked INTEGER NOT NULL DEFAULT 0;`);
} catch { /* column already exists */ }

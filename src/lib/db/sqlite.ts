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

// Auto-migrations for new tables
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

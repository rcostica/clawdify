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

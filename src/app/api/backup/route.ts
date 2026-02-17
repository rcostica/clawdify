import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { sqlite, DB_PATH } from '@/lib/db/sqlite';
import { logAudit } from '@/lib/audit';
const WORKSPACE_PATH = process.env.OPENCLAW_WORKSPACE_PATH || path.join(os.homedir(), '.openclaw', 'workspace');

export async function GET() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawdify-backup-'));
  const archivePath = path.join(os.tmpdir(), `clawdify-backup-${Date.now()}.tar.gz`);

  try {
    // 1. Create staging directory structure
    const dbBackupDir = path.join(tmpDir, 'database');
    const workspaceBackupDir = path.join(tmpDir, 'workspace');
    fs.mkdirSync(dbBackupDir, { recursive: true });

    // 2. Safely backup the SQLite database using better-sqlite3's .backup()
    const dbBackupPath = path.join(dbBackupDir, 'clawdify.db');
    await sqlite.backup(dbBackupPath);

    // 3. Copy workspace files if the directory exists
    if (fs.existsSync(WORKSPACE_PATH)) {
      execSync(`cp -a ${JSON.stringify(WORKSPACE_PATH)} ${JSON.stringify(workspaceBackupDir)}`);
    }

    // 4. Write metadata
    const metadata = {
      version: 1,
      createdAt: new Date().toISOString(),
      hostname: os.hostname(),
      dbPath: DB_PATH,
      workspacePath: WORKSPACE_PATH,
    };
    fs.writeFileSync(path.join(tmpDir, 'backup-metadata.json'), JSON.stringify(metadata, null, 2));

    // 5. Create tar.gz archive
    execSync(`tar -czf ${JSON.stringify(archivePath)} -C ${JSON.stringify(tmpDir)} .`);

    // 6. Read the archive and return as response
    const archiveBuffer = fs.readFileSync(archivePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `clawdify-backup-${timestamp}.tar.gz`;

    logAudit('backup_created', JSON.stringify({ filename, sizeBytes: archiveBuffer.length }));

    return new Response(archiveBuffer, {
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(archiveBuffer.length),
      },
    });
  } catch (error) {
    console.error('Backup failed:', error);
    logAudit('backup_failed', String(error));
    return NextResponse.json(
      { error: 'Failed to create backup', details: String(error) },
      { status: 500 }
    );
  } finally {
    // Clean up temp files
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath);
    } catch { /* ignore cleanup errors */ }
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logAudit } from '@/lib/audit';

const DB_PATH = process.env.CLAWDIFY_DB_PATH || path.join(os.homedir(), '.clawdify', 'clawdify.db');
const WORKSPACE_PATH = process.env.OPENCLAW_WORKSPACE_PATH || path.join(os.homedir(), '.openclaw', 'workspace');

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const confirm = url.searchParams.get('confirm');

  if (confirm !== 'true') {
    return NextResponse.json(
      { error: 'Restore requires confirm=true parameter. This operation is destructive!' },
      { status: 400 }
    );
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawdify-restore-'));
  const uploadPath = path.join(os.tmpdir(), `clawdify-restore-upload-${Date.now()}.tar.gz`);

  try {
    // 1. Read the uploaded file from form data
    const formData = await request.formData();
    const file = formData.get('backup') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No backup file provided' }, { status: 400 });
    }

    // 2. Write uploaded file to temp location
    const arrayBuffer = await file.arrayBuffer();
    fs.writeFileSync(uploadPath, Buffer.from(arrayBuffer));

    // 3. Extract archive
    execSync(`tar -xzf ${JSON.stringify(uploadPath)} -C ${JSON.stringify(tmpDir)}`);

    // 4. Validate structure
    const hasMetadata = fs.existsSync(path.join(tmpDir, 'backup-metadata.json'));
    const hasDatabase = fs.existsSync(path.join(tmpDir, 'database', 'clawdify.db'));

    if (!hasMetadata || !hasDatabase) {
      return NextResponse.json(
        { error: 'Invalid backup archive. Missing required files (backup-metadata.json, database/clawdify.db).' },
        { status: 400 }
      );
    }

    // 5. Create a safety backup of current state before overwriting
    const safetyDir = path.join(os.homedir(), '.clawdify', 'pre-restore-backup');
    fs.mkdirSync(safetyDir, { recursive: true });

    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, path.join(safetyDir, `clawdify.db.${Date.now()}`));
    }

    // 6. Restore database - copy to temp then move atomically
    const tmpDbPath = DB_PATH + '.restoring';
    fs.copyFileSync(path.join(tmpDir, 'database', 'clawdify.db'), tmpDbPath);
    fs.renameSync(tmpDbPath, DB_PATH);

    // Also remove WAL/SHM files if they exist (they'd be stale after restore)
    for (const ext of ['-wal', '-shm']) {
      const walPath = DB_PATH + ext;
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    }

    // 7. Restore workspace files if present in backup
    const workspaceBackup = path.join(tmpDir, 'workspace');
    if (fs.existsSync(workspaceBackup)) {
      // Ensure target directory exists
      fs.mkdirSync(WORKSPACE_PATH, { recursive: true });
      execSync(`cp -a ${JSON.stringify(workspaceBackup)}/. ${JSON.stringify(WORKSPACE_PATH)}/`);
    }

    logAudit('backup_restored', JSON.stringify({
      uploadSize: arrayBuffer.byteLength,
      hasWorkspace: fs.existsSync(workspaceBackup),
    }));

    return NextResponse.json({
      success: true,
      message: 'Backup restored successfully. You may need to restart the application for all changes to take effect.',
    });
  } catch (error) {
    console.error('Restore failed:', error);
    logAudit('restore_failed', String(error));
    return NextResponse.json(
      { error: 'Failed to restore backup', details: String(error) },
      { status: 500 }
    );
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      if (fs.existsSync(uploadPath)) fs.unlinkSync(uploadPath);
    } catch { /* ignore cleanup errors */ }
  }
}

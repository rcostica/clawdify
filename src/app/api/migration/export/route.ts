import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import JSZip from 'jszip';
import { sqlite, DB_PATH } from '@/lib/db/sqlite';
import { db, projects, threads, messages, tasks, settings, sessionSummaries } from '@/lib/db';
import { logAudit } from '@/lib/audit';

const CLAWDIFY_DIR = path.join(os.homedir(), '.clawdify');

function addDirectoryToZip(zip: JSZip, dirPath: string, zipPath: string) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const entryZipPath = zipPath ? `${zipPath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      // Skip node_modules, .git, .next, and other large/irrelevant dirs
      if (['node_modules', '.git', '.next', '__pycache__', '.venv'].includes(entry.name)) continue;
      addDirectoryToZip(zip, fullPath, entryZipPath);
    } else if (entry.isFile()) {
      // Skip files larger than 50MB
      try {
        const stat = fs.statSync(fullPath);
        if (stat.size > 50 * 1024 * 1024) continue;
      } catch { continue; }
      try {
        zip.file(entryZipPath, fs.readFileSync(fullPath));
      } catch { /* skip unreadable files */ }
    }
  }
}

export async function POST() {
  const tmpDbPath = path.join(os.tmpdir(), `clawdify-migration-db-${Date.now()}.db`);

  try {
    // 1. Backup the database to a temp file
    await sqlite.backup(tmpDbPath);

    // 2. Gather metadata from the live DB
    const allProjects = db.select().from(projects).all();
    const allThreads = db.select().from(threads).all();
    const allMessages = db.select().from(messages).all();
    const allTasks = db.select().from(tasks).all();
    const allSettings = db.select().from(settings).all();
    const allSummaries = db.select().from(sessionSummaries).all();

    // 3. Create zip
    const zip = new JSZip();

    // Metadata
    const metadata = {
      version: 2,
      type: 'clawdify-migration',
      createdAt: new Date().toISOString(),
      hostname: os.hostname(),
      dbPath: DB_PATH,
      stats: {
        projects: allProjects.length,
        threads: allThreads.length,
        messages: allMessages.length,
        tasks: allTasks.length,
        settings: allSettings.length,
        sessionSummaries: allSummaries.length,
      },
      projectSummary: allProjects.map(p => ({
        id: p.id,
        name: p.name,
        status: p.status,
        workspacePath: p.workspacePath,
        icon: p.icon,
      })),
    };
    zip.file('migration-metadata.json', JSON.stringify(metadata, null, 2));

    // Database backup
    zip.file('database/clawdify.db', fs.readFileSync(tmpDbPath));

    // JSON exports (for analyze without needing to read the SQLite)
    zip.file('data/projects.json', JSON.stringify(allProjects, null, 2));
    zip.file('data/threads.json', JSON.stringify(allThreads, null, 2));
    zip.file('data/messages.json', JSON.stringify(allMessages, null, 2));
    zip.file('data/tasks.json', JSON.stringify(allTasks, null, 2));
    zip.file('data/settings.json', JSON.stringify(allSettings, null, 2));
    zip.file('data/session_summaries.json', JSON.stringify(allSummaries, null, 2));

    // 4. Include workspace files for each project
    for (const project of allProjects) {
      if (!project.workspacePath) continue;

      // workspacePath might be relative (e.g., "projects/my-project") or absolute
      let fullWorkspacePath: string;
      if (path.isAbsolute(project.workspacePath)) {
        fullWorkspacePath = project.workspacePath;
      } else {
        // Relative paths are relative to CLAWDIFY_DIR or a workspace root
        fullWorkspacePath = path.join(CLAWDIFY_DIR, project.workspacePath);
        if (!fs.existsSync(fullWorkspacePath)) {
          // Try from process.env.OPENCLAW_WORKSPACE_PATH
          const wsPath = process.env.OPENCLAW_WORKSPACE_PATH || path.join(os.homedir(), '.openclaw', 'workspace');
          fullWorkspacePath = path.join(wsPath, project.workspacePath);
        }
      }

      if (fs.existsSync(fullWorkspacePath)) {
        addDirectoryToZip(zip, fullWorkspacePath, `workspaces/${project.id}`);
      }
    }

    // 5. Include .clawdify config files (CONTEXT.md, etc.) but not the DB itself
    const clawdifyConfigDir = CLAWDIFY_DIR;
    if (fs.existsSync(clawdifyConfigDir)) {
      const configEntries = fs.readdirSync(clawdifyConfigDir, { withFileTypes: true });
      for (const entry of configEntries) {
        // Skip the DB files and project workspaces (already included above)
        if (entry.name.startsWith('clawdify.db')) continue;
        if (entry.name === 'projects') continue; // workspace files already handled
        if (entry.name === 'pre-restore-backup') continue;

        const fullPath = path.join(clawdifyConfigDir, entry.name);
        if (entry.isFile()) {
          try {
            const stat = fs.statSync(fullPath);
            if (stat.size < 10 * 1024 * 1024) { // <10MB
              zip.file(`config/${entry.name}`, fs.readFileSync(fullPath));
            }
          } catch { /* skip */ }
        } else if (entry.isDirectory()) {
          addDirectoryToZip(zip, fullPath, `config/${entry.name}`);
        }
      }
    }

    // 6. Generate the zip buffer
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `clawdify-migration-${timestamp}.zip`;

    logAudit('migration_export', JSON.stringify({
      filename,
      sizeBytes: zipBuffer.length,
      stats: metadata.stats,
    }));

    return new Response(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(zipBuffer.length),
      },
    });
  } catch (error) {
    console.error('Migration export failed:', error);
    logAudit('migration_export_failed', String(error));
    return NextResponse.json(
      { error: 'Failed to create migration archive', details: String(error) },
      { status: 500 }
    );
  } finally {
    try {
      if (fs.existsSync(tmpDbPath)) fs.unlinkSync(tmpDbPath);
      // Clean up WAL/SHM files from backup
      for (const ext of ['-wal', '-shm']) {
        const walPath = tmpDbPath + ext;
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      }
    } catch { /* ignore */ }
  }
}

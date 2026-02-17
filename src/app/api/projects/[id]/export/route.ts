import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { db, projects, threads, messages, tasks } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { logAudit } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawdify-export-'));
  const archivePath = path.join(os.tmpdir(), `clawdify-export-${id}-${Date.now()}.tar.gz`);

  try {
    // 1. Get project
    const project = db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 2. Export project data as JSON
    const dataDir = path.join(tmpDir, 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    // Project metadata
    fs.writeFileSync(path.join(dataDir, 'project.json'), JSON.stringify(project, null, 2));

    // Threads
    const projectThreads = db.select().from(threads).where(eq(threads.projectId, id)).all();
    fs.writeFileSync(path.join(dataDir, 'threads.json'), JSON.stringify(projectThreads, null, 2));

    // Messages for each thread
    const allMessages: Record<string, unknown[]> = {};
    for (const thread of projectThreads) {
      const threadMessages = db.select().from(messages).where(eq(messages.threadId, thread.id)).all();
      allMessages[thread.id] = threadMessages;
    }
    fs.writeFileSync(path.join(dataDir, 'messages.json'), JSON.stringify(allMessages, null, 2));

    // Tasks
    const projectTasks = db.select().from(tasks).where(eq(tasks.projectId, id)).all();
    fs.writeFileSync(path.join(dataDir, 'tasks.json'), JSON.stringify(projectTasks, null, 2));

    // 3. Copy workspace files if the project has a workspace path
    if (project.workspacePath && fs.existsSync(project.workspacePath)) {
      const filesDir = path.join(tmpDir, 'files');
      execSync(`cp -a ${JSON.stringify(project.workspacePath)} ${JSON.stringify(filesDir)}`);
    }

    // 4. Write export metadata
    const metadata = {
      version: 1,
      type: 'project-export',
      projectId: id,
      projectName: project.name,
      createdAt: new Date().toISOString(),
      threadCount: projectThreads.length,
      taskCount: projectTasks.length,
    };
    fs.writeFileSync(path.join(tmpDir, 'export-metadata.json'), JSON.stringify(metadata, null, 2));

    // 5. Create tar.gz
    execSync(`tar -czf ${JSON.stringify(archivePath)} -C ${JSON.stringify(tmpDir)} .`);

    const archiveBuffer = fs.readFileSync(archivePath);
    const safeName = project.name.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 50);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${safeName}-export-${timestamp}.tar.gz`;

    logAudit('project_exported', JSON.stringify({ projectId: id, projectName: project.name, filename }));

    return new Response(archiveBuffer, {
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(archiveBuffer.length),
      },
    });
  } catch (error) {
    console.error('Export failed:', error);
    logAudit('project_export_failed', JSON.stringify({ projectId: id, error: String(error) }));
    return NextResponse.json(
      { error: 'Failed to export project', details: String(error) },
      { status: 500 }
    );
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath);
    } catch { /* ignore cleanup errors */ }
  }
}

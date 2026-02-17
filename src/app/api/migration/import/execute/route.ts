import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { db, projects, threads, messages, tasks, settings, sessionSummaries } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { logAudit } from '@/lib/audit';

const CLAWDIFY_DIR = path.join(os.homedir(), '.clawdify');

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('archive') as File | null;
    const skipProjectsRaw = formData.get('skipProjects') as string | null;
    const importSettingsFlag = formData.get('importSettings') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No archive file provided' }, { status: 400 });
    }

    const skipProjects = new Set<string>(
      skipProjectsRaw ? JSON.parse(skipProjectsRaw) : []
    );

    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Validate
    const metadataFile = zip.file('migration-metadata.json');
    if (!metadataFile) {
      return NextResponse.json({ error: 'Invalid migration archive' }, { status: 400 });
    }

    // Read data files
    const projectsFile = zip.file('data/projects.json');
    const threadsFile = zip.file('data/threads.json');
    const messagesFile = zip.file('data/messages.json');
    const tasksFile = zip.file('data/tasks.json');
    const settingsFile = zip.file('data/settings.json');
    const summariesFile = zip.file('data/session_summaries.json');

    if (!projectsFile || !threadsFile || !messagesFile || !tasksFile) {
      return NextResponse.json({ error: 'Invalid migration archive: missing data files' }, { status: 400 });
    }

    const importProjects: Record<string, unknown>[] = JSON.parse(await projectsFile.async('text'));
    const importThreads: Record<string, unknown>[] = JSON.parse(await threadsFile.async('text'));
    const importMessages: Record<string, unknown>[] = JSON.parse(await messagesFile.async('text'));
    const importTasks: Record<string, unknown>[] = JSON.parse(await tasksFile.async('text'));
    const importSettings: Record<string, unknown>[] = settingsFile ? JSON.parse(await settingsFile.async('text')) : [];
    const importSummaries: Record<string, unknown>[] = summariesFile ? JSON.parse(await summariesFile.async('text')) : [];

    // Get existing IDs to avoid conflicts
    const existingProjects = db.select().from(projects).all();
    const existingProjectIds = new Set(existingProjects.map(p => p.id));
    const existingThreads = db.select().from(threads).all();
    const existingThreadIds = new Set(existingThreads.map(t => t.id));

    const results = {
      projectsImported: 0,
      projectsSkipped: 0,
      threadsImported: 0,
      messagesImported: 0,
      tasksImported: 0,
      settingsImported: 0,
      summariesImported: 0,
      workspaceFilesRestored: 0,
      orphanedThreads: 0,
      errors: [] as string[],
    };

    // Import projects
    const importedProjectIds = new Set<string>();
    for (const proj of importProjects) {
      const projId = proj.id as string;

      // Skip if user chose to skip or if project already exists
      if (skipProjects.has(projId)) {
        results.projectsSkipped++;
        continue;
      }

      if (existingProjectIds.has(projId)) {
        results.projectsSkipped++;
        continue;
      }

      try {
        db.insert(projects).values({
          id: projId,
          name: proj.name as string,
          description: (proj.description as string) || null,
          parentId: (proj.parentId as string) || null,
          icon: (proj.icon as string) || '📁',
          color: (proj.color as string) || null,
          status: (proj.status as 'active' | 'archived') || 'active',
          sortOrder: (proj.sortOrder as number) || 0,
          workspacePath: (proj.workspacePath as string) || `projects/${projId}`,
          sessionKey: (proj.sessionKey as string) || null,
          createdAt: proj.createdAt ? new Date(proj.createdAt as string | number) : new Date(),
          updatedAt: proj.updatedAt ? new Date(proj.updatedAt as string | number) : new Date(),
        }).run();
        importedProjectIds.add(projId);
        results.projectsImported++;
      } catch (err) {
        results.errors.push(`Failed to import project "${proj.name}": ${String(err)}`);
      }
    }

    // Import threads (only for imported projects)
    const importedThreadIds = new Set<string>();
    for (const thread of importThreads) {
      const threadId = thread.id as string;
      const projectId = thread.projectId as string;

      if (!importedProjectIds.has(projectId)) {
        // Check if this is an orphaned thread
        if (!existingProjectIds.has(projectId)) {
          results.orphanedThreads++;
        }
        continue;
      }

      if (existingThreadIds.has(threadId)) continue;

      try {
        db.insert(threads).values({
          id: threadId,
          projectId,
          title: (thread.title as string) || 'Imported Thread',
          sessionKey: (thread.sessionKey as string) || `imported:${threadId}`,
          isPinned: (thread.isPinned as boolean) || false,
          createdAt: thread.createdAt ? new Date(thread.createdAt as string | number) : new Date(),
          updatedAt: thread.updatedAt ? new Date(thread.updatedAt as string | number) : new Date(),
        }).run();
        importedThreadIds.add(threadId);
        results.threadsImported++;
      } catch (err) {
        results.errors.push(`Failed to import thread: ${String(err)}`);
      }
    }

    // Import messages (only for imported threads)
    for (const msg of importMessages) {
      const threadId = msg.threadId as string;
      if (!importedThreadIds.has(threadId)) continue;

      try {
        db.insert(messages).values({
          id: msg.id as string,
          threadId,
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content as string,
          model: (msg.model as string) || null,
          tokensUsed: (msg.tokensUsed as number) || null,
          createdAt: msg.createdAt ? new Date(msg.createdAt as string | number) : new Date(),
        }).onConflictDoNothing().run();
        results.messagesImported++;
      } catch { /* skip duplicates */ }
    }

    // Import tasks (only for imported projects)
    for (const task of importTasks) {
      const projectId = task.projectId as string;
      if (!importedProjectIds.has(projectId)) continue;

      try {
        db.insert(tasks).values({
          id: task.id as string,
          projectId,
          title: task.title as string,
          description: (task.description as string) || null,
          status: (task.status as 'backlog' | 'in-progress' | 'review' | 'done') || 'backlog',
          priority: (task.priority as 'low' | 'medium' | 'high') || 'medium',
          assignedTo: (task.assignedTo as 'user' | 'agent' | 'sub-agent') || null,
          subAgentSessionId: (task.subAgentSessionId as string) || null,
          dueDate: task.dueDate ? new Date(task.dueDate as string | number) : null,
          sortOrder: (task.sortOrder as number) || 0,
          createdAt: task.createdAt ? new Date(task.createdAt as string | number) : new Date(),
          updatedAt: task.updatedAt ? new Date(task.updatedAt as string | number) : new Date(),
        }).onConflictDoNothing().run();
        results.tasksImported++;
      } catch { /* skip duplicates */ }
    }

    // Import session summaries (only for imported threads)
    for (const summary of importSummaries) {
      const threadId = summary.threadId as string;
      if (!importedThreadIds.has(threadId)) continue;

      try {
        db.insert(sessionSummaries).values({
          id: summary.id as string,
          threadId,
          content: summary.content as string,
          messageCount: summary.messageCount as number,
          firstMessageAt: new Date(summary.firstMessageAt as string | number),
          lastMessageAt: new Date(summary.lastMessageAt as string | number),
          lastMessageId: (summary.lastMessageId as string) || null,
          createdAt: summary.createdAt ? new Date(summary.createdAt as string | number) : new Date(),
        }).onConflictDoNothing().run();
        results.summariesImported++;
      } catch { /* skip duplicates */ }
    }

    // Import settings (if opted in)
    if (importSettingsFlag && importSettings.length > 0) {
      for (const setting of importSettings) {
        try {
          // Use upsert - update if key exists, insert if not
          const existingSetting = db.select().from(settings)
            .where(eq(settings.key, setting.key as string)).get();

          if (!existingSetting) {
            db.insert(settings).values({
              key: setting.key as string,
              value: setting.value as string,
              updatedAt: new Date(),
            }).run();
            results.settingsImported++;
          }
        } catch { /* skip */ }
      }
    }

    // Restore workspace files for imported projects
    for (const projId of importedProjectIds) {
      const proj = importProjects.find(p => p.id === projId);
      if (!proj) continue;

      const workspacePath = proj.workspacePath as string;
      if (!workspacePath) continue;

      let fullWorkspacePath: string;
      if (path.isAbsolute(workspacePath)) {
        fullWorkspacePath = workspacePath;
      } else {
        fullWorkspacePath = path.join(CLAWDIFY_DIR, workspacePath);
      }

      // Extract workspace files from the archive
      const prefix = `workspaces/${projId}/`;
      const workspaceFiles = Object.keys(zip.files).filter(
        f => f.startsWith(prefix) && !zip.files[f].dir
      );

      if (workspaceFiles.length > 0) {
        fs.mkdirSync(fullWorkspacePath, { recursive: true });

        for (const filePath of workspaceFiles) {
          const relativePath = filePath.slice(prefix.length);
          const targetPath = path.join(fullWorkspacePath, relativePath);

          try {
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            const content = await zip.files[filePath].async('nodebuffer');
            fs.writeFileSync(targetPath, content);
            results.workspaceFilesRestored++;
          } catch (err) {
            results.errors.push(`Failed to restore file ${relativePath}: ${String(err)}`);
          }
        }
      }
    }

    // Restore config files
    const configPrefix = 'config/';
    const configFiles = Object.keys(zip.files).filter(
      f => f.startsWith(configPrefix) && !zip.files[f].dir
    );
    for (const filePath of configFiles) {
      const relativePath = filePath.slice(configPrefix.length);
      const targetPath = path.join(CLAWDIFY_DIR, relativePath);

      // Don't overwrite existing files
      if (fs.existsSync(targetPath)) continue;

      try {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        const content = await zip.files[filePath].async('nodebuffer');
        fs.writeFileSync(targetPath, content);
      } catch { /* skip */ }
    }

    logAudit('migration_import', JSON.stringify(results));

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Migration import failed:', error);
    logAudit('migration_import_failed', String(error));
    return NextResponse.json(
      { error: 'Failed to import migration archive', details: String(error) },
      { status: 500 }
    );
  }
}

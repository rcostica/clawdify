import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { db, projects } from '@/lib/db';

interface ProjectInfo {
  id: string;
  name: string;
  icon?: string;
  status?: string;
  workspacePath?: string;
  threadCount: number;
  messageCount: number;
  taskCount: number;
  hasWorkspaceFiles: boolean;
  conflict: boolean;
  conflictProjectId?: string;
}

interface AnalysisResult {
  valid: boolean;
  error?: string;
  metadata: {
    version: number;
    createdAt: string;
    hostname: string;
    stats: {
      projects: number;
      threads: number;
      messages: number;
      tasks: number;
      settings: number;
      sessionSummaries: number;
    };
  } | null;
  projects: ProjectInfo[];
  orphanedThreads: { id: string; title: string; messageCount: number }[];
  settingsCount: number;
  summariesCount: number;
  totalSizeBytes: number;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('archive') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No archive file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Check for migration metadata
    const metadataFile = zip.file('migration-metadata.json');
    if (!metadataFile) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid migration archive: missing migration-metadata.json',
      } as AnalysisResult, { status: 400 });
    }

    const metadata = JSON.parse(await metadataFile.async('text'));

    // Read JSON data files
    const projectsFile = zip.file('data/projects.json');
    const threadsFile = zip.file('data/threads.json');
    const messagesFile = zip.file('data/messages.json');
    const tasksFile = zip.file('data/tasks.json');
    const settingsFile = zip.file('data/settings.json');
    const summariesFile = zip.file('data/session_summaries.json');

    if (!projectsFile || !threadsFile || !messagesFile || !tasksFile) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid migration archive: missing data files',
      } as AnalysisResult, { status: 400 });
    }

    const importProjects = JSON.parse(await projectsFile.async('text'));
    const importThreads = JSON.parse(await threadsFile.async('text'));
    const importMessages = JSON.parse(await messagesFile.async('text'));
    const importTasks = JSON.parse(await tasksFile.async('text'));
    const importSettings = settingsFile ? JSON.parse(await settingsFile.async('text')) : [];
    const importSummaries = summariesFile ? JSON.parse(await summariesFile.async('text')) : [];

    // Get existing projects to detect conflicts
    const existingProjects = db.select().from(projects).all();
    const existingById = new Map(existingProjects.map(p => [p.id, p]));
    const existingByName = new Map(existingProjects.map(p => [p.name.toLowerCase(), p]));

    // Analyze each project
    const projectInfos: ProjectInfo[] = [];
    const projectIds = new Set(importProjects.map((p: { id: string }) => p.id));

    for (const proj of importProjects) {
      const projThreads = importThreads.filter((t: { projectId: string }) => t.projectId === proj.id);
      const threadIds = new Set(projThreads.map((t: { id: string }) => t.id));
      const projMessages = importMessages.filter((m: { threadId: string }) => threadIds.has(m.threadId));
      const projTasks = importTasks.filter((t: { projectId: string }) => t.projectId === proj.id);

      // Check for workspace files in the archive
      const workspacePrefix = `workspaces/${proj.id}/`;
      const hasWorkspaceFiles = Object.keys(zip.files).some(f => f.startsWith(workspacePrefix) && !zip.files[f].dir);

      // Detect conflicts
      const existingById_match = existingById.get(proj.id);
      const existingByName_match = existingByName.get(proj.name?.toLowerCase());
      const conflict = !!existingById_match || !!existingByName_match;

      projectInfos.push({
        id: proj.id,
        name: proj.name,
        icon: proj.icon,
        status: proj.status,
        workspacePath: proj.workspacePath,
        threadCount: projThreads.length,
        messageCount: projMessages.length,
        taskCount: projTasks.length,
        hasWorkspaceFiles,
        conflict,
        conflictProjectId: existingById_match?.id || existingByName_match?.id,
      });
    }

    // Find orphaned threads (threads without a valid project in the archive)
    const orphanedThreads = importThreads
      .filter((t: { projectId: string }) => !projectIds.has(t.projectId))
      .map((t: { id: string; title: string; projectId: string }) => {
        const threadMessages = importMessages.filter((m: { threadId: string }) => m.threadId === t.id);
        return {
          id: t.id,
          title: t.title,
          messageCount: threadMessages.length,
        };
      });

    const result: AnalysisResult = {
      valid: true,
      metadata: {
        version: metadata.version,
        createdAt: metadata.createdAt,
        hostname: metadata.hostname,
        stats: metadata.stats,
      },
      projects: projectInfos,
      orphanedThreads,
      settingsCount: importSettings.length,
      summariesCount: importSummaries.length,
      totalSizeBytes: arrayBuffer.byteLength,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Migration analyze failed:', error);
    return NextResponse.json(
      { valid: false, error: `Failed to analyze archive: ${String(error)}` },
      { status: 500 }
    );
  }
}

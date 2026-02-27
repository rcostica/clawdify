import { NextRequest, NextResponse } from 'next/server';
import { db, projects } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { logAudit } from '@/lib/audit';

const WORKSPACE_PATH = process.env.OPENCLAW_WORKSPACE_PATH || '';

// Folders to skip during discovery
const SKIP_FOLDERS = new Set([
  '.git', '.openclaw', '.pi', '.clawdify', 'node_modules',
  '_uploads', 'backups', '.next', '.cache', 'memory'
]);

// Known system files at workspace root
const SYSTEM_FILES = new Set([
  'AGENTS.md', 'SOUL.md', 'USER.md', 'IDENTITY.md', 'MEMORY.md',
  'TOOLS.md', 'HEARTBEAT.md', 'BACKLOG.md', 'BOOTSTRAP.md',
  'CONTEXT.md', 'WORKFLOW_AUTO.md', '.gitignore'
]);

interface DiscoveredFolder {
  name: string;
  relativePath: string;
  fileCount: number;
  hasReadme: boolean;
  readmePreview: string | null;
  hasContextMd: boolean;
  alreadyLinked: boolean;  // true if a Clawdify project already points here
  linkedProjectName: string | null;
  children: DiscoveredFolder[];
}

function scanFolder(basePath: string, relativePath: string, depth: number = 0): DiscoveredFolder | null {
  const fullPath = path.join(basePath, relativePath);
  const folderName = path.basename(relativePath);

  if (SKIP_FOLDERS.has(folderName)) return null;
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) return null;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(fullPath, { withFileTypes: true });
  } catch {
    return null;
  }

  const files = entries.filter(e => e.isFile());
  const dirs = entries.filter(e => e.isDirectory() && !SKIP_FOLDERS.has(e.name));

  // Read README preview
  let readmePreview: string | null = null;
  let hasReadme = false;
  const readmeFile = files.find(f => f.name.toLowerCase() === 'readme.md');
  if (readmeFile) {
    hasReadme = true;
    try {
      const content = fs.readFileSync(path.join(fullPath, readmeFile.name), 'utf-8');
      readmePreview = content.slice(0, 300).trim();
      if (content.length > 300) readmePreview += '...';
    } catch { /* ignore */ }
  }

  const hasContextMd = files.some(f => f.name === 'CONTEXT.md');

  // Scan children (max 2 levels deep)
  const children: DiscoveredFolder[] = [];
  if (depth < 2) {
    for (const dir of dirs) {
      const child = scanFolder(basePath, path.join(relativePath, dir.name), depth + 1);
      if (child) children.push(child);
    }
  }

  return {
    name: folderName,
    relativePath,
    fileCount: files.length,
    hasReadme,
    readmePreview,
    hasContextMd,
    alreadyLinked: false, // filled in later
    linkedProjectName: null,
    children,
  };
}

// GET /api/discover - Scan workspace for discoverable folders
export async function GET() {
  if (!WORKSPACE_PATH) {
    return NextResponse.json({ error: 'No workspace path configured' }, { status: 400 });
  }

  try {
    // Get all existing projects and their workspace paths
    const existingProjects = db.select().from(projects).all();
    const linkedPaths = new Map<string, string>(); // workspacePath → projectName
    for (const p of existingProjects) {
      linkedPaths.set(p.workspacePath, p.name);
    }

    // Scan the workspace root
    const entries = fs.readdirSync(WORKSPACE_PATH, { withFileTypes: true });
    const discovered: DiscoveredFolder[] = [];

    // Helper: check if a folder path is already linked to a project
    const markLinked = (folder: DiscoveredFolder) => {
      // Try multiple path patterns (with/without projects/ prefix)
      const base = folder.relativePath;
      const possiblePaths = [base, `projects/${base}`, base.replace(/^projects\//, '')];
      for (const pp of possiblePaths) {
        if (linkedPaths.has(pp)) {
          folder.alreadyLinked = true;
          folder.linkedProjectName = linkedPaths.get(pp) || null;
          break;
        }
      }
      // Recurse into children
      for (const child of folder.children) markLinked(child);
    };

    // Scan top-level directories
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (SKIP_FOLDERS.has(entry.name)) continue;

      const folder = scanFolder(WORKSPACE_PATH, entry.name);
      if (!folder) continue;

      // "projects" is a container — promote its children to top-level
      if (entry.name === 'projects') {
        for (const child of folder.children) {
          markLinked(child);
          discovered.push(child);
        }
        continue;
      }

      markLinked(folder);
      discovered.push(folder);
    }

    return NextResponse.json({
      workspacePath: WORKSPACE_PATH,
      discovered,
      existingProjectCount: existingProjects.length,
    });
  } catch (error) {
    console.error('Error scanning workspace:', error);
    return NextResponse.json({ error: 'Failed to scan workspace' }, { status: 500 });
  }
}

// POST /api/discover - Create projects from selected folders
export async function POST(request: NextRequest) {
  if (!WORKSPACE_PATH) {
    return NextResponse.json({ error: 'No workspace path configured' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { folders } = body as { folders: Array<{ relativePath: string; name?: string; icon?: string; parentWorkspacePath?: string }> };

    if (!Array.isArray(folders) || folders.length === 0) {
      return NextResponse.json({ error: 'No folders selected' }, { status: 400 });
    }

    const created: Array<{ id: string; name: string; workspacePath: string }> = [];
    const errors: Array<{ path: string; error: string }> = [];

    for (const folder of folders) {
      const fullPath = path.join(WORKSPACE_PATH, folder.relativePath);

      // Validate the folder exists
      if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
        errors.push({ path: folder.relativePath, error: 'Folder not found' });
        continue;
      }

      // Check if already linked
      const existing = db.select().from(projects)
        .where(eq(projects.workspacePath, folder.relativePath))
        .get();
      if (existing) {
        errors.push({ path: folder.relativePath, error: `Already linked to project "${existing.name}"` });
        continue;
      }

      // Determine project name
      const projectName = folder.name || prettifyFolderName(path.basename(folder.relativePath));

      // Read description from README if available
      let description: string | null = null;
      const readmePath = path.join(fullPath, 'README.md');
      if (fs.existsSync(readmePath)) {
        try {
          const content = fs.readFileSync(readmePath, 'utf-8');
          // Extract first paragraph after the title
          const lines = content.split('\n').filter(l => l.trim());
          const descLine = lines.find(l => !l.startsWith('#'));
          if (descLine) description = descLine.trim().slice(0, 200);
        } catch { /* ignore */ }
      }

      // Resolve parentId from parentWorkspacePath
      let parentId: string | null = null;
      if (folder.parentWorkspacePath) {
        const parent = db.select().from(projects)
          .where(eq(projects.workspacePath, folder.parentWorkspacePath))
          .get();
        if (parent) parentId = parent.id;
      }

      const id = uuidv4();
      const now = new Date();

      db.insert(projects).values({
        id,
        name: projectName,
        description,
        parentId,
        icon: folder.icon || guessIcon(path.basename(folder.relativePath)),
        color: null,
        status: 'active',
        sortOrder: 0,
        workspacePath: folder.relativePath,
        sessionKey: null,
        createdAt: now,
        updatedAt: now,
      }).run();

      logAudit('project_discovered', JSON.stringify({
        id,
        name: projectName,
        workspacePath: folder.relativePath,
      }));

      created.push({ id, name: projectName, workspacePath: folder.relativePath });
    }

    return NextResponse.json({ created, errors });
  } catch (error) {
    console.error('Error creating projects from discovery:', error);
    return NextResponse.json({ error: 'Failed to create projects' }, { status: 500 });
  }
}

function prettifyFolderName(name: string): string {
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

function guessIcon(folderName: string): string {
  const lower = folderName.toLowerCase();
  if (lower.includes('wedding') || lower.includes('rsvp')) return '💒';
  if (lower.includes('menu') || lower.includes('food') || lower.includes('restaurant')) return '🍽️';
  if (lower.includes('ai') || lower.includes('bot') || lower.includes('agent')) return '🤖';
  if (lower.includes('crypto') || lower.includes('token') || lower.includes('web3')) return '🪙';
  if (lower.includes('docs') || lower.includes('doc')) return '📚';
  if (lower.includes('test')) return '🧪';
  if (lower.includes('design') || lower.includes('ui')) return '🎨';
  if (lower.includes('api') || lower.includes('server')) return '⚡';
  if (lower.includes('claw')) return '🦞';
  return '📁';
}

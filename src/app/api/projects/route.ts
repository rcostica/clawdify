import { NextRequest, NextResponse } from 'next/server';
import { db, projects, type NewProject } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { logAudit } from '@/lib/audit';

const WORKSPACE_PATH = process.env.OPENCLAW_WORKSPACE_PATH || '';

// GET /api/projects - List all projects
export async function GET() {
  try {
    const allProjects = db.select().from(projects).all();
    return NextResponse.json({ projects: allProjects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, parentId, icon, color, sessionKey } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    const id = uuidv4();
    const now = new Date();
    
    // Create workspace folder name (sanitized)
    const folderName = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const workspacePath = `projects/${folderName}`;

    // Create the folder in workspace if configured
    if (WORKSPACE_PATH) {
      const fullPath = path.join(WORKSPACE_PATH, workspacePath);
      await fs.mkdir(fullPath, { recursive: true });
      
      // Create a basic README
      const readmePath = path.join(fullPath, 'README.md');
      await fs.writeFile(
        readmePath,
        `# ${name}\n\n${description || 'Project description here.'}\n\nCreated: ${now.toISOString()}\n`,
        'utf-8'
      );
    }

    const newProject: NewProject = {
      id,
      name: name.trim(),
      description: description || null,
      parentId: parentId || null,
      icon: icon || '📁',
      color: color || null,
      status: 'active',
      workspacePath,
      sessionKey: sessionKey || null,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(projects).values(newProject).run();
    logAudit('project_created', JSON.stringify({ id, name: name.trim() }));

    return NextResponse.json({ project: newProject }, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}

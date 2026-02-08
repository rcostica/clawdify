import { NextRequest, NextResponse } from 'next/server';
import { db, projects } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { logAudit } from '@/lib/audit';

// GET /api/projects/[id] - Get a single project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = db.select().from(projects).where(eq(projects.id, id)).get();

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id] - Update a project
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, parentId, icon, color, status, sessionKey } = body;

    const existing = db.select().from(projects).where(eq(projects.id, id)).get();
    if (!existing) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const updates: Partial<typeof projects.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (parentId !== undefined) updates.parentId = parentId;
    if (icon !== undefined) updates.icon = icon;
    if (color !== undefined) updates.color = color;
    if (status !== undefined) updates.status = status;
    if (sessionKey !== undefined) updates.sessionKey = sessionKey;

    db.update(projects).set(updates).where(eq(projects.id, id)).run();

    const updated = db.select().from(projects).where(eq(projects.id, id)).get();
    return NextResponse.json({ project: updated });
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - Delete a project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const existing = db.select().from(projects).where(eq(projects.id, id)).get();
    if (!existing) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Archive instead of delete (soft delete)
    db.update(projects)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(projects.id, id))
      .run();
    logAudit('project_deleted', JSON.stringify({ id, name: existing.name }));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}

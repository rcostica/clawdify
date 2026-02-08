import { NextRequest, NextResponse } from 'next/server';
import { db, tasks, type NewTask } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// GET /api/tasks?projectId=xxx&status=backlog
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');

    let query = db.select().from(tasks);
    
    if (projectId) {
      query = query.where(eq(tasks.projectId, projectId)) as typeof query;
    }

    const allTasks = query.orderBy(tasks.sortOrder).all();
    return NextResponse.json({ tasks: allTasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

// POST /api/tasks — Create a new task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, title, description, status, priority } = body;

    if (!projectId || !title) {
      return NextResponse.json({ error: 'projectId and title required' }, { status: 400 });
    }

    const now = new Date();
    const newTask: NewTask = {
      id: uuidv4(),
      projectId,
      title,
      description: description || null,
      status: status || 'backlog',
      priority: priority || 'medium',
      sortOrder: Date.now(),
      createdAt: now,
      updatedAt: now,
    };

    db.insert(tasks).values(newTask).run();
    return NextResponse.json({ task: newTask }, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { db, auditLogs } from '@/lib/db';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const logs = db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(50)
      .all();
    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Audit log error:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}

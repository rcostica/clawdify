import { db, auditLogs } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export function logAudit(action: string, details?: string) {
  try {
    db.insert(auditLogs).values({
      id: uuidv4(),
      action,
      details: details || null,
      createdAt: new Date(),
    }).run();
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
}

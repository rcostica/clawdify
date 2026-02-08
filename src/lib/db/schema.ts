import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Projects
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  parentId: text('parent_id'),
  icon: text('icon').default('📁'),
  color: text('color'),
  status: text('status', { enum: ['active', 'archived'] }).default('active').notNull(),
  workspacePath: text('workspace_path').notNull(),
  sessionKey: text('session_key'), // null = use shared main session
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Threads (conversations within projects)
export const threads = sqliteTable('threads', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id).notNull(),
  title: text('title').notNull(),
  sessionKey: text('session_key').notNull(),
  isPinned: integer('is_pinned', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Messages (stored locally for quick access, synced from Gateway)
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  threadId: text('thread_id').references(() => threads.id).notNull(),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull(),
  model: text('model'),
  tokensUsed: integer('tokens_used'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Tasks (kanban)
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', { enum: ['backlog', 'in-progress', 'review', 'done'] }).default('backlog').notNull(),
  priority: text('priority', { enum: ['low', 'medium', 'high'] }).default('medium').notNull(),
  assignedTo: text('assigned_to', { enum: ['user', 'agent', 'sub-agent'] }),
  subAgentSessionId: text('sub_agent_session_id'),
  dueDate: integer('due_date', { mode: 'timestamp' }),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Auth sessions (for PIN authentication)
export const authSessions = sqliteTable('auth_sessions', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  lastAccessedAt: integer('last_accessed_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
});

// Audit log (optional)
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  sessionId: text('session_id'),
  action: text('action').notNull(),
  details: text('details'), // JSON
  ipAddress: text('ip_address'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Type exports
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Thread = typeof threads.$inferSelect;
export type NewThread = typeof threads.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type AuthSession = typeof authSessions.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

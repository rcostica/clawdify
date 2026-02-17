import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { sqlite } from './sqlite';

// Create Drizzle instance
export const db = drizzle(sqlite, { schema });

// Export schema for convenience
export * from './schema';

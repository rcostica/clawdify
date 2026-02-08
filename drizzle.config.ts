import type { Config } from 'drizzle-kit';
import path from 'path';

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: path.join(process.env.HOME || '/tmp', '.clawdify', 'clawdify.db'),
  },
} satisfies Config;

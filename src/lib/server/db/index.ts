import { drizzle } from 'drizzle-orm/d1';
import * as schemas from './schema';
import * as authSchemas from './schema/auth';

export const getDrizzle = (binding: D1Database) =>
	drizzle(binding, { casing: 'snake_case', schema: { ...schemas, ...authSchemas } });

export type Database = ReturnType<typeof getDrizzle>;

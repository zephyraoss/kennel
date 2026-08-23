import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user } from './auth';

export const TASK_STATUSES = ['open', 'done'] as const;
export const TASK_PRIORITIES = ['none', 'low', 'medium', 'high'] as const;
export const REPEAT_UNITS = ['day', 'week', 'month'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type RepeatUnit = (typeof REPEAT_UNITS)[number];
export type Repeat = { every: RepeatUnit; interval: number };

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export const project = sqliteTable(
	'project',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(now).notNull()
	},
	(t) => [index('project_user_idx').on(t.userId)]
);

export const task = sqliteTable(
	'task',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		projectId: text('project_id').references(() => project.id, { onDelete: 'set null' }),
		title: text('title').notNull(),
		notes: text('notes'),
		labels: text('labels', { mode: 'json' }).$type<string[]>().notNull().default([]),
		status: text('status', { enum: TASK_STATUSES }).notNull().default('open'),
		priority: text('priority', { enum: TASK_PRIORITIES }).notNull().default('none'),
		dueAt: integer('due_at', { mode: 'timestamp_ms' }),
		repeat: text('repeat', { mode: 'json' }).$type<Repeat>(),
		position: integer('position').notNull().default(0),
		completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(now).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(now)
			.$onUpdate(() => new Date())
			.notNull()
	},
	(t) => [index('task_user_status_idx').on(t.userId, t.status)]
);

export type Task = typeof task.$inferSelect;
export type Project = typeof project.$inferSelect;

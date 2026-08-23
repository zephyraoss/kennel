import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user } from './auth';
import { task } from './tasks';

export const REMINDER_STAGES = ['soon', 'due'] as const;
export type ReminderStage = (typeof REMINDER_STAGES)[number];

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export const pushSubscription = sqliteTable(
	'push_subscription',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		endpoint: text('endpoint').notNull().unique(),
		p256dh: text('p256dh').notNull(),
		auth: text('auth').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(now).notNull()
	},
	(t) => [index('push_subscription_user_idx').on(t.userId)]
);

export const taskReminder = sqliteTable('task_reminder', {
	taskId: text('task_id')
		.primaryKey()
		.references(() => task.id, { onDelete: 'cascade' }),
	dueAt: integer('due_at', { mode: 'timestamp_ms' }).notNull(),
	stage: text('stage', { enum: REMINDER_STAGES }).notNull(),
	sentAt: integer('sent_at', { mode: 'timestamp_ms' }).notNull()
});

export type PushSubscription = typeof pushSubscription.$inferSelect;
export type TaskReminder = typeof taskReminder.$inferSelect;

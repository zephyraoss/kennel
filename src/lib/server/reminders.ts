import { and, eq, exists, isNotNull, lte, sql } from 'drizzle-orm';
import type { Database } from './db';
import { pushSubscription, taskReminder, type ReminderStage } from './db/schema/push';
import { task, type Task } from './db/schema/tasks';
import { createPushService, type PushEnv, type PushPayload } from './push';

const DAY_MS = 24 * 60 * 60 * 1000;
const SOON_WINDOW_MS = DAY_MS;
const MAX_TITLES_IN_BODY = 3;

type Stage = ReminderStage;
type DueTask = Task & { dueAt: Date };
type Pending = { task: DueTask; stage: Stage };

const stageFor = (dueAt: Date, now: Date): Stage => (dueAt <= now ? 'due' : 'soon');

const needsReminder = (
	stage: Stage,
	dueAt: Date,
	previous: { dueAt: Date; stage: Stage } | null
) => {
	if (!previous || previous.dueAt.getTime() !== dueAt.getTime()) return true;
	return previous.stage === 'soon' && stage === 'due';
};

const describe = (t: DueTask, now: Date) => {
	if (t.dueAt.getTime() + DAY_MS <= now.getTime()) return 'Overdue';
	return t.dueAt <= now ? 'Due today' : 'Due tomorrow';
};

const listTitles = (tasks: DueTask[]) => {
	const shown = tasks.slice(0, MAX_TITLES_IN_BODY).map((t) => t.title);
	const rest = tasks.length - shown.length;
	return rest > 0 ? `${shown.join(', ')} and ${rest} more` : shown.join(', ');
};

export const composeReminder = (tasks: DueTask[], now: Date): PushPayload => {
	if (tasks.length === 1) {
		return { title: tasks[0].title, body: describe(tasks[0], now), url: '/app', tag: 'kennel-due' };
	}
	const groups = new Map<string, DueTask[]>();
	for (const t of tasks) {
		const label = describe(t, now);
		groups.set(label, [...(groups.get(label) ?? []), t]);
	}
	const body = [...groups].map(([label, group]) => `${label}: ${listTitles(group)}`).join('\n');
	return { title: `${tasks.length} tasks need attention`, body, url: '/app', tag: 'kennel-due' };
};

const hasSubscription = (db: Database) =>
	exists(
		db
			.select({ one: sql`1` })
			.from(pushSubscription)
			.where(eq(pushSubscription.userId, task.userId))
	);

const findPending = async (db: Database, now: Date): Promise<Pending[]> => {
	const horizon = new Date(now.getTime() + SOON_WINDOW_MS);
	const rows = await db
		.select({ task, reminder: taskReminder })
		.from(task)
		.leftJoin(taskReminder, eq(taskReminder.taskId, task.id))
		.where(
			and(
				eq(task.status, 'open'),
				isNotNull(task.dueAt),
				lte(task.dueAt, horizon),
				hasSubscription(db)
			)
		);
	return rows.flatMap(({ task: t, reminder }) => {
		if (!t.dueAt) return [];
		const stage = stageFor(t.dueAt, now);
		return needsReminder(stage, t.dueAt, reminder)
			? [{ task: { ...t, dueAt: t.dueAt }, stage }]
			: [];
	});
};

const groupByUser = (pending: Pending[]) => {
	const byUser = new Map<string, Pending[]>();
	for (const p of pending) byUser.set(p.task.userId, [...(byUser.get(p.task.userId) ?? []), p]);
	return byUser;
};

const recordSent = async (db: Database, pending: Pending[], now: Date) => {
	const rows = pending.map(({ task: t, stage }) => ({
		taskId: t.id,
		dueAt: t.dueAt,
		stage,
		sentAt: now
	}));
	await db
		.insert(taskReminder)
		.values(rows)
		.onConflictDoUpdate({
			target: taskReminder.taskId,
			set: {
				dueAt: sql`excluded.due_at`,
				stage: sql`excluded.stage`,
				sentAt: sql`excluded.sent_at`
			}
		});
};

export const sendDueReminders = async (db: Database, env: PushEnv, now = new Date()) => {
	const push = createPushService(db, env);
	const byUser = groupByUser(await findPending(db, now));
	let users = 0;
	let notifications = 0;
	for (const [userId, pending] of byUser) {
		const payload = composeReminder(
			pending.map((p) => p.task),
			now
		);
		const sent = await push.send(userId, payload);
		if (sent === 0) continue;
		await recordSent(db, pending, now);
		users += 1;
		notifications += sent;
	}
	return { users, notifications };
};

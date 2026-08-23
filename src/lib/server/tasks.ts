import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from './db';
import {
	REPEAT_UNITS,
	TASK_PRIORITIES,
	TASK_STATUSES,
	project,
	task,
	type Project,
	type Task
} from './db/schema/tasks';
import { nextOccurrence } from './recurrence';

const label = z.string().trim().min(1).max(50);

export const repeatInput = z.object({
	every: z.enum(REPEAT_UNITS),
	interval: z.number().int().min(1).max(365).default(1)
});

export const taskInput = z.object({
	title: z.string().trim().min(1).max(500),
	notes: z.string().trim().max(10_000).nullable().optional(),
	priority: z.enum(TASK_PRIORITIES).optional(),
	dueAt: z.iso.datetime().nullable().optional(),
	repeat: repeatInput.nullable().optional(),
	labels: z.array(label).max(20).optional(),
	projectId: z.string().nullable().optional()
});

export const taskPatch = taskInput.partial().extend({
	status: z.enum(TASK_STATUSES).optional()
});

export const taskListQuery = z.object({
	status: z.enum(TASK_STATUSES).optional(),
	projectId: z.string().optional(),
	label: z.string().optional()
});

export const projectInput = z.object({ name: z.string().trim().min(1).max(100) });

export const BACKUP_VERSION = 1;

const backupTask = taskInput.extend({
	status: z.enum(TASK_STATUSES).optional(),
	completedAt: z.iso.datetime().nullable().optional(),
	createdAt: z.iso.datetime().optional()
});

export const backup = z.object({
	version: z.literal(BACKUP_VERSION),
	projects: z.array(projectInput.extend({ id: z.string() })).max(1_000),
	tasks: z.array(backupTask).max(20_000)
});

export type Backup = z.infer<typeof backup>;

export type TaskInput = z.infer<typeof taskInput>;
export type TaskPatch = z.infer<typeof taskPatch>;
export type TaskListQuery = z.infer<typeof taskListQuery>;

export const serializeTask = (t: Task) => ({
	id: t.id,
	title: t.title,
	notes: t.notes,
	labels: t.labels,
	projectId: t.projectId,
	status: t.status,
	priority: t.priority,
	dueAt: t.dueAt?.toISOString() ?? null,
	repeat: t.repeat ?? null,
	completedAt: t.completedAt?.toISOString() ?? null,
	createdAt: t.createdAt.toISOString(),
	updatedAt: t.updatedAt.toISOString()
});

export const serializeProject = (p: Project) => ({
	id: p.id,
	name: p.name,
	createdAt: p.createdAt.toISOString()
});

export type SerializedTask = ReturnType<typeof serializeTask>;
export type SerializedProject = ReturnType<typeof serializeProject>;

const toDate = (value: string | null | undefined) =>
	value === undefined ? undefined : value === null ? null : new Date(value);

const chunk = <T>(items: T[], size: number) =>
	Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
		items.slice(i * size, (i + 1) * size)
	);

export class ProjectNotFound extends Error {}

export const createTaskService = (db: Database, userId: string) => {
	const owned = (id: string) => and(eq(task.id, id), eq(task.userId, userId));

	const projects = {
		list: () =>
			db.select().from(project).where(eq(project.userId, userId)).orderBy(asc(project.name)),
		get: async (id: string) =>
			(
				await db
					.select()
					.from(project)
					.where(and(eq(project.id, id), eq(project.userId, userId)))
					.limit(1)
			)[0] ?? null,
		create: async (name: string) => {
			const [row] = await db
				.insert(project)
				.values({ id: crypto.randomUUID(), userId, name })
				.returning();
			return row;
		},
		rename: async (id: string, name: string) => {
			const [row] = await db
				.update(project)
				.set({ name })
				.where(and(eq(project.id, id), eq(project.userId, userId)))
				.returning();
			return row ?? null;
		},
		remove: async (id: string) => {
			const rows = await db
				.delete(project)
				.where(and(eq(project.id, id), eq(project.userId, userId)))
				.returning({ id: project.id });
			return rows.length > 0;
		}
	};

	const assertProject = async (projectId: string | null | undefined) => {
		if (!projectId) return;
		if (!(await projects.get(projectId))) throw new ProjectNotFound();
	};

	const list = async (filter: TaskListQuery = {}) => {
		const conditions = [eq(task.userId, userId)];
		if (filter.status) conditions.push(eq(task.status, filter.status));
		if (filter.projectId) conditions.push(eq(task.projectId, filter.projectId));
		if (filter.label) {
			conditions.push(
				sql`exists (select 1 from json_each(${task.labels}) where value = ${filter.label})`
			);
		}
		return db
			.select()
			.from(task)
			.where(and(...conditions))
			.orderBy(asc(task.status), desc(task.createdAt));
	};

	const get = async (id: string) =>
		(await db.select().from(task).where(owned(id)).limit(1))[0] ?? null;

	const create = async (input: TaskInput) => {
		await assertProject(input.projectId);
		const [row] = await db
			.insert(task)
			.values({
				id: crypto.randomUUID(),
				userId,
				title: input.title,
				notes: input.notes ?? null,
				labels: input.labels ?? [],
				projectId: input.projectId ?? null,
				priority: input.priority ?? 'none',
				dueAt: toDate(input.dueAt) ?? null,
				repeat: input.repeat ?? null
			})
			.returning();
		return row;
	};

	const spawnNext = async (completed: Task, now: Date) => {
		if (!completed.repeat) return null;
		const [row] = await db
			.insert(task)
			.values({
				id: crypto.randomUUID(),
				userId,
				title: completed.title,
				notes: completed.notes,
				labels: completed.labels,
				projectId: completed.projectId,
				priority: completed.priority,
				dueAt: nextOccurrence(completed.dueAt, completed.repeat, now),
				repeat: completed.repeat
			})
			.returning();
		return row;
	};

	const apply = async (id: string, patch: TaskPatch) => {
		await assertProject(patch.projectId);
		const now = new Date();
		const completing = patch.status === 'done' && (await get(id))?.status === 'open';
		const completedAt = patch.status === 'done' ? now : patch.status === 'open' ? null : undefined;
		const [row] = await db
			.update(task)
			.set({
				title: patch.title,
				notes: patch.notes,
				labels: patch.labels,
				projectId: patch.projectId,
				priority: patch.priority,
				dueAt: toDate(patch.dueAt),
				repeat: patch.repeat,
				status: patch.status,
				completedAt
			})
			.where(owned(id))
			.returning();
		if (!row) return null;
		return { row, next: completing ? await spawnNext(row, now) : null };
	};

	const update = async (id: string, patch: TaskPatch) => (await apply(id, patch))?.row ?? null;

	const complete = async (id: string) => apply(id, { status: 'done' });

	const remove = async (id: string) => {
		const rows = await db.delete(task).where(owned(id)).returning({ id: task.id });
		return rows.length > 0;
	};

	const exportAll = async (): Promise<Backup> => {
		const [projectRows, taskRows] = await Promise.all([projects.list(), list()]);
		return {
			version: BACKUP_VERSION,
			projects: projectRows.map(serializeProject),
			tasks: taskRows.map(serializeTask)
		};
	};

	const importAll = async (data: Backup) => {
		const projectIds = new Map(data.projects.map((p) => [p.id, crypto.randomUUID()]));
		const projectRows = data.projects.map((p) => ({
			id: projectIds.get(p.id)!,
			userId,
			name: p.name
		}));
		const taskRows = data.tasks.map((t) => ({
			id: crypto.randomUUID(),
			userId,
			title: t.title,
			notes: t.notes ?? null,
			labels: t.labels ?? [],
			projectId: (t.projectId && projectIds.get(t.projectId)) ?? null,
			priority: t.priority ?? 'none',
			status: t.status ?? 'open',
			dueAt: toDate(t.dueAt) ?? null,
			repeat: t.repeat ?? null,
			completedAt: toDate(t.completedAt) ?? null,
			createdAt: toDate(t.createdAt) ?? new Date()
		}));
		const statements = [
			...(projectRows.length ? [db.insert(project).values(projectRows)] : []),
			...chunk(taskRows, 50).map((rows) => db.insert(task).values(rows))
		];
		if (statements.length)
			await db.batch(statements as [(typeof statements)[0], ...typeof statements]);
		return { projects: projectRows.length, tasks: taskRows.length };
	};

	return { list, get, create, update, complete, remove, projects, exportAll, importAll };
};

export type TaskService = ReturnType<typeof createTaskService>;

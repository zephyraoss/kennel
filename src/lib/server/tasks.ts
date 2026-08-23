import { and, asc, desc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
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
	status: z.enum(TASK_STATUSES).optional(),
	position: z.number().int().optional()
});

export const taskListQuery = z.object({
	status: z.enum(TASK_STATUSES).optional(),
	projectId: z.string().optional(),
	label: z.string().optional(),
	q: z.string().trim().min(1).max(200).optional(),
	dueAfter: z.iso.datetime().optional(),
	dueBefore: z.iso.datetime().optional()
});

const taskIds = z.array(z.string()).min(1).max(200);

export const bulkTaskPatch = taskPatch
	.pick({ status: true, priority: true, projectId: true, labels: true, dueAt: true })
	.extend({ ids: taskIds });

export const taskOrder = z.object({ ids: taskIds });

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

export const importProjectsInput = z.object({
	projects: z.array(projectInput.extend({ id: z.string() })).max(1_000)
});

export const importTasksInput = z.object({ tasks: z.array(backupTask).max(500) });

export type ImportTask = z.infer<typeof backupTask>;

export type TaskInput = z.infer<typeof taskInput>;
export type TaskPatch = z.infer<typeof taskPatch>;
export type TaskListQuery = z.infer<typeof taskListQuery>;
export type BulkTaskPatch = z.infer<typeof bulkTaskPatch>;

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
	position: t.position,
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

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

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
		if (filter.q) {
			const pattern = `%${escapeLike(filter.q)}%`;
			conditions.push(
				or(
					sql`${task.title} like ${pattern} escape '\\'`,
					sql`${task.notes} like ${pattern} escape '\\'`
				)!
			);
		}
		if (filter.dueAfter) conditions.push(gte(task.dueAt, new Date(filter.dueAfter)));
		if (filter.dueBefore) conditions.push(lte(task.dueAt, new Date(filter.dueBefore)));
		return db
			.select()
			.from(task)
			.where(and(...conditions))
			.orderBy(asc(task.status), asc(task.position), desc(task.createdAt));
	};

	const labels = async () => {
		const rows = await db.all<{ name: string; count: number }>(
			sql`select value as name, count(*) as count from ${task}, json_each(${task.labels}) where ${task.userId} = ${userId} group by value order by count desc, value asc`
		);
		return rows;
	};

	const topPosition = async () => {
		const [row] = await db
			.select({ min: sql<number | null>`min(${task.position})` })
			.from(task)
			.where(eq(task.userId, userId));
		return (row?.min ?? 0) - 1;
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
				repeat: input.repeat ?? null,
				position: await topPosition()
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
				repeat: completed.repeat,
				position: completed.position
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
				position: patch.position,
				completedAt
			})
			.where(owned(id))
			.returning();
		if (!row) return null;
		return { row, next: completing ? await spawnNext(row, now) : null };
	};

	const update = async (id: string, patch: TaskPatch) => (await apply(id, patch))?.row ?? null;

	const complete = async (id: string) => apply(id, { status: 'done' });

	const updateMany = async ({ ids, ...patch }: BulkTaskPatch) => {
		await assertProject(patch.projectId);
		const results = await Promise.all([...new Set(ids)].map((id) => apply(id, patch)));
		const applied = results.filter((r) => r !== null);
		return {
			tasks: applied.map((r) => r.row),
			next: applied.flatMap((r) => (r.next ? [r.next] : []))
		};
	};

	const completeMany = (ids: string[]) => updateMany({ ids, status: 'done' });

	const reorder = async (ids: string[]) => {
		const ordered = [...new Set(ids)];
		const statements = ordered.map((id, position) =>
			db.update(task).set({ position }).where(owned(id))
		);
		await db.batch(statements as [(typeof statements)[0], ...typeof statements]);
		const rows = await db
			.select()
			.from(task)
			.where(and(eq(task.userId, userId), inArray(task.id, ordered)))
			.orderBy(asc(task.position));
		return rows;
	};

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

	const taskRowFrom = (t: ImportTask, projectId: string | null) => ({
		id: crypto.randomUUID(),
		userId,
		title: t.title,
		notes: t.notes ?? null,
		labels: t.labels ?? [],
		projectId,
		priority: t.priority ?? 'none',
		status: t.status ?? 'open',
		dueAt: toDate(t.dueAt) ?? null,
		repeat: t.repeat ?? null,
		completedAt: t.status === 'done' ? (toDate(t.completedAt) ?? new Date()) : null,
		createdAt: toDate(t.createdAt) ?? new Date()
	});

	const insertTasks = async (rows: ReturnType<typeof taskRowFrom>[]) => {
		const statements = chunk(rows, 50).map((batch) => db.insert(task).values(batch));
		if (statements.length)
			await db.batch(statements as [(typeof statements)[0], ...typeof statements]);
		return rows.length;
	};

	const importProjects = async (incoming: { id: string; name: string }[]) => {
		const existing = new Map(
			(await projects.list()).map((p) => [p.name.trim().toLowerCase(), p.id])
		);
		const mapping: Record<string, string> = {};
		const rows: { id: string; userId: string; name: string }[] = [];
		for (const p of incoming) {
			const key = p.name.trim().toLowerCase();
			let id = existing.get(key);
			if (!id) {
				id = crypto.randomUUID();
				existing.set(key, id);
				rows.push({ id, userId, name: p.name });
			}
			mapping[p.id] = id;
		}
		if (rows.length) await db.insert(project).values(rows);
		return { mapping, created: rows.length };
	};

	const importTasks = async (incoming: ImportTask[]) => {
		const owned = new Set((await projects.list()).map((p) => p.id));
		const rows = incoming.map((t) =>
			taskRowFrom(t, t.projectId && owned.has(t.projectId) ? t.projectId : null)
		);
		return insertTasks(rows);
	};

	const importAll = async (data: Backup) => {
		const { mapping, created } = await importProjects(data.projects);
		const rows = data.tasks.map((t) =>
			taskRowFrom(t, (t.projectId && mapping[t.projectId]) ?? null)
		);
		return { projects: created, tasks: await insertTasks(rows) };
	};

	return {
		list,
		labels,
		get,
		create,
		update,
		updateMany,
		complete,
		completeMany,
		reorder,
		remove,
		projects,
		exportAll,
		importAll,
		importProjects,
		importTasks
	};
};

export type TaskService = ReturnType<typeof createTaskService>;

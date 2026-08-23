import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from './db';
import {
	TASK_PRIORITIES,
	TASK_STATUSES,
	project,
	task,
	type Project,
	type Task
} from './db/schema/tasks';

const label = z.string().trim().min(1).max(50);

export const taskInput = z.object({
	title: z.string().trim().min(1).max(500),
	notes: z.string().trim().max(10_000).nullable().optional(),
	priority: z.enum(TASK_PRIORITIES).optional(),
	dueAt: z.iso.datetime().nullable().optional(),
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
				dueAt: toDate(input.dueAt) ?? null
			})
			.returning();
		return row;
	};

	const update = async (id: string, patch: TaskPatch) => {
		await assertProject(patch.projectId);
		const completedAt =
			patch.status === 'done' ? new Date() : patch.status === 'open' ? null : undefined;
		const [row] = await db
			.update(task)
			.set({
				title: patch.title,
				notes: patch.notes,
				labels: patch.labels,
				projectId: patch.projectId,
				priority: patch.priority,
				dueAt: toDate(patch.dueAt),
				status: patch.status,
				completedAt
			})
			.where(owned(id))
			.returning();
		return row ?? null;
	};

	const remove = async (id: string) => {
		const rows = await db.delete(task).where(owned(id)).returning({ id: task.id });
		return rows.length > 0;
	};

	return { list, get, create, update, remove, projects };
};

export type TaskService = ReturnType<typeof createTaskService>;

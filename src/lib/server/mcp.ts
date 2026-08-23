import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { Principal } from './principal';
import {
	ProjectNotFound,
	createTaskService,
	projectInput,
	serializeProject,
	serializeTask,
	taskInput,
	taskListQuery,
	taskPatch,
	type TaskService
} from './tasks';
import type { Database } from './db';

const text = (value: unknown) => ({
	content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }]
});

const failure = (message: string) => ({
	isError: true,
	content: [{ type: 'text' as const, text: message }]
});

const buildServer = (tasks: TaskService, principal: Principal) => {
	const server = new McpServer({ name: 'kennel', version: '0.1.0' });
	const canWrite = principal.scopes.has('tasks:write');
	const canRead = principal.scopes.has('tasks:read');

	const reading =
		<A>(fn: (args: A) => Promise<unknown>) =>
		async (args: A) => {
			if (!canRead) return failure('This token lacks the tasks:read scope.');
			return text(await fn(args));
		};

	const writing =
		<A>(fn: (args: A) => Promise<unknown>) =>
		async (args: A) => {
			if (!canWrite) return failure('This token lacks the tasks:write scope.');
			try {
				const result = await fn(args);
				return result === null ? failure('Not found') : text(result);
			} catch (error) {
				if (error instanceof ProjectNotFound) return failure('projectId does not exist');
				throw error;
			}
		};

	server.registerTool(
		'list_tasks',
		{
			description:
				'List tasks. Filter by status (open or done), projectId, or a single label. Defaults to all tasks.',
			inputSchema: taskListQuery
		},
		reading(async (filter) => (await tasks.list(filter)).map(serializeTask))
	);

	server.registerTool(
		'get_task',
		{ description: 'Get a single task by id.', inputSchema: z.object({ id: z.string() }) },
		reading(async ({ id }) => {
			const row = await tasks.get(id);
			return row ? serializeTask(row) : { error: 'Task not found' };
		})
	);

	server.registerTool(
		'create_task',
		{
			description:
				'Create a task. priority is none (default), low, medium, or high. dueAt is an ISO 8601 datetime. labels is a list of short strings. projectId must reference an existing project. repeat makes the task recurring: { every: "day" | "week" | "month", interval: 1 }. Completing a repeating task creates the next instance, with dueAt advanced from the previous dueAt (or from now if it had none) until it lands in the future.',
			inputSchema: taskInput
		},
		writing(async (input) => serializeTask(await tasks.create(input)))
	);

	server.registerTool(
		'update_task',
		{
			description:
				'Update fields on a task. Set status to "done" to complete it or "open" to reopen it. Set repeat to null to stop a task recurring. Omitted fields are left unchanged.',
			inputSchema: taskPatch.extend({ id: z.string() })
		},
		writing(async ({ id, ...patch }) => {
			const row = await tasks.update(id, patch);
			return row ? serializeTask(row) : null;
		})
	);

	server.registerTool(
		'complete_task',
		{
			description:
				'Mark a task as done. If the task repeats, the next instance is created and returned as "next".',
			inputSchema: z.object({ id: z.string() })
		},
		writing(async ({ id }) => {
			const result = await tasks.complete(id);
			return result
				? { ...serializeTask(result.row), next: result.next ? serializeTask(result.next) : null }
				: null;
		})
	);

	server.registerTool(
		'delete_task',
		{ description: 'Permanently delete a task.', inputSchema: z.object({ id: z.string() }) },
		writing(async ({ id }) => ((await tasks.remove(id)) ? { deleted: id } : null))
	);

	server.registerTool(
		'list_projects',
		{ description: "List the user's projects.", inputSchema: z.object({}) },
		reading(async () => (await tasks.projects.list()).map(serializeProject))
	);

	server.registerTool(
		'create_project',
		{ description: 'Create a project that tasks can be grouped under.', inputSchema: projectInput },
		writing(async ({ name }) => serializeProject(await tasks.projects.create(name)))
	);

	server.registerTool(
		'delete_project',
		{
			description: 'Delete a project. Its tasks are kept and become unassigned.',
			inputSchema: z.object({ id: z.string() })
		},
		writing(async ({ id }) => ((await tasks.projects.remove(id)) ? { deleted: id } : null))
	);

	return server;
};

export const handleMcpRequest = (db: Database, principal: Principal, request: Request) => {
	const tasks = createTaskService(db, principal.userId);
	const handler = createMcpHandler(() => buildServer(tasks, principal), { legacy: 'stateless' });
	return handler.fetch(request, {
		authInfo: { token: '', clientId: principal.via, scopes: [...principal.scopes] }
	});
};

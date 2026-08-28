import type { RequestHandler } from './$types';
import { resourceUrls } from '$lib/server/auth';
import { REPEAT_UNITS, TASK_PRIORITIES, TASK_STATUSES } from '$lib/task-types';

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const jsonBody = (schema: object, required = true) => ({
	required,
	content: { 'application/json': { schema } }
});

const jsonResponse = (description: string, schema: object) => ({
	description,
	content: { 'application/json': { schema } }
});

const errorResponse = (description: string) => jsonResponse(description, ref('Error'));

const commonErrors = {
	'400': errorResponse('The request body or query string failed validation.'),
	'401': errorResponse('No API key or access token was supplied, or it is invalid or expired.'),
	'403': errorResponse('The credential is missing the scope this operation requires.')
};

const notFound = { '404': errorResponse('No such record belongs to the authenticated user.') };

const readSecurity = [{ bearerAuth: [] }, { apiKeyHeader: [] }, { oauth2: ['tasks:read'] }];

const writeSecurity = [{ bearerAuth: [] }, { apiKeyHeader: [] }, { oauth2: ['tasks:write'] }];

const idParameter = {
	name: 'id',
	in: 'path',
	required: true,
	schema: { type: 'string' }
};

const queryParameter = (name: string, schema: object, description: string) => ({
	name,
	in: 'query',
	required: false,
	schema,
	description
});

const spec = (origin: string) => ({
	openapi: '3.1.0',
	info: {
		title: 'kennel',
		version: '1.0.0',
		summary: 'Task list API for tasks, projects, and labels.',
		description:
			'kennel is a task list you can drive over HTTP. Every request needs an API key (prefixed `kn_`) or an OAuth 2.1 access token carrying the `tasks:read` or `tasks:write` scope. Errors come back as a non-2xx status with an `error` object.',
		license: { name: 'AGPL-3.0-only', identifier: 'AGPL-3.0-only' }
	},
	servers: [{ url: resourceUrls(origin).api }],
	externalDocs: { description: 'kennel docs', url: `${origin}/docs` },
	security: [{ bearerAuth: [] }, { apiKeyHeader: [] }, { oauth2: ['tasks:read', 'tasks:write'] }],
	tags: [
		{ name: 'tasks', description: 'Create, read, update, reorder, and delete tasks.' },
		{ name: 'projects', description: 'Group tasks under a project.' },
		{ name: 'labels', description: 'Labels currently in use.' }
	],
	paths: {
		'/tasks': {
			get: {
				operationId: 'listTasks',
				tags: ['tasks'],
				summary: 'List tasks',
				description:
					'Returns tasks ordered by status, then position (lower first), then newest created.',
				security: readSecurity,
				parameters: [
					queryParameter(
						'status',
						{ type: 'string', enum: [...TASK_STATUSES] },
						'Only tasks with this status.'
					),
					queryParameter('projectId', { type: 'string' }, 'Only tasks in this project.'),
					queryParameter('label', { type: 'string' }, 'Only tasks carrying this exact label.'),
					queryParameter(
						'q',
						{ type: 'string', minLength: 1, maxLength: 200 },
						'Case-insensitive substring match over title and notes.'
					),
					queryParameter(
						'dueAfter',
						{ type: 'string', format: 'date-time' },
						'Only tasks due at or after this instant.'
					),
					queryParameter(
						'dueBefore',
						{ type: 'string', format: 'date-time' },
						'Only tasks due at or before this instant.'
					)
				],
				responses: {
					'200': jsonResponse('The matching tasks.', {
						type: 'object',
						required: ['tasks'],
						properties: { tasks: { type: 'array', items: ref('Task') } }
					}),
					...commonErrors
				}
			},
			post: {
				operationId: 'createTask',
				tags: ['tasks'],
				summary: 'Create a task',
				description: 'New tasks are placed at the top of the open list.',
				security: writeSecurity,
				requestBody: jsonBody(ref('TaskInput')),
				responses: {
					'201': jsonResponse('The created task.', ref('TaskEnvelope')),
					...commonErrors
				}
			},
			patch: {
				operationId: 'updateTasks',
				tags: ['tasks'],
				summary: 'Update many tasks',
				description:
					'Applies the same change to every listed task. Ids that do not exist are skipped. Completing a repeating task creates its next instance, returned in `next`.',
				security: writeSecurity,
				requestBody: jsonBody(ref('BulkTaskPatch')),
				responses: {
					'200': jsonResponse('The updated tasks and any spawned repeats.', ref('TaskBatch')),
					...commonErrors
				}
			}
		},
		'/tasks/order': {
			put: {
				operationId: 'reorderTasks',
				tags: ['tasks'],
				summary: 'Set task order',
				description:
					'Each id gets a position equal to its index in the list. Tasks left out keep their current position.',
				security: writeSecurity,
				requestBody: jsonBody(ref('TaskOrder')),
				responses: {
					'200': jsonResponse('The reordered tasks.', {
						type: 'object',
						required: ['tasks'],
						properties: { tasks: { type: 'array', items: ref('Task') } }
					}),
					...commonErrors
				}
			}
		},
		'/tasks/{id}': {
			parameters: [idParameter],
			get: {
				operationId: 'getTask',
				tags: ['tasks'],
				summary: 'Get a task',
				security: readSecurity,
				responses: {
					'200': jsonResponse('The task.', ref('TaskEnvelope')),
					...commonErrors,
					...notFound
				}
			},
			patch: {
				operationId: 'updateTask',
				tags: ['tasks'],
				summary: 'Update a task',
				description:
					'Omitted fields are left unchanged. Set `status` to `done` to complete the task or `open` to reopen it, and `repeat` to null to stop it recurring.',
				security: writeSecurity,
				requestBody: jsonBody(ref('TaskPatch')),
				responses: {
					'200': jsonResponse('The updated task.', ref('TaskEnvelope')),
					...commonErrors,
					...notFound
				}
			},
			delete: {
				operationId: 'deleteTask',
				tags: ['tasks'],
				summary: 'Delete a task',
				security: writeSecurity,
				responses: {
					'204': { description: 'The task was deleted.' },
					...commonErrors,
					...notFound
				}
			}
		},
		'/labels': {
			get: {
				operationId: 'listLabels',
				tags: ['labels'],
				summary: 'List labels',
				description:
					'Every label in use with how many tasks carry it, most used first. Read this before creating tasks so labels get reused rather than duplicated.',
				security: readSecurity,
				responses: {
					'200': jsonResponse('The labels in use.', {
						type: 'object',
						required: ['labels'],
						properties: { labels: { type: 'array', items: ref('Label') } }
					}),
					...commonErrors
				}
			}
		},
		'/projects': {
			get: {
				operationId: 'listProjects',
				tags: ['projects'],
				summary: 'List projects',
				security: readSecurity,
				responses: {
					'200': jsonResponse('The projects, ordered by name.', {
						type: 'object',
						required: ['projects'],
						properties: { projects: { type: 'array', items: ref('Project') } }
					}),
					...commonErrors
				}
			},
			post: {
				operationId: 'createProject',
				tags: ['projects'],
				summary: 'Create a project',
				security: writeSecurity,
				requestBody: jsonBody(ref('ProjectInput')),
				responses: {
					'201': jsonResponse('The created project.', ref('ProjectEnvelope')),
					...commonErrors
				}
			}
		},
		'/projects/{id}': {
			parameters: [idParameter],
			get: {
				operationId: 'getProject',
				tags: ['projects'],
				summary: 'Get a project',
				security: readSecurity,
				responses: {
					'200': jsonResponse('The project.', ref('ProjectEnvelope')),
					...commonErrors,
					...notFound
				}
			},
			patch: {
				operationId: 'renameProject',
				tags: ['projects'],
				summary: 'Rename a project',
				security: writeSecurity,
				requestBody: jsonBody(ref('ProjectInput')),
				responses: {
					'200': jsonResponse('The renamed project.', ref('ProjectEnvelope')),
					...commonErrors,
					...notFound
				}
			},
			delete: {
				operationId: 'deleteProject',
				tags: ['projects'],
				summary: 'Delete a project',
				description: 'Tasks in the project are kept and become unassigned.',
				security: writeSecurity,
				responses: {
					'204': { description: 'The project was deleted.' },
					...commonErrors,
					...notFound
				}
			}
		}
	},
	components: {
		securitySchemes: {
			bearerAuth: {
				type: 'http',
				scheme: 'bearer',
				description:
					'An API key prefixed `kn_` from the dashboard, or an OAuth 2.1 access token. Sent as `Authorization: Bearer <token>`.'
			},
			apiKeyHeader: {
				type: 'apiKey',
				in: 'header',
				name: 'x-api-key',
				description: 'An API key prefixed `kn_` from the dashboard.'
			},
			oauth2: {
				type: 'oauth2',
				description: `OAuth 2.1 authorization code flow with PKCE. Clients may register themselves through dynamic client registration. Clients that cannot open a browser redirect can instead use the device authorization grant at \`${origin}/api/auth/device/code\`.`,
				flows: {
					authorizationCode: {
						authorizationUrl: `${origin}/api/auth/oauth2/authorize`,
						tokenUrl: `${origin}/api/auth/oauth2/token`,
						refreshUrl: `${origin}/api/auth/oauth2/token`,
						scopes: {
							'tasks:read': 'Read tasks, projects, and labels.',
							'tasks:write': 'Create, update, reorder, and delete tasks and projects.'
						}
					}
				}
			}
		},
		schemas: {
			Error: {
				type: 'object',
				required: ['error'],
				properties: {
					error: {
						type: 'object',
						required: ['code', 'message'],
						properties: {
							code: {
								type: 'string',
								enum: [
									'unauthorized',
									'insufficient_scope',
									'invalid_json',
									'validation_error',
									'unknown_project',
									'not_found'
								]
							},
							message: { type: 'string' }
						}
					}
				}
			},
			Repeat: {
				type: 'object',
				description: 'Makes a task recurring. Completing it creates the next instance.',
				required: ['every'],
				properties: {
					every: { type: 'string', enum: [...REPEAT_UNITS] },
					interval: { type: 'integer', minimum: 1, maximum: 365, default: 1 }
				}
			},
			Task: {
				type: 'object',
				required: [
					'id',
					'title',
					'notes',
					'labels',
					'projectId',
					'status',
					'priority',
					'dueAt',
					'repeat',
					'position',
					'completedAt',
					'createdAt',
					'updatedAt'
				],
				properties: {
					id: { type: 'string' },
					title: { type: 'string' },
					notes: { type: ['string', 'null'] },
					labels: { type: 'array', items: { type: 'string' } },
					projectId: { type: ['string', 'null'] },
					status: { type: 'string', enum: [...TASK_STATUSES] },
					priority: { type: 'string', enum: [...TASK_PRIORITIES] },
					dueAt: { type: ['string', 'null'], format: 'date-time' },
					repeat: { oneOf: [ref('Repeat'), { type: 'null' }] },
					position: {
						type: 'integer',
						description: 'Sort key for open tasks, lower first.'
					},
					completedAt: { type: ['string', 'null'], format: 'date-time' },
					createdAt: { type: 'string', format: 'date-time' },
					updatedAt: { type: 'string', format: 'date-time' }
				}
			},
			TaskInput: {
				type: 'object',
				required: ['title'],
				properties: {
					title: { type: 'string', minLength: 1, maxLength: 500 },
					notes: { type: ['string', 'null'], maxLength: 10000 },
					priority: { type: 'string', enum: [...TASK_PRIORITIES], default: 'none' },
					dueAt: { type: ['string', 'null'], format: 'date-time' },
					repeat: { oneOf: [ref('Repeat'), { type: 'null' }] },
					labels: {
						type: 'array',
						maxItems: 20,
						items: { type: 'string', minLength: 1, maxLength: 50 }
					},
					projectId: { type: ['string', 'null'] }
				}
			},
			TaskPatch: {
				type: 'object',
				properties: {
					title: { type: 'string', minLength: 1, maxLength: 500 },
					notes: { type: ['string', 'null'], maxLength: 10000 },
					priority: { type: 'string', enum: [...TASK_PRIORITIES] },
					dueAt: { type: ['string', 'null'], format: 'date-time' },
					repeat: { oneOf: [ref('Repeat'), { type: 'null' }] },
					labels: {
						type: 'array',
						maxItems: 20,
						items: { type: 'string', minLength: 1, maxLength: 50 }
					},
					projectId: { type: ['string', 'null'] },
					status: { type: 'string', enum: [...TASK_STATUSES] },
					position: { type: 'integer' }
				}
			},
			BulkTaskPatch: {
				type: 'object',
				required: ['ids'],
				properties: {
					ids: ref('TaskIds'),
					status: { type: 'string', enum: [...TASK_STATUSES] },
					priority: { type: 'string', enum: [...TASK_PRIORITIES] },
					projectId: { type: ['string', 'null'] },
					labels: {
						type: 'array',
						maxItems: 20,
						items: { type: 'string', minLength: 1, maxLength: 50 }
					},
					dueAt: { type: ['string', 'null'], format: 'date-time' }
				}
			},
			TaskOrder: {
				type: 'object',
				required: ['ids'],
				properties: { ids: ref('TaskIds') }
			},
			TaskIds: {
				type: 'array',
				minItems: 1,
				maxItems: 200,
				items: { type: 'string' }
			},
			TaskEnvelope: {
				type: 'object',
				required: ['task'],
				properties: { task: ref('Task') }
			},
			TaskBatch: {
				type: 'object',
				required: ['tasks', 'next'],
				properties: {
					tasks: { type: 'array', items: ref('Task') },
					next: {
						type: 'array',
						items: ref('Task'),
						description: 'Instances spawned by completing repeating tasks.'
					}
				}
			},
			Label: {
				type: 'object',
				required: ['name', 'count'],
				properties: {
					name: { type: 'string' },
					count: { type: 'integer' }
				}
			},
			Project: {
				type: 'object',
				required: ['id', 'name', 'createdAt'],
				properties: {
					id: { type: 'string' },
					name: { type: 'string' },
					createdAt: { type: 'string', format: 'date-time' }
				}
			},
			ProjectInput: {
				type: 'object',
				required: ['name'],
				properties: { name: { type: 'string', minLength: 1, maxLength: 100 } }
			},
			ProjectEnvelope: {
				type: 'object',
				required: ['project'],
				properties: { project: ref('Project') }
			}
		}
	}
});

export const GET: RequestHandler = async ({ locals }) => {
	const { baseURL } = await locals.auth.$context;
	return new Response(JSON.stringify(spec(new URL(baseURL).origin), null, 2), {
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};

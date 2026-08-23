import { json, type RequestEvent } from '@sveltejs/kit';
import type { ZodType } from 'zod';
import { isPrincipal, resolvePrincipal, type Principal, type Scope } from './principal';
import { ProjectNotFound, createTaskService, type TaskService } from './tasks';

export class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string
	) {
		super(message);
	}
}

export const apiError = (status: number, code: string, message: string) =>
	json({ error: { code, message } }, { status });

export const requirePrincipal = async (event: RequestEvent, scope: Scope) => {
	const principal = await resolvePrincipal(event.locals.auth, event.locals.database, event.request);
	if (!isPrincipal(principal)) {
		throw new ApiError(
			401,
			'unauthorized',
			principal.reason === 'missing'
				? 'Missing bearer token or API key'
				: 'Invalid or expired token'
		);
	}
	if (!principal.scopes.has(scope)) {
		throw new ApiError(403, 'insufficient_scope', `Token is missing the ${scope} scope`);
	}
	return principal;
};

export const parseBody = async <T>(request: Request, schema: ZodType<T>) => {
	const raw = await request.json().catch(() => {
		throw new ApiError(400, 'invalid_json', 'Request body must be valid JSON');
	});
	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		throw new ApiError(
			400,
			'validation_error',
			parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
		);
	}
	return parsed.data;
};

export const parseQuery = <T>(url: URL, schema: ZodType<T>) => {
	const parsed = schema.safeParse(Object.fromEntries(url.searchParams));
	if (!parsed.success) {
		throw new ApiError(
			400,
			'validation_error',
			parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
		);
	}
	return parsed.data;
};

type Handler = (ctx: {
	event: RequestEvent;
	principal: Principal;
	tasks: TaskService;
}) => Promise<Response>;

export const withTasks =
	(scope: Scope, handler: Handler) =>
	async (event: RequestEvent): Promise<Response> => {
		try {
			const principal = await requirePrincipal(event, scope);
			const tasks = createTaskService(event.locals.database, principal.userId);
			return await handler({ event, principal, tasks });
		} catch (error) {
			if (error instanceof ApiError) return apiError(error.status, error.code, error.message);
			if (error instanceof ProjectNotFound)
				return apiError(400, 'unknown_project', 'projectId does not exist');
			throw error;
		}
	};

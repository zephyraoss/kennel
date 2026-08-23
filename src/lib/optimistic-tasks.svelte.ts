import type { SerializedTask } from '$lib/server/tasks';

type Mutation =
	| { kind: 'create'; task: SerializedTask }
	| { kind: 'patch'; id: string; values: Partial<SerializedTask> }
	| { kind: 'remove'; id: string };

type Settle = () => void;

const applied = (tasks: SerializedTask[], mutation: Mutation) => {
	if (mutation.kind === 'create') return [mutation.task, ...tasks];
	if (mutation.kind === 'remove') return tasks.filter((t) => t.id !== mutation.id);
	return tasks.map((t) => (t.id === mutation.id ? { ...t, ...mutation.values } : t));
};

export const settleAfter =
	(settle: Settle) =>
	async ({ update }: { update: () => Promise<void> }) => {
		await update();
		settle();
	};

export const createOptimisticTasks = () => {
	let pending = $state.raw<{ token: symbol; mutation: Mutation }[]>([]);

	const start = (mutation: Mutation): Settle => {
		const token = Symbol();
		pending = [...pending, { token, mutation }];
		return () => {
			pending = pending.filter((entry) => entry.token !== token);
		};
	};

	return {
		create: (task: SerializedTask) => start({ kind: 'create', task }),
		patch: (id: string, values: Partial<SerializedTask>) => start({ kind: 'patch', id, values }),
		remove: (id: string) => start({ kind: 'remove', id }),
		view: (tasks: SerializedTask[], projectId: string | null) => {
			const merged = pending.reduce((current, entry) => applied(current, entry.mutation), tasks);
			return projectId ? merged.filter((t) => t.projectId === projectId) : merged;
		}
	};
};

export type OptimisticTasks = ReturnType<typeof createOptimisticTasks>;

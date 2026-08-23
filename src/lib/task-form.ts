import type { SerializedTask } from '$lib/server/tasks';
import { REPEAT_UNITS, TASK_PRIORITIES, type TaskPriority } from '$lib/task-types';

export const field = (form: FormData, name: string) => {
	const value = form.get(name);
	return typeof value === 'string' ? value.trim() : '';
};

const optional = (value: string) => (value === '' ? null : value);

const labelsFrom = (raw: string) => [
	...new Set(
		raw
			.split(',')
			.map((l) => l.trim())
			.filter(Boolean)
	)
];

const priorityFrom = (value: string): TaskPriority =>
	TASK_PRIORITIES.find((priority) => priority === value) ?? 'none';

const repeatFrom = (value: string) => {
	const every = REPEAT_UNITS.find((unit) => unit === value);
	return every ? { every, interval: 1 } : null;
};

const dueFrom = (value: string) => {
	const date = value === '' ? null : new Date(value);
	return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
};

export const taskValues = (form: FormData) => ({
	title: field(form, 'title'),
	notes: optional(field(form, 'notes')),
	priority: priorityFrom(field(form, 'priority')),
	dueAt: dueFrom(field(form, 'dueAt')),
	repeat: repeatFrom(field(form, 'repeat')),
	labels: labelsFrom(field(form, 'labels')),
	projectId: optional(field(form, 'projectId'))
});

export type TaskValues = ReturnType<typeof taskValues>;

export const draftTask = (values: TaskValues): SerializedTask => {
	const now = new Date().toISOString();
	return {
		...values,
		id: `draft-${crypto.randomUUID()}`,
		status: 'open',
		position: 0,
		completedAt: null,
		createdAt: now,
		updatedAt: now
	};
};

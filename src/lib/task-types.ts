export const TASK_STATUSES = ['open', 'done'] as const;
export const TASK_PRIORITIES = ['none', 'low', 'medium', 'high'] as const;
export const REPEAT_UNITS = ['day', 'week', 'month'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type RepeatUnit = (typeof REPEAT_UNITS)[number];
export type Repeat = { every: RepeatUnit; interval: number };

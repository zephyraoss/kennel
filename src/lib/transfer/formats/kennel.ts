import { z } from 'zod';
import { REPEAT_UNITS, TASK_PRIORITIES, TASK_STATUSES } from '$lib/task-types';
import type { Format, TransferData } from '../types';
import logo from '$lib/assets/favicon.svg';
import { clampNotes, clampTitle, parseDate, splitList } from '../values';

const backupTask = z.object({
	title: z.string(),
	notes: z.string().nullish(),
	priority: z.enum(TASK_PRIORITIES).optional(),
	dueAt: z.string().nullish(),
	repeat: z
		.object({ every: z.enum(REPEAT_UNITS), interval: z.number().int().min(1).max(365) })
		.nullish(),
	labels: z.array(z.string()).optional(),
	projectId: z.string().nullish(),
	status: z.enum(TASK_STATUSES).optional(),
	completedAt: z.string().nullish(),
	createdAt: z.string().optional()
});

const backup = z.object({
	version: z.number(),
	projects: z.array(z.object({ id: z.string(), name: z.string() })),
	tasks: z.array(backupTask)
});

const looksLikeKennel = (text: string) => {
	try {
		const parsed = JSON.parse(text);
		return backup.safeParse(parsed).success;
	} catch {
		return false;
	}
};

export const kennel: Format = {
	id: 'kennel',
	name: 'Kennel',
	tagline: 'Native backup with everything preserved',
	extensions: ['.json'],
	mark: 'K',
	hue: 220,
	logo,
	importer: {
		instructions: ['Use a JSON file exported from kennel (Settings, then Export).'],
		detect: (text, filename) =>
			filename.endsWith('.json') && looksLikeKennel(text) ? 1 : looksLikeKennel(text) ? 0.9 : 0,
		parse: (text) => {
			const parsed = backup.safeParse(JSON.parse(text));
			if (!parsed.success) throw new Error('Not a valid kennel export');
			const projectIds = new Set(parsed.data.projects.map((p) => p.id));
			return {
				warnings: [],
				data: {
					projects: parsed.data.projects.map((p) => ({ id: p.id, name: clampTitle(p.name) })),
					tasks: parsed.data.tasks.map((t) => ({
						title: clampTitle(t.title),
						notes: clampNotes(t.notes),
						priority: t.priority ?? 'none',
						dueAt: parseDate(t.dueAt),
						repeat: t.repeat ?? null,
						labels: splitList(t.labels),
						projectId: t.projectId && projectIds.has(t.projectId) ? t.projectId : null,
						status: t.status ?? 'open',
						completedAt: parseDate(t.completedAt),
						createdAt: parseDate(t.createdAt) ?? undefined
					}))
				}
			};
		}
	},
	exporter: {
		instructions: ['Import this file back into kennel at any time from Settings.'],
		serialize: (data: TransferData, stamp) => ({
			content: JSON.stringify({ version: 1, ...data }, null, 2),
			filename: `kennel-${stamp}.json`,
			mime: 'application/json'
		})
	}
};

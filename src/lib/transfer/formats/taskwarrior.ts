import type { Format, TransferData } from '../types';
import logo from '$lib/assets/logos/taskwarrior.png';
import {
	clampNotes,
	clampTitle,
	compactDate,
	parseDate,
	parseRepeat,
	projectRegistry,
	splitList
} from '../values';

type TaskwarriorTask = {
	description?: string;
	status?: string;
	priority?: string;
	project?: string;
	tags?: string[];
	due?: string;
	entry?: string;
	end?: string;
	recur?: string;
	annotations?: { entry?: string; description?: string }[];
};

const readTasks = (text: string): TaskwarriorTask[] => {
	const trimmed = text.trim();
	const parsed = trimmed.startsWith('[')
		? JSON.parse(trimmed)
		: trimmed
				.split(/\r?\n/)
				.filter((line) => line.trim().startsWith('{'))
				.map((line) => JSON.parse(line.replace(/,\s*$/, '')));
	return Array.isArray(parsed) ? parsed.filter((t) => t && typeof t.description === 'string') : [];
};

const PRIORITY_IN = { H: 'high', M: 'medium', L: 'low' } as const;
const PRIORITY_OUT = { high: 'H', medium: 'M', low: 'L', none: undefined } as const;

export const taskwarrior: Format = {
	id: 'taskwarrior',
	name: 'Taskwarrior',
	tagline: 'JSON from task export',
	extensions: ['.json'],
	mark: 'TW',
	hue: 30,
	container: 'json',
	logo,
	importer: {
		instructions: [
			'Run "task export > tasks.json" in a terminal and choose the resulting file.',
			'Projects, tags, priority and due dates are kept. Annotations are added to the notes. Deleted tasks are skipped.'
		],
		detect: (text, filename) => {
			if (!filename.endsWith('.json')) return 0;
			try {
				const tasks = readTasks(text);
				return tasks.length && tasks.every((t) => 'uuid' in t || 'entry' in t) ? 1 : 0;
			} catch {
				return 0;
			}
		},
		parse: (text) => {
			const registry = projectRegistry();
			const warnings: string[] = [];
			let unsupported = 0;
			const tasks = readTasks(text)
				.filter((t) => t.status !== 'deleted' && t.status !== 'recurring')
				.map((t) => {
					const repeat = parseRepeat(t.recur);
					if (t.recur && !repeat) unsupported++;
					const done = t.status === 'completed';
					const annotations = (t.annotations ?? []).map((a) => a.description ?? '').filter(Boolean);
					return {
						title: clampTitle(t.description),
						notes: clampNotes(annotations.join('\n')),
						priority: PRIORITY_IN[t.priority as keyof typeof PRIORITY_IN] ?? 'none',
						dueAt: parseDate(t.due),
						repeat,
						labels: splitList(t.tags),
						projectId: registry.ensure(t.project),
						status: done ? ('done' as const) : ('open' as const),
						completedAt: done ? (parseDate(t.end) ?? new Date().toISOString()) : null,
						createdAt: parseDate(t.entry) ?? undefined
					};
				});
			if (unsupported)
				warnings.push(
					`${unsupported} recurrence rule${unsupported === 1 ? '' : 's'} couldn't be converted and were dropped.`
				);
			return { data: { projects: registry.projects, tasks }, warnings };
		}
	},
	exporter: {
		instructions: [
			'Run "task import kennel-taskwarrior.json" to load the tasks.',
			'Projects, tags, priority, due dates and notes (as annotations) are all kept.'
		],
		serialize: (data: TransferData, stamp) => {
			const projectNames = new Map(data.projects.map((p) => [p.id, p.name]));
			const items = data.tasks.map((t) => ({
				uuid: crypto.randomUUID(),
				description: t.title,
				status: t.status === 'done' ? 'completed' : 'pending',
				...(PRIORITY_OUT[t.priority ?? 'none']
					? { priority: PRIORITY_OUT[t.priority ?? 'none'] }
					: {}),
				...(t.projectId && projectNames.get(t.projectId)
					? { project: projectNames.get(t.projectId)!.replace(/\s+/g, '_') }
					: {}),
				...(t.labels?.length ? { tags: t.labels.map((l) => l.replace(/\s+/g, '_')) } : {}),
				...(t.dueAt ? { due: compactDate(t.dueAt) } : {}),
				...(t.repeat
					? {
							recur: `${t.repeat.interval}${t.repeat.every === 'day' ? 'd' : t.repeat.every === 'week' ? 'w' : 'mo'}`
						}
					: {}),
				entry: compactDate(t.createdAt ?? new Date().toISOString()),
				...(t.completedAt ? { end: compactDate(t.completedAt) } : {}),
				...(t.notes
					? {
							annotations: [
								{
									entry: compactDate(t.createdAt ?? new Date().toISOString()),
									description: t.notes
								}
							]
						}
					: {})
			}));
			return {
				content: JSON.stringify(items, null, 2),
				filename: `kennel-taskwarrior-${stamp}.json`,
				mime: 'application/json'
			};
		}
	}
};

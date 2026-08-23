import type { Format, TransferTask } from '../types';
import logo from '$lib/assets/logos/google.svg';
import { clampNotes, clampTitle, parseDate, projectRegistry } from '../values';

type GoogleTask = {
	kind?: string;
	title?: string;
	notes?: string;
	status?: string;
	due?: string;
	completed?: string;
	updated?: string;
	deleted?: boolean;
	hidden?: boolean;
};

type GoogleList = { kind?: string; title?: string; items?: GoogleTask[] };

const readLists = (text: string): GoogleList[] => {
	const parsed = JSON.parse(text);
	if (parsed?.kind === 'tasks#tasks' && Array.isArray(parsed.items)) return parsed.items;
	if (Array.isArray(parsed) && parsed.every((l) => l?.kind === 'tasks#taskList')) return parsed;
	if (parsed?.kind === 'tasks#taskList') return [parsed];
	return [];
};

export const googleTasks: Format = {
	id: 'google-tasks',
	name: 'Google Tasks',
	tagline: 'Takeout export (Tasks.json)',
	extensions: ['.json'],
	mark: 'G',
	hue: 45,
	container: 'json',
	logo,
	importer: {
		instructions: [
			'Go to takeout.google.com, deselect everything except Tasks, and create the export.',
			'Unzip the archive and choose Takeout/Tasks/Tasks.json. Lists become projects.'
		],
		detect: (text, filename) => {
			if (!filename.endsWith('.json')) return 0;
			try {
				return readLists(text).length ? 1 : 0;
			} catch {
				return 0;
			}
		},
		parse: (text) => {
			const registry = projectRegistry();
			const tasks: TransferTask[] = [];
			for (const list of readLists(text)) {
				const projectId = registry.ensure(list.title);
				for (const item of list.items ?? []) {
					if (item.deleted || item.kind !== 'tasks#task' || !item.title?.trim()) continue;
					const done = item.status === 'completed';
					tasks.push({
						title: clampTitle(item.title),
						notes: clampNotes(item.notes),
						dueAt: parseDate(item.due),
						projectId,
						status: done ? 'done' : 'open',
						completedAt: done ? (parseDate(item.completed) ?? parseDate(item.updated)) : null
					});
				}
			}
			return { data: { projects: registry.projects, tasks }, warnings: [] };
		}
	}
};

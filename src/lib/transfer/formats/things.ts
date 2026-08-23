import type { Format, TransferData, TransferTask } from '../types';
import logo from '$lib/assets/logos/things.svg';
import { clampNotes, clampTitle, dateOnly, parseDate, projectRegistry, splitList } from '../values';

type ThingsAttributes = {
	title?: string;
	notes?: string;
	when?: string;
	deadline?: string;
	tags?: string[] | string;
	completed?: boolean;
	canceled?: boolean;
	'completion-date'?: string;
	'creation-date'?: string;
	list?: string;
	items?: ThingsItem[];
};

type ThingsItem = { type: string; attributes?: ThingsAttributes };

const isThingsItem = (value: unknown): value is ThingsItem =>
	typeof value === 'object' &&
	value !== null &&
	['to-do', 'project', 'heading', 'checklist-item'].includes((value as ThingsItem).type);

const readItems = (text: string): ThingsItem[] => {
	const parsed = JSON.parse(text);
	const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.data) ? parsed.data : [];
	return items.filter(isThingsItem);
};

export const things: Format = {
	id: 'things',
	name: 'Things',
	tagline: 'Things JSON, imported through the Things URL scheme',
	extensions: ['.json'],
	mark: 'Th',
	hue: 210,
	logo,
	importer: {
		instructions: [
			"Things has no built-in export, so use a Things JSON file (the same format Things' URL scheme accepts), produced by a Shortcut, script or another app's Things export.",
			'Projects become kennel projects, tags become labels and deadlines become due dates.'
		],
		detect: (text, filename) => {
			if (!filename.endsWith('.json')) return 0;
			try {
				const items = readItems(text);
				return items.length ? 0.95 : 0;
			} catch {
				return 0;
			}
		},
		parse: (text) => {
			const registry = projectRegistry();
			const tasks: TransferTask[] = [];
			const visit = (item: ThingsItem, projectId: string | null) => {
				const a = item.attributes ?? {};
				if (item.type === 'project') {
					const id = registry.ensure(a.title);
					for (const child of a.items ?? []) visit(child, id);
					return;
				}
				if (item.type === 'heading') {
					for (const child of a.items ?? []) visit(child, projectId);
					return;
				}
				if (item.type !== 'to-do') return;
				const done = Boolean(a.completed || a.canceled);
				const checklist = (a.items ?? [])
					.filter((c) => c.type === 'checklist-item')
					.map((c) => `- [${c.attributes?.completed ? 'x' : ' '}] ${c.attributes?.title ?? ''}`);
				tasks.push({
					title: clampTitle(a.title),
					notes: clampNotes([a.notes ?? '', ...checklist].filter(Boolean).join('\n')),
					dueAt: parseDate(a.deadline) ?? parseDate(a.when),
					labels: splitList(a.tags),
					projectId: projectId ?? registry.ensure(a.list),
					status: done ? 'done' : 'open',
					completedAt: done ? (parseDate(a['completion-date']) ?? new Date().toISOString()) : null,
					createdAt: parseDate(a['creation-date']) ?? undefined
				});
			};
			for (const item of readItems(text)) visit(item, null);
			return { data: { projects: registry.projects, tasks }, warnings: [] };
		}
	},
	exporter: {
		instructions: [
			'On a Mac, iPhone or iPad with Things installed, click "Open in Things" to add everything directly.',
			'The downloaded file is the same data as Things JSON, which you can also pass to the things:///json URL scheme yourself.'
		],
		serialize: (data: TransferData, stamp) => {
			const todo = (t: TransferTask) => ({
				type: 'to-do',
				attributes: {
					title: t.title,
					...(t.notes ? { notes: t.notes } : {}),
					...(t.dueAt ? { deadline: dateOnly(t.dueAt) } : {}),
					...(t.labels?.length ? { tags: t.labels } : {}),
					...(t.status === 'done' ? { completed: true } : {}),
					...(t.completedAt ? { 'completion-date': t.completedAt } : {}),
					...(t.createdAt ? { 'creation-date': t.createdAt } : {})
				}
			});
			const items = [
				...data.tasks.filter((t) => !t.projectId).map(todo),
				...data.projects.map((p) => ({
					type: 'project',
					attributes: {
						title: p.name,
						items: data.tasks.filter((t) => t.projectId === p.id).map(todo)
					}
				}))
			];
			const content = JSON.stringify(items, null, 2);
			return {
				content,
				filename: `kennel-things-${stamp}.json`,
				mime: 'application/json',
				link: `things:///json?data=${encodeURIComponent(JSON.stringify(items))}`
			};
		}
	}
};

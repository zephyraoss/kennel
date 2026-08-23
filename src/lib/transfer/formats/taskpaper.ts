import type { Format, TransferData, TransferTask } from '../types';
import logo from '$lib/assets/logos/taskpaper.png';
import {
	clampNotes,
	clampTitle,
	dateOnly,
	parseDate,
	parsePriority,
	parseRepeat,
	projectRegistry,
	repeatToText,
	splitList
} from '../values';

const TAG = /(?:^|\s)@([\w-]+)(?:\(([^)]*)\))?/g;

const parseLine = (line: string) => {
	const tags = new Map<string, string>();
	const text = line
		.replace(TAG, (_, name: string, value: string | undefined) => {
			tags.set(name.toLowerCase(), value ?? '');
			return '';
		})
		.replace(/\s+/g, ' ')
		.trim();
	return { text, tags };
};

const indentOf = (line: string) => /^[\t ]*/.exec(line)![0].replace(/ {4}/g, '\t').length;

export const serializeTaskPaper = (data: TransferData, stamp: string) => {
	const line = (t: TransferTask, indent: string) => {
		const tags = [
			t.dueAt ? `@due(${dateOnly(t.dueAt)})` : '',
			t.status === 'done' ? `@done${t.completedAt ? `(${dateOnly(t.completedAt)})` : ''}` : '',
			t.priority === 'high' ? '@flagged' : '',
			t.priority && t.priority !== 'none' ? `@priority(${t.priority})` : '',
			t.repeat ? `@repeat(${repeatToText(t.repeat)})` : '',
			t.labels?.length ? `@tags(${t.labels.join(', ')})` : ''
		].filter(Boolean);
		const notes = (t.notes ?? '')
			.split('\n')
			.filter((n) => n.trim())
			.map((n) => `${indent}\t${n}`);
		return [`${indent}- ${[t.title, ...tags].join(' ')}`, ...notes].join('\n');
	};
	const blocks = [
		...data.tasks.filter((t) => !t.projectId).map((t) => line(t, '')),
		...data.projects.map((p) =>
			[
				`${p.name}:`,
				...data.tasks.filter((t) => t.projectId === p.id).map((t) => line(t, '\t'))
			].join('\n')
		)
	];
	return {
		content: blocks.join('\n\n') + '\n',
		filename: `kennel-${stamp}.taskpaper`,
		mime: 'text/plain'
	};
};

export const taskpaper: Format = {
	id: 'taskpaper',
	name: 'TaskPaper',
	tagline: 'Plain text outlines with @tags',
	extensions: ['.taskpaper', '.txt'],
	mark: 'TP',
	hue: 20,
	logo,
	importer: {
		instructions: [
			'Choose a .taskpaper file. "Project:" lines become projects and "- task" lines become tasks.',
			'@due(date), @done, @flagged, @priority, @repeat and @tags(a, b) are understood; other @tags become labels.'
		],
		detect: (text, filename) => {
			if (filename.endsWith('.taskpaper')) return 1;
			const lines = text.split(/\r?\n/).filter((l) => l.trim());
			const tasks = lines.filter((l) => /^\s*-\s/.test(l)).length;
			const projects = lines.filter((l) => /^[^\s-].*:\s*$/.test(l)).length;
			return tasks && projects && lines.some((l) => /@\w+/.test(l)) ? 0.6 : 0;
		},
		parse: (text) => {
			const registry = projectRegistry();
			const tasks: TransferTask[] = [];
			let projectId: string | null = null;
			let current: TransferTask | null = null;
			let currentIndent = 0;
			for (const raw of text.split(/\r?\n/)) {
				if (!raw.trim()) continue;
				const indent = indentOf(raw);
				const line = raw.trim();
				if (/^-\s/.test(line)) {
					const { text: title, tags } = parseLine(line.slice(2));
					const known = [
						'due',
						'done',
						'flagged',
						'priority',
						'repeat',
						'tags',
						'start',
						'defer',
						'context',
						'estimate'
					];
					const labels = [
						...splitList(tags.get('tags') ?? ''),
						...splitList(tags.get('context') ?? ''),
						...[...tags.keys()].filter((k) => !known.includes(k))
					];
					const done = tags.has('done');
					current = {
						title: clampTitle(title),
						notes: null,
						priority: tags.has('flagged') ? 'high' : parsePriority(tags.get('priority')),
						dueAt: parseDate(tags.get('due')),
						repeat: parseRepeat(tags.get('repeat')),
						labels: labels.slice(0, 20),
						projectId: indent === 0 ? null : projectId,
						status: done ? 'done' : 'open',
						completedAt: done ? (parseDate(tags.get('done')) ?? new Date().toISOString()) : null
					};
					currentIndent = indent;
					tasks.push(current);
					continue;
				}
				if (/:\s*$/.test(line) && indent === 0) {
					projectId = registry.ensure(line.replace(/:\s*$/, ''));
					current = null;
					continue;
				}
				if (current && indent > currentIndent)
					current.notes = clampNotes([current.notes ?? '', line].filter(Boolean).join('\n'));
			}
			return { data: { projects: registry.projects, tasks }, warnings: [] };
		}
	},
	exporter: {
		instructions: [
			'Opens in TaskPaper, and pastes cleanly into OmniFocus, Bike or any text editor.'
		],
		serialize: serializeTaskPaper
	}
};

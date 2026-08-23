import type { Format, TransferData } from '../types';
import { clampTitle, dateOnly, parseDate, parseRepeat, projectRegistry } from '../values';

const PRIORITY_IN = { A: 'high', B: 'medium', C: 'low' } as const;
const PRIORITY_OUT = { high: 'A', medium: 'B', low: 'C', none: '' } as const;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const parseLine = (line: string) => {
	const tokens = line.trim().split(/\s+/);
	let done = false;
	let priority: 'none' | 'low' | 'medium' | 'high' = 'none';
	let completedAt: string | null = null;
	let createdAt: string | undefined;
	if (tokens[0] === 'x') {
		done = true;
		tokens.shift();
	}
	const prio = /^\(([A-Z])\)$/.exec(tokens[0] ?? '');
	if (prio) {
		priority = PRIORITY_IN[prio[1] as keyof typeof PRIORITY_IN] ?? 'low';
		tokens.shift();
	}
	if (DATE.test(tokens[0] ?? '')) {
		const first = parseDate(tokens.shift());
		if (done && DATE.test(tokens[0] ?? '')) {
			completedAt = first;
			createdAt = parseDate(tokens.shift()) ?? undefined;
		} else if (done) completedAt = first;
		else createdAt = first ?? undefined;
	}
	const labels: string[] = [];
	let project: string | null = null;
	let dueAt: string | null = null;
	let repeat = null;
	const words: string[] = [];
	for (const token of tokens) {
		if (/^\+\S/.test(token)) {
			project ??= token.slice(1).replace(/_/g, ' ');
			continue;
		}
		if (/^@\S/.test(token)) {
			labels.push(token.slice(1));
			continue;
		}
		const kv = /^([a-zA-Z]+):(\S+)$/.exec(token);
		if (kv) {
			const [, key, value] = kv;
			if (key === 'due') dueAt = parseDate(value);
			else if (key === 'rec') repeat = parseRepeat(value.replace(/^\+/, ''));
			else if (key === 'pri') priority = PRIORITY_IN[value as keyof typeof PRIORITY_IN] ?? priority;
			else words.push(token);
			continue;
		}
		words.push(token);
	}
	return {
		title: clampTitle(words.join(' ')),
		priority,
		dueAt,
		repeat,
		labels: labels.slice(0, 20),
		project,
		status: done ? ('done' as const) : ('open' as const),
		completedAt: done ? (completedAt ?? new Date().toISOString()) : null,
		createdAt
	};
};

export const todotxt: Format = {
	id: 'todotxt',
	name: 'todo.txt',
	tagline: 'The plain text standard',
	extensions: ['.txt'],
	mark: 'txt',
	hue: 90,
	importer: {
		instructions: [
			'Choose your todo.txt (and optionally done.txt) file.',
			'+projects become projects, @contexts become labels, (A)/(B)/(C) become high/medium/low priority, and due: and rec: are understood.'
		],
		detect: (text, filename) => {
			const lines = text.split(/\r?\n/).filter((l) => l.trim());
			if (!lines.length) return 0;
			const hits = lines.filter((l) =>
				/^(x |\([A-Z]\) |\d{4}-\d{2}-\d{2} )|(^|\s)[+@]\S|due:\d{4}/.test(l)
			).length;
			const score = hits / lines.length;
			return filename.endsWith('.txt') && /todo|done/i.test(filename)
				? Math.max(score, 0.7)
				: score * 0.8;
		},
		parse: (text) => {
			const registry = projectRegistry();
			const tasks = text
				.split(/\r?\n/)
				.filter((l) => l.trim())
				.map((line) => {
					const { project, ...task } = parseLine(line);
					return { ...task, projectId: registry.ensure(project) };
				});
			return { data: { projects: registry.projects, tasks }, warnings: [] };
		}
	},
	exporter: {
		instructions: [
			'Works with any todo.txt client, including Sleek, SimpleTask, todo.sh and Markor.',
			'Notes are not part of todo.txt, so they are left out.'
		],
		serialize: (data: TransferData, stamp) => {
			const projectNames = new Map(data.projects.map((p) => [p.id, p.name]));
			const lines = data.tasks.map((t) => {
				const parts = [
					t.status === 'done' ? 'x' : '',
					t.status !== 'done' && PRIORITY_OUT[t.priority ?? 'none']
						? `(${PRIORITY_OUT[t.priority ?? 'none']})`
						: '',
					t.status === 'done' ? dateOnly(t.completedAt ?? t.createdAt) : '',
					dateOnly(t.createdAt),
					t.title,
					t.projectId && projectNames.get(t.projectId)
						? `+${projectNames.get(t.projectId)!.replace(/\s+/g, '_')}`
						: '',
					...(t.labels ?? []).map((l) => `@${l.replace(/\s+/g, '_')}`),
					t.dueAt ? `due:${dateOnly(t.dueAt)}` : '',
					t.repeat ? `rec:${t.repeat.interval}${t.repeat.every[0]}` : '',
					t.status === 'done' && PRIORITY_OUT[t.priority ?? 'none']
						? `pri:${PRIORITY_OUT[t.priority ?? 'none']}`
						: ''
				];
				return parts.filter(Boolean).join(' ');
			});
			return {
				content: lines.join('\n') + '\n',
				filename: `todo-${stamp}.txt`,
				mime: 'text/plain'
			};
		}
	}
};

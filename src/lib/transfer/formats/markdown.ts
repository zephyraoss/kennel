import type { Format, TransferData, TransferTask } from '../types';
import logo from '$lib/assets/logos/markdown.svg';
import obsidian from '$lib/assets/logos/obsidian.svg';
import logseq from '$lib/assets/logos/logseq.svg';
import {
	clampNotes,
	clampTitle,
	dateOnly,
	parseDate,
	parseRepeat,
	projectRegistry,
	repeatToText
} from '../values';

const CHECKBOX = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX\-/])\]\s+(.*)$/;
const HEADING = /^#{1,6}\s+(.+?)\s*#*\s*$/;

const PRIORITY_EMOJI: Record<string, 'high' | 'medium' | 'low'> = {
	'🔺': 'high',
	'⏫': 'high',
	'🔼': 'medium',
	'🔽': 'low',
	'⏬': 'low'
};

const parseTaskLine = (
	body: string
): Omit<TransferTask, 'projectId' | 'status' | 'completedAt'> & { completedAt: string | null } => {
	let text = body;
	let dueAt: string | null = null;
	let completedAt: string | null = null;
	let createdAt: string | undefined;
	let repeat = null;
	let priority: TransferTask['priority'] = 'none';
	const labels: string[] = [];
	text = text.replace(/[📅🗓]\s*(\d{4}-\d{2}-\d{2})/u, (_, d) => ((dueAt = parseDate(d)), ''));
	text = text.replace(/✅\s*(\d{4}-\d{2}-\d{2})/u, (_, d) => ((completedAt = parseDate(d)), ''));
	text = text.replace(
		/➕\s*(\d{4}-\d{2}-\d{2})/u,
		(_, d) => ((createdAt = parseDate(d) ?? undefined), '')
	);
	text = text.replace(/[⏳🛫]\s*\d{4}-\d{2}-\d{2}/gu, '');
	text = text.replace(/🔁\s*([^📅✅➕⏳🛫#]+)/u, (_, r) => ((repeat = parseRepeat(r.trim())), ''));
	text = text.replace(/(🔺|⏫|🔼|🔽|⏬)/u, (_, e) => ((priority = PRIORITY_EMOJI[e]), ''));
	text = text.replace(/\[due::\s*([^\]]+)\]/i, (_, d) => ((dueAt = parseDate(d)), ''));
	text = text.replace(/\[completion::\s*([^\]]+)\]/i, (_, d) => ((completedAt = parseDate(d)), ''));
	text = text.replace(
		/\[priority::\s*([^\]]+)\]/i,
		(_, p) => ((priority = /high/i.test(p) ? 'high' : /medium/i.test(p) ? 'medium' : 'low'), '')
	);
	text = text.replace(
		/(?:^|\s)@due\((\d{4}-\d{2}-\d{2})\)/,
		(_, d) => ((dueAt = parseDate(d)), '')
	);
	text = text.replace(/(?:^|\s)#([\w/-]+)/g, (_, tag: string) => {
		labels.push(tag);
		return '';
	});
	if (!dueAt) {
		const loose = /\b(?:due|by)[:\s]+(\d{4}-\d{2}-\d{2})/i.exec(text);
		if (loose) {
			dueAt = parseDate(loose[1]);
			text = text.replace(loose[0], '');
		}
	}
	return {
		title: clampTitle(text.replace(/\s+/g, ' ')),
		notes: null,
		dueAt,
		completedAt,
		createdAt,
		repeat,
		priority,
		labels: labels.slice(0, 20)
	};
};

export const markdown: Format = {
	id: 'markdown',
	name: 'Markdown',
	tagline: 'Checklists, Obsidian Tasks, Logseq',
	extensions: ['.md', '.markdown', '.txt'],
	mark: 'MD',
	hue: 250,
	logo,
	apps: [
		{ name: 'Obsidian', logo: obsidian },
		{ name: 'Logseq', logo: logseq }
	],
	importer: {
		instructions: [
			'Choose a Markdown file with "- [ ]" checklists. Headings become projects and indented lines under a task become its notes.',
			'Obsidian Tasks syntax is understood: 📅 due dates, ✅ completion, 🔁 repeats, ⏫ priorities and #tags.'
		],
		detect: (text, filename) => {
			const lines = text.split(/\r?\n/);
			const boxes = lines.filter((l) => CHECKBOX.test(l)).length;
			if (!boxes) return 0;
			return /\.(md|markdown)$/i.test(filename) ? 1 : 0.8;
		},
		parse: (text) => {
			const registry = projectRegistry();
			const tasks: TransferTask[] = [];
			let projectId: string | null = null;
			let current: TransferTask | null = null;
			let currentIndent = 0;
			for (const raw of text.split(/\r?\n/)) {
				const heading = HEADING.exec(raw);
				if (heading) {
					projectId = registry.ensure(heading[1]);
					current = null;
					continue;
				}
				const box = CHECKBOX.exec(raw);
				if (box) {
					const done = box[1] !== ' ';
					const parsed = parseTaskLine(box[2]);
					current = {
						...parsed,
						projectId,
						status: done ? 'done' : 'open',
						completedAt: done ? (parsed.completedAt ?? new Date().toISOString()) : null
					};
					currentIndent = /^\s*/.exec(raw)![0].length;
					tasks.push(current);
					continue;
				}
				const indent = /^\s*/.exec(raw)![0].length;
				if (current && raw.trim() && indent > currentIndent)
					current.notes = clampNotes([current.notes ?? '', raw.trim()].filter(Boolean).join('\n'));
				else if (raw.trim() === '') continue;
				else current = null;
			}
			return { data: { projects: registry.projects, tasks }, warnings: [] };
		}
	},
	exporter: {
		instructions: [
			'Drop it into Obsidian, Logseq or any notes app. Due dates, priorities and repeats use Obsidian Tasks syntax so they stay queryable.'
		],
		serialize: (data: TransferData, stamp) => {
			const line = (t: TransferTask) => {
				const parts = [
					`- [${t.status === 'done' ? 'x' : ' '}] ${t.title}`,
					...(t.labels ?? []).map((l) => `#${l.replace(/\s+/g, '-')}`),
					t.priority === 'high'
						? '⏫'
						: t.priority === 'medium'
							? '🔼'
							: t.priority === 'low'
								? '🔽'
								: '',
					t.repeat ? `🔁 ${repeatToText(t.repeat)}` : '',
					t.createdAt ? `➕ ${dateOnly(t.createdAt)}` : '',
					t.dueAt ? `📅 ${dateOnly(t.dueAt)}` : '',
					t.status === 'done' && t.completedAt ? `✅ ${dateOnly(t.completedAt)}` : ''
				].filter(Boolean);
				const notes = (t.notes ?? '')
					.split('\n')
					.filter((n) => n.trim())
					.map((n) => `    ${n}`);
				return [parts.join(' '), ...notes].join('\n');
			};
			const sections = [
				...(data.tasks.some((t) => !t.projectId)
					? [
							data.tasks
								.filter((t) => !t.projectId)
								.map(line)
								.join('\n')
						]
					: []),
				...data.projects.map((p) =>
					[`## ${p.name}`, '', ...data.tasks.filter((t) => t.projectId === p.id).map(line)].join(
						'\n'
					)
				)
			];
			return {
				content: `# Tasks\n\n${sections.join('\n\n')}\n`,
				filename: `kennel-${stamp}.md`,
				mime: 'text/markdown'
			};
		}
	}
};

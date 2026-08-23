import { csvTable, parseCsv, toCsv } from '../csv';
import type { Format, TransferData } from '../types';
import logo from '$lib/assets/logos/todoist.svg';
import {
	clampNotes,
	clampTitle,
	dateOnly,
	parseSchedule,
	projectRegistry,
	repeatToText
} from '../values';

const PRIORITY_IN = { '4': 'high', '3': 'medium', '2': 'low' } as const;
const PRIORITY_OUT = { high: 4, medium: 3, low: 2, none: 1 } as const;

const extractLabels = (content: string) => {
	const labels: string[] = [];
	const title = content
		.replace(/(^|\s)@([\w-]+)/g, (_, space: string, label: string) => {
			labels.push(label);
			return space.trimEnd();
		})
		.replace(/\s+/g, ' ')
		.trim();
	return { title, labels };
};

const projectFromFilename = (filename: string) =>
	filename
		.replace(/\.csv$/i, '')
		.replace(/[_-]+/g, ' ')
		.trim();

export const todoist: Format = {
	id: 'todoist',
	name: 'Todoist',
	tagline: 'Project CSV export',
	extensions: ['.csv'],
	mark: 'Td',
	hue: 0,
	logo,
	importer: {
		instructions: [
			'In Todoist, open a project, click the three dots, then "Export as CSV" (or "Export as template" in older versions).',
			'Each file is one project. Sections in the file become labels on their tasks, and the project name comes from the filename.',
			'Repeat the import for each project you want to bring over.'
		],
		detect: (text, filename) => {
			const header = text.split(/\r?\n/, 1)[0]?.toUpperCase() ?? '';
			return header.startsWith('TYPE,CONTENT')
				? 1
				: filename.endsWith('.csv') && header.includes('INDENT')
					? 0.7
					: 0;
		},
		parse: (text, { filename }) => {
			const table = csvTable(parseCsv(text));
			const registry = projectRegistry();
			const projectId = registry.ensure(projectFromFilename(filename) || 'Todoist');
			const warnings: string[] = [];
			let section: string | null = null;
			let unsupported = 0;
			const tasks = table.records.flatMap((r) => {
				const type = (r.TYPE ?? '').toLowerCase();
				if (type === 'section') {
					section = r.CONTENT?.trim() || null;
					return [];
				}
				if (type !== 'task' || !r.CONTENT?.trim()) return [];
				const { title, labels } = extractLabels(r.CONTENT);
				const schedule = parseSchedule(r.DATE);
				if (schedule.unsupported) unsupported++;
				return [
					{
						title: clampTitle(title),
						notes: clampNotes(r.DESCRIPTION),
						priority: PRIORITY_IN[r.PRIORITY as keyof typeof PRIORITY_IN] ?? 'none',
						dueAt: schedule.dueAt,
						repeat: schedule.repeat,
						labels: [...labels, ...(section ? [section] : [])].slice(0, 20),
						projectId,
						status: 'open' as const
					}
				];
			});
			if (unsupported)
				warnings.push(
					`${unsupported} task${unsupported === 1 ? ' has a' : 's have'} recurrence kennel can't express (only daily, weekly and monthly repeats are supported). They were imported without repeat.`
				);
			return { data: { projects: registry.projects, tasks }, warnings };
		}
	},
	exporter: {
		instructions: [
			'In Todoist, create or open a project, click the three dots, then "Import from CSV" (or "Import from template").',
			'Your kennel projects become sections inside that Todoist project. Labels are kept as @labels.'
		],
		serialize: (data: TransferData, stamp) => {
			const header = [
				'TYPE',
				'CONTENT',
				'DESCRIPTION',
				'PRIORITY',
				'INDENT',
				'AUTHOR',
				'RESPONSIBLE',
				'DATE',
				'DATE_LANG',
				'TIMEZONE',
				'DURATION',
				'DURATION_UNIT'
			];
			const rows: unknown[][] = [];
			const emit = (tasks: typeof data.tasks) => {
				for (const t of tasks) {
					if (t.status === 'done') continue;
					const content = [
						t.title,
						...(t.labels ?? []).map((l) => `@${l.replace(/\s+/g, '_')}`)
					].join(' ');
					const date = t.repeat
						? `${repeatToText(t.repeat)}${t.dueAt ? ` starting ${dateOnly(t.dueAt)}` : ''}`
						: dateOnly(t.dueAt);
					rows.push([
						'task',
						content,
						t.notes ?? '',
						PRIORITY_OUT[t.priority ?? 'none'],
						1,
						'',
						'',
						date,
						'en',
						'',
						'',
						''
					]);
					rows.push(['', '', '', '', '', '', '', '', '', '', '', '']);
				}
			};
			emit(data.tasks.filter((t) => !t.projectId));
			for (const p of data.projects) {
				const tasks = data.tasks.filter((t) => t.projectId === p.id);
				if (!tasks.some((t) => t.status !== 'done')) continue;
				rows.push(['section', p.name, '', '', '', '', '', '', '', '', '', '']);
				rows.push(['', '', '', '', '', '', '', '', '', '', '', '']);
				emit(tasks);
			}
			return {
				content: toCsv([header, ...rows]),
				filename: `kennel-todoist-${stamp}.csv`,
				mime: 'text/csv'
			};
		}
	}
};

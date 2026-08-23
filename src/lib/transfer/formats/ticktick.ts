import { csvTable, parseCsv, toCsv } from '../csv';
import type { Format, TransferData } from '../types';
import logo from '$lib/assets/logos/ticktick.svg';
import {
	clampNotes,
	clampTitle,
	parseDate,
	parseRepeat,
	projectRegistry,
	repeatToRrule,
	splitList
} from '../values';

const PRIORITY_IN: Record<string, 'none' | 'low' | 'medium' | 'high'> = {
	'0': 'none',
	'1': 'low',
	'3': 'medium',
	'5': 'high'
};
const PRIORITY_OUT = { none: 0, low: 1, medium: 3, high: 5 } as const;

const HEADER = [
	'Folder Name',
	'List Name',
	'Title',
	'Kind',
	'Tags',
	'Content',
	'Is Check list',
	'Start Date',
	'Due Date',
	'Reminder',
	'Repeat',
	'Priority',
	'Status',
	'Created Time',
	'Completed Time',
	'Order',
	'Timezone',
	'Is All Day',
	'Is Floating',
	'Column Name',
	'Column Order',
	'View Mode',
	'taskId',
	'parentId'
];

const headerRowIndex = (rows: string[][]) =>
	rows.findIndex((r) => r[0]?.trim() === 'Folder Name' && r.includes('Title'));

const stamp = (iso: string | null | undefined) => (iso ? iso.replace(/\.\d{3}Z$/, '+0000') : '');

export const ticktick: Format = {
	id: 'ticktick',
	name: 'TickTick',
	tagline: 'Backup CSV from Settings',
	extensions: ['.csv'],
	mark: 'TT',
	hue: 200,
	container: 'csv',
	logo,
	importer: {
		instructions: [
			'In TickTick, open Settings, then Backup, then "Generate backup" and download the CSV.',
			'Lists become projects and tags become labels. Checklist items are imported as notes on their task.'
		],
		detect: (text) => (headerRowIndex(parseCsv(text).slice(0, 12)) >= 0 ? 1 : 0),
		parse: (text) => {
			const rows = parseCsv(text);
			const index = headerRowIndex(rows);
			if (index < 0) throw new Error('Not a TickTick backup CSV');
			const table = csvTable(rows, index);
			const registry = projectRegistry();
			const warnings: string[] = [];
			let unsupported = 0;
			const tasks = table.records
				.filter((r) => r.Title?.trim() && (r.Kind ?? '').toUpperCase() !== 'NOTE')
				.map((r) => {
					const repeat = parseRepeat(r.Repeat);
					if (r.Repeat?.trim() && !repeat) unsupported++;
					const done = r.Status?.trim() !== '0' && r.Status?.trim() !== '';
					return {
						title: clampTitle(r.Title),
						notes: clampNotes(r.Content),
						priority: PRIORITY_IN[r.Priority?.trim()] ?? 'none',
						dueAt: parseDate(r['Due Date']) ?? parseDate(r['Start Date']),
						repeat,
						labels: splitList(r.Tags),
						projectId: registry.ensure(r['List Name']),
						status: done ? ('done' as const) : ('open' as const),
						completedAt: done ? (parseDate(r['Completed Time']) ?? new Date().toISOString()) : null,
						createdAt: parseDate(r['Created Time']) ?? undefined
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
			'In TickTick, open Settings, then Backup, then "Import from TickTick backup" and choose this file.',
			'Projects become lists and labels become tags.'
		],
		serialize: (data: TransferData, dateStamp) => {
			const projectNames = new Map(data.projects.map((p) => [p.id, p.name]));
			const rows = data.tasks.map((t, i) => [
				'',
				t.projectId ? (projectNames.get(t.projectId) ?? 'Inbox') : 'Inbox',
				t.title,
				'TEXT',
				(t.labels ?? []).join(', '),
				t.notes ?? '',
				'N',
				'',
				stamp(t.dueAt),
				'',
				t.repeat ? `RRULE:${repeatToRrule(t.repeat)}` : '',
				PRIORITY_OUT[t.priority ?? 'none'],
				t.status === 'done' ? 2 : 0,
				stamp(t.createdAt),
				stamp(t.completedAt),
				-i,
				'UTC',
				'true',
				'false',
				'',
				'',
				'list',
				'',
				''
			]);
			const meta = [
				[`"Date: ${dateStamp}"`],
				['"Version: 7.1"'],
				['"Status: 0 Normal, 1 Completed, 2 Archived"'],
				['"Priority: 0 None, 1 Low, 3 Medium, 5 High"'],
				['"Kind: TEXT, CHECKLIST, NOTE"'],
				[]
			];
			return {
				content: meta.map((m) => m.join(',')).join('\r\n') + '\r\n' + toCsv([HEADER, ...rows]),
				filename: `kennel-ticktick-${dateStamp}.csv`,
				mime: 'text/csv'
			};
		}
	}
};

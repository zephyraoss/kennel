import { csvTable, detectDelimiter, findHeader, parseCsv, toCsv } from '../csv';
import sheets from '$lib/assets/logos/google-sheets.svg';
import libreoffice from '$lib/assets/logos/libreoffice.svg';
import type { ColumnMapping, Format, ParseOptions, TransferData } from '../types';
import {
	clampNotes,
	clampTitle,
	dateOnly,
	parseBoolean,
	parseDate,
	parsePriority,
	parseRepeat,
	projectRegistry,
	repeatToText,
	splitList
} from '../values';

export const guessColumns = (headers: string[]): ColumnMapping => ({
	title: findHeader(
		headers,
		'title',
		'name',
		'task',
		'content',
		'summary',
		'subject',
		'description'
	),
	notes: findHeader(headers, 'notes', 'note', 'description', 'details', 'body', 'desc'),
	status: findHeader(headers, 'status', 'done', 'completed', 'complete', 'state', 'checked'),
	priority: findHeader(headers, 'priority', 'importance', 'urgency'),
	dueAt: findHeader(headers, 'due', 'dueAt', 'due date', 'deadline', 'date', 'due on', 'end date'),
	repeat: findHeader(headers, 'repeat', 'recurrence', 'recur', 'rrule'),
	labels: findHeader(headers, 'labels', 'label', 'tags', 'tag', 'categories', 'category'),
	project: findHeader(headers, 'project', 'list', 'list name', 'board', 'folder', 'section'),
	completedAt: findHeader(
		headers,
		'completedAt',
		'completed at',
		'completion date',
		'date completed',
		'completed on',
		'done at'
	),
	createdAt: findHeader(
		headers,
		'createdAt',
		'created at',
		'created',
		'creation date',
		'date created',
		'added'
	)
});

const readTable = (text: string) => csvTable(parseCsv(text, detectDelimiter(text)));

export const parseMapped = (text: string, { mapping }: ParseOptions) => {
	const table = readTable(text);
	const map = { ...guessColumns(table.headers), ...mapping };
	if (!map.title) throw new Error('Choose which column holds the task title');
	const registry = projectRegistry();
	const warnings: string[] = [];
	let unsupportedRepeats = 0;
	const tasks = table.records
		.filter((r) => (r[map.title!] ?? '').trim())
		.map((r) => {
			const pick = (field: keyof ColumnMapping) => (map[field] ? r[map[field]!] : undefined);
			const statusValue = pick('status');
			const completedAt = parseDate(pick('completedAt'));
			const done = statusValue
				? parseBoolean(statusValue) || /done|complete|closed|finished/i.test(statusValue)
				: completedAt !== null;
			const repeatValue = pick('repeat');
			const repeat = parseRepeat(repeatValue);
			if (repeatValue?.trim() && !repeat) unsupportedRepeats++;
			return {
				title: clampTitle(pick('title')),
				notes: clampNotes(pick('notes') === pick('title') ? null : pick('notes')),
				status: done ? ('done' as const) : ('open' as const),
				priority: parsePriority(pick('priority')),
				dueAt: parseDate(pick('dueAt')),
				repeat,
				labels: splitList(pick('labels')),
				projectId: registry.ensure(pick('project')),
				completedAt: done
					? (completedAt ?? parseDate(pick('dueAt')) ?? new Date().toISOString())
					: null,
				createdAt: parseDate(pick('createdAt')) ?? undefined
			};
		});
	if (unsupportedRepeats)
		warnings.push(
			`${unsupportedRepeats} recurrence rule${unsupportedRepeats === 1 ? '' : 's'} couldn't be converted and were dropped (kennel repeats daily, weekly or monthly only).`
		);
	return { data: { projects: registry.projects, tasks }, warnings };
};

export const columnsOf = (text: string) => readTable(text).headers;

export const csvDetect = (text: string, filename: string) => {
	if (!/\.(csv|tsv|txt)$/i.test(filename)) return 0;
	const headers = columnsOf(text);
	return headers.length >= 2 && guessColumns(headers).title ? 0.5 : 0.1;
};

export const serializeCsv = (data: TransferData, stamp: string) => {
	const projectNames = new Map(data.projects.map((p) => [p.id, p.name]));
	const rows = data.tasks.map((t) => [
		t.title,
		t.notes ?? '',
		t.status ?? 'open',
		t.priority ?? 'none',
		dateOnly(t.dueAt),
		repeatToText(t.repeat),
		(t.labels ?? []).join(', '),
		t.projectId ? (projectNames.get(t.projectId) ?? '') : '',
		dateOnly(t.completedAt),
		dateOnly(t.createdAt)
	]);
	return {
		content: toCsv([
			[
				'Title',
				'Notes',
				'Status',
				'Priority',
				'Due',
				'Repeat',
				'Labels',
				'Project',
				'Completed',
				'Created'
			],
			...rows
		]),
		filename: `kennel-${stamp}.csv`,
		mime: 'text/csv'
	};
};

export const csv: Format = {
	id: 'csv',
	name: 'Any spreadsheet',
	tagline: 'Pick which columns mean what',
	extensions: ['.csv', '.tsv', '.txt'],
	mark: 'CSV',
	hue: 150,
	container: 'csv',
	apps: [
		{ name: 'Google Sheets', logo: sheets },
		{ name: 'LibreOffice', logo: libreoffice }
	],
	importer: {
		instructions: [
			'Export a CSV from any app or spreadsheet with a header row.',
			"You'll pick which columns map to title, notes, due date and so on in the next step."
		],
		detect: csvDetect,
		columns: columnsOf,
		guessMapping: guessColumns,
		parse: parseMapped
	},
	exporter: {
		instructions: [
			'Opens in Excel, Numbers or Google Sheets. Most apps can import this with a column mapping step.'
		],
		serialize: serializeCsv
	}
};

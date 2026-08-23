import { csvTable, findHeader, parseCsv } from '../csv';
import type { Format } from '../types';
import logo from '$lib/assets/logos/omnifocus.png';
import { clampNotes, clampTitle, parseDate, projectRegistry, splitList } from '../values';
import { serializeTaskPaper } from './taskpaper';

const isOmniFocus = (headers: string[]) =>
	Boolean(
		findHeader(headers, 'Task ID') && findHeader(headers, 'Name') && findHeader(headers, 'Flagged')
	);

export const omnifocus: Format = {
	id: 'omnifocus',
	name: 'OmniFocus',
	tagline: 'CSV export in, TaskPaper out',
	extensions: ['.csv'],
	mark: 'OF',
	hue: 265,
	container: 'csv',
	logo,
	importer: {
		instructions: [
			'In OmniFocus for Mac, choose File, then Export, and pick "Comma Separated Values (CSV)".',
			'Projects become projects, tags and contexts become labels, and flagged tasks are imported with high priority. Dropped tasks are skipped.'
		],
		detect: (text) => (isOmniFocus(csvTable(parseCsv(text)).headers) ? 1 : 0),
		parse: (text) => {
			const table = csvTable(parseCsv(text));
			if (!isOmniFocus(table.headers)) throw new Error('Not an OmniFocus CSV export');
			const h = table.headers;
			const col = (...names: string[]) => findHeader(h, ...names) ?? '';
			const registry = projectRegistry();
			const tasks = table.records
				.filter((r) => r[col('Name')]?.trim() && !/project|folder/i.test(r[col('Type')] ?? ''))
				.filter((r) => !/dropped/i.test(r[col('Status')] ?? ''))
				.map((r) => {
					const done =
						/completed|done/i.test(r[col('Status')] ?? '') ||
						Boolean(r[col('Completion Date')]?.trim());
					return {
						title: clampTitle(r[col('Name')]),
						notes: clampNotes(r[col('Notes')]),
						priority: /^(1|true|yes)$/i.test(r[col('Flagged')] ?? '')
							? ('high' as const)
							: ('none' as const),
						dueAt: parseDate(r[col('Due Date')]),
						labels: splitList([r[col('Tags')], r[col('Context')]].filter(Boolean).join(',')),
						projectId: registry.ensure(r[col('Project')]),
						status: done ? ('done' as const) : ('open' as const),
						completedAt: done
							? (parseDate(r[col('Completion Date')]) ?? new Date().toISOString())
							: null
					};
				});
			return { data: { projects: registry.projects, tasks }, warnings: [] };
		}
	},
	exporter: {
		instructions: [
			'Open the file, select all and copy, then paste into an OmniFocus project. OmniFocus understands TaskPaper text, including @due, @tags and @flagged.',
			'High priority tasks are exported as flagged.'
		],
		serialize: (data, stamp) => ({
			...serializeTaskPaper(data, stamp),
			filename: `kennel-omnifocus-${stamp}.taskpaper`
		})
	}
};

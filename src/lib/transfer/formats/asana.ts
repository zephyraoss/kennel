import { csvTable, findHeader, parseCsv, toCsv } from '../csv';
import type { Format, TransferData } from '../types';
import logo from '$lib/assets/logos/asana.svg';
import {
	clampNotes,
	clampTitle,
	dateOnly,
	parseDate,
	parsePriority,
	projectRegistry,
	splitList
} from '../values';

const isAsana = (headers: string[]) =>
	Boolean(
		findHeader(headers, 'Task ID') &&
		findHeader(headers, 'Name') &&
		findHeader(headers, 'Section/Column')
	);

export const asana: Format = {
	id: 'asana',
	name: 'Asana',
	tagline: 'Project CSV export',
	extensions: ['.csv'],
	mark: 'As',
	hue: 345,
	logo,
	importer: {
		instructions: [
			'In Asana, open a project, click the dropdown next to its name, then "Export/Print" and "CSV".',
			'The project name comes from the "Projects" column, sections become labels, and completed tasks keep their completion date.'
		],
		detect: (text) => (isAsana(csvTable(parseCsv(text)).headers) ? 1 : 0),
		parse: (text) => {
			const table = csvTable(parseCsv(text));
			if (!isAsana(table.headers)) throw new Error('Not an Asana CSV export');
			const h = table.headers;
			const col = (...names: string[]) => findHeader(h, ...names);
			const name = col('Name')!;
			const registry = projectRegistry();
			const tasks = table.records
				.filter((r) => r[name]?.trim())
				.map((r) => {
					const completedAt = parseDate(r[col('Completed At') ?? '']);
					const section = r[col('Section/Column') ?? '']?.trim();
					return {
						title: clampTitle(r[name]),
						notes: clampNotes(r[col('Notes', 'Description') ?? '']),
						priority: parsePriority(r[col('Priority') ?? '']),
						dueAt: parseDate(r[col('Due Date') ?? '']),
						labels: [...splitList(r[col('Tags') ?? '']), ...(section ? [section] : [])].slice(
							0,
							20
						),
						projectId: registry.ensure(splitList(r[col('Projects') ?? ''])[0]),
						status: completedAt ? ('done' as const) : ('open' as const),
						completedAt,
						createdAt: parseDate(r[col('Created At') ?? '']) ?? undefined
					};
				});
			return { data: { projects: registry.projects, tasks }, warnings: [] };
		}
	},
	exporter: {
		instructions: [
			'In Asana, create a project, click "Add tasks via", then "CSV" and upload this file.',
			'Kennel projects become sections. Asana will ask you to confirm the column mapping.'
		],
		serialize: (data: TransferData, stamp) => {
			const projectNames = new Map(data.projects.map((p) => [p.id, p.name]));
			const rows = data.tasks.map((t) => [
				t.title,
				t.notes ?? '',
				t.projectId ? (projectNames.get(t.projectId) ?? '') : '',
				dateOnly(t.dueAt),
				(t.labels ?? []).join(', '),
				t.priority === 'none' ? '' : (t.priority ?? ''),
				dateOnly(t.completedAt)
			]);
			return {
				content: toCsv([
					['Name', 'Notes', 'Section/Column', 'Due Date', 'Tags', 'Priority', 'Completed At'],
					...rows
				]),
				filename: `kennel-asana-${stamp}.csv`,
				mime: 'text/csv'
			};
		}
	}
};

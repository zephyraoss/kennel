import type { Format, TransferData } from '../types';
import logo from '$lib/assets/logos/nextcloud.svg';
import {
	clampNotes,
	clampTitle,
	compactDate,
	parseDate,
	parseRepeat,
	projectRegistry,
	repeatToRrule,
	splitList
} from '../values';

const unfold = (text: string) => text.replace(/\r?\n[ \t]/g, '');

const unescape = (value: string) =>
	value.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');

const escape = (value: string) =>
	value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

const fold = (line: string) => {
	const chunks: string[] = [];
	let rest = line;
	while (rest.length > 73) {
		chunks.push(rest.slice(0, 73));
		rest = ' ' + rest.slice(73);
	}
	chunks.push(rest);
	return chunks.join('\r\n');
};

type Component = { props: Map<string, { value: string; params: Record<string, string> }> };

const parseComponents = (text: string) => {
	const calendarName = /X-WR-CALNAME[^:]*:(.*)/.exec(unfold(text))?.[1]?.trim();
	const todos: Component[] = [];
	let current: Component | null = null;
	for (const line of unfold(text).split(/\r?\n/)) {
		if (/^BEGIN:VTODO/i.test(line)) {
			current = { props: new Map() };
			continue;
		}
		if (/^END:VTODO/i.test(line)) {
			if (current) todos.push(current);
			current = null;
			continue;
		}
		if (!current) continue;
		const colon = line.indexOf(':');
		if (colon < 0) continue;
		const [name, ...paramParts] = line.slice(0, colon).split(';');
		const params = Object.fromEntries(paramParts.map((p) => p.split('=') as [string, string]));
		current.props.set(name.toUpperCase(), { value: line.slice(colon + 1), params });
	}
	return { todos, calendarName };
};

const priorityIn = (value: string | undefined) => {
	const n = Number(value);
	if (!n) return 'none' as const;
	return n <= 4 ? ('high' as const) : n === 5 ? ('medium' as const) : ('low' as const);
};

const PRIORITY_OUT = { high: 1, medium: 5, low: 9, none: 0 } as const;

export const ics: Format = {
	id: 'ics',
	name: 'iCalendar (VTODO)',
	tagline: 'Nextcloud Tasks, Thunderbird, CalDAV',
	extensions: ['.ics', '.ical', '.ifb'],
	mark: 'iCal',
	hue: 175,
	logo,
	importer: {
		instructions: [
			'Export a task list or calendar as .ics from Nextcloud Tasks, Thunderbird, Remember The Milk, Tasks.org or any CalDAV server.',
			'Only VTODO entries are imported. Categories become labels, and the calendar name becomes the project.'
		],
		detect: (text, filename) => {
			const hasTodo = /BEGIN:VTODO/i.test(text);
			if (hasTodo) return 1;
			return /\.(ics|ical)$/i.test(filename) ? 0.3 : 0;
		},
		parse: (text, { filename }) => {
			const { todos, calendarName } = parseComponents(text);
			if (!todos.length) throw new Error('No tasks (VTODO) found in this calendar file');
			const registry = projectRegistry();
			const warnings: string[] = [];
			let unsupported = 0;
			const tasks = todos.map((c) => {
				const get = (name: string) => c.props.get(name)?.value;
				const status = (get('STATUS') ?? '').toUpperCase();
				const done = status === 'COMPLETED' || status === 'CANCELLED' || Boolean(get('COMPLETED'));
				const rrule = get('RRULE');
				const repeat = parseRepeat(rrule);
				if (rrule && !repeat) unsupported++;
				const projectName =
					get('X-KENNEL-PROJECT') ?? calendarName ?? filename.replace(/\.(ics|ical)$/i, '');
				return {
					title: clampTitle(unescape(get('SUMMARY') ?? '')),
					notes: clampNotes(unescape(get('DESCRIPTION') ?? '')),
					priority: priorityIn(get('PRIORITY')),
					dueAt: parseDate(get('DUE')) ?? parseDate(get('DTSTART')),
					repeat,
					labels: splitList(unescape(get('CATEGORIES') ?? '')),
					projectId: registry.ensure(projectName),
					status: done ? ('done' as const) : ('open' as const),
					completedAt: done ? (parseDate(get('COMPLETED')) ?? new Date().toISOString()) : null,
					createdAt: parseDate(get('CREATED') ?? get('DTSTAMP')) ?? undefined
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
			'Import into Nextcloud Tasks, Thunderbird, Apple Calendar, Tasks.org or any CalDAV client that accepts .ics files.',
			'Projects are stored as X-KENNEL-PROJECT so a round trip back into kennel keeps them.'
		],
		serialize: (data: TransferData, stamp) => {
			const projectNames = new Map(data.projects.map((p) => [p.id, p.name]));
			const now = compactDate(new Date().toISOString());
			const lines = [
				'BEGIN:VCALENDAR',
				'VERSION:2.0',
				'PRODID:-//kennel//tasks//EN',
				'X-WR-CALNAME:kennel',
				...data.tasks.flatMap((t) => [
					'BEGIN:VTODO',
					`UID:${crypto.randomUUID()}@kennel`,
					`DTSTAMP:${now}`,
					...(t.createdAt ? [`CREATED:${compactDate(t.createdAt)}`] : []),
					`SUMMARY:${escape(t.title)}`,
					...(t.notes ? [`DESCRIPTION:${escape(t.notes)}`] : []),
					...(t.dueAt ? [`DUE:${compactDate(t.dueAt)}`] : []),
					...(t.repeat ? [`RRULE:${repeatToRrule(t.repeat)}`] : []),
					...(PRIORITY_OUT[t.priority ?? 'none']
						? [`PRIORITY:${PRIORITY_OUT[t.priority ?? 'none']}`]
						: []),
					...(t.labels?.length ? [`CATEGORIES:${t.labels.map(escape).join(',')}`] : []),
					`STATUS:${t.status === 'done' ? 'COMPLETED' : 'NEEDS-ACTION'}`,
					...(t.status === 'done'
						? [
								`COMPLETED:${compactDate(t.completedAt ?? new Date().toISOString())}`,
								'PERCENT-COMPLETE:100'
							]
						: []),
					...(t.projectId && projectNames.get(t.projectId)
						? [`X-KENNEL-PROJECT:${escape(projectNames.get(t.projectId)!)}`]
						: []),
					'END:VTODO'
				]),
				'END:VCALENDAR'
			];
			return {
				content: lines.map(fold).join('\r\n') + '\r\n',
				filename: `kennel-${stamp}.ics`,
				mime: 'text/calendar'
			};
		}
	}
};

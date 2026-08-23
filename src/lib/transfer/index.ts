import type { Card, ContainerId, Format } from './types';
import { kennel } from './formats/kennel';
import { todoist } from './formats/todoist';
import { things } from './formats/things';
import { ticktick } from './formats/ticktick';
import { googleTasks } from './formats/google-tasks';
import { trello } from './formats/trello';
import { asana } from './formats/asana';
import { omnifocus } from './formats/omnifocus';
import { notion } from './formats/notion';
import { taskwarrior } from './formats/taskwarrior';
import { ics } from './formats/ics';
import { markdown } from './formats/markdown';
import { todotxt } from './formats/todotxt';
import { taskpaper } from './formats/taskpaper';
import { csv } from './formats/csv';

export const FORMATS: Format[] = [
	kennel,
	todoist,
	notion,
	trello,
	googleTasks,
	asana,
	ticktick,
	things,
	markdown,
	omnifocus,
	ics,
	taskwarrior,
	taskpaper,
	todotxt,
	csv
];

const CONTAINER_CARDS: Record<ContainerId, Omit<Card, 'tagline' | 'apps'>> = {
	csv: { id: 'csv', name: 'CSV', mark: 'CSV', hue: 150 },
	json: { id: 'json', name: 'JSON', mark: '{ }', hue: 260 }
};

const containerCard = (id: ContainerId, members: Format[]): Card => ({
	...CONTAINER_CARDS[id],
	tagline: members.map((m) => m.name).join(', '),
	apps: members.filter((m) => m.logo).map((m) => ({ name: m.name, logo: m.logo! }))
});

export type Entry =
	| { kind: 'format'; format: Format }
	| { kind: 'container'; id: ContainerId; card: Card; members: Format[] };

export const entriesFor = (formats: Format[]): Entry[] => {
	const entries: Entry[] = [];
	const seen = new Set<ContainerId>();
	for (const format of formats) {
		if (!format.container) {
			entries.push({ kind: 'format', format });
			continue;
		}
		if (seen.has(format.container)) continue;
		seen.add(format.container);
		const members = formats.filter((f) => f.container === format.container);
		entries.push({
			kind: 'container',
			id: format.container,
			card: containerCard(format.container, members),
			members
		});
	}
	return entries;
};

export const importFormats = () => FORMATS.filter((f) => f.importer);
export const exportFormats = () => FORMATS.filter((f) => f.exporter);
export const formatById = (id: string) => FORMATS.find((f) => f.id === id);

export const detectFormat = (text: string, filename: string) => {
	const name = filename.toLowerCase();
	const scored = importFormats()
		.map((format) => {
			try {
				return { format, score: format.importer!.detect(text, name) };
			} catch {
				return { format, score: 0 };
			}
		})
		.filter((s) => s.score > 0)
		.sort((a, b) => b.score - a.score);
	return scored[0] ?? null;
};

export const acceptFor = (format: Format) => [...new Set(format.extensions)].join(',');

export type {
	Card,
	ContainerId,
	Format,
	TransferData,
	TransferTask,
	TransferProject,
	ColumnMapping,
	Field
} from './types';
export { FIELDS } from './types';

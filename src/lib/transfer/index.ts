import type { Format } from './types';
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
	Format,
	TransferData,
	TransferTask,
	TransferProject,
	ColumnMapping,
	Field
} from './types';
export { FIELDS } from './types';

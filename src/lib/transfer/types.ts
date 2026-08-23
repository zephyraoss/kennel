import type { Repeat, TaskPriority, TaskStatus } from '$lib/task-types';

export type TransferTask = {
	title: string;
	notes?: string | null;
	priority?: TaskPriority;
	dueAt?: string | null;
	repeat?: Repeat | null;
	labels?: string[];
	projectId?: string | null;
	status?: TaskStatus;
	completedAt?: string | null;
	createdAt?: string;
};

export type TransferProject = { id: string; name: string };

export type TransferData = { projects: TransferProject[]; tasks: TransferTask[] };

export type ParseOutcome = { data: TransferData; warnings: string[] };

export const FIELDS = [
	'title',
	'notes',
	'status',
	'priority',
	'dueAt',
	'repeat',
	'labels',
	'project',
	'completedAt',
	'createdAt'
] as const;

export type Field = (typeof FIELDS)[number];

export type ColumnMapping = Partial<Record<Field, string>>;

export type ParseOptions = { filename: string; mapping?: ColumnMapping };

export type ExportFile = { content: string; filename: string; mime: string; link?: string };

export type Importer = {
	parse: (text: string, options: ParseOptions) => ParseOutcome;
	detect: (text: string, filename: string) => number;
	columns?: (text: string) => string[];
	guessMapping?: (columns: string[]) => ColumnMapping;
	instructions: string[];
};

export type Exporter = {
	serialize: (data: TransferData, stamp: string) => ExportFile;
	instructions: string[];
};

export type Format = {
	id: string;
	name: string;
	tagline: string;
	extensions: string[];
	mark: string;
	hue: number;
	logo?: string;
	importer?: Importer;
	exporter?: Exporter;
};

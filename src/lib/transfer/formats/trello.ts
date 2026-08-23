import type { Format, TransferTask } from '../types';
import logo from '$lib/assets/logos/trello.svg';
import { clampNotes, clampTitle, parseDate, projectRegistry, splitList } from '../values';

type TrelloBoard = {
	name?: string;
	lists?: { id: string; name: string; closed?: boolean }[];
	cards?: {
		id: string;
		name: string;
		desc?: string;
		idList: string;
		closed?: boolean;
		due?: string | null;
		dueComplete?: boolean;
		labels?: { name?: string; color?: string }[];
		idChecklists?: string[];
	}[];
	checklists?: {
		id: string;
		name: string;
		idCard: string;
		checkItems?: { name: string; state: string }[];
	}[];
};

const readBoard = (text: string): TrelloBoard | null => {
	const parsed = JSON.parse(text);
	return parsed && Array.isArray(parsed.cards) && Array.isArray(parsed.lists) ? parsed : null;
};

export const trello: Format = {
	id: 'trello',
	name: 'Trello',
	tagline: 'Board JSON export',
	extensions: ['.json'],
	mark: 'Tr',
	hue: 205,
	logo,
	importer: {
		instructions: [
			'In Trello, open the board menu, choose "Print, export, and share", then "Export as JSON".',
			'Lists become projects, labels become labels, and checklists are added to the card notes. Archived cards are skipped.'
		],
		detect: (text, filename) => {
			if (!filename.endsWith('.json')) return 0;
			try {
				return readBoard(text) ? 1 : 0;
			} catch {
				return 0;
			}
		},
		parse: (text) => {
			const board = readBoard(text);
			if (!board) throw new Error('Not a Trello board export');
			const registry = projectRegistry();
			const listNames = new Map(board.lists!.map((l) => [l.id, l.name]));
			const checklists = new Map<string, string[]>();
			for (const c of board.checklists ?? []) {
				const lines = [
					`${c.name}:`,
					...(c.checkItems ?? []).map((i) => `- [${i.state === 'complete' ? 'x' : ' '}] ${i.name}`)
				];
				checklists.set(c.idCard, [...(checklists.get(c.idCard) ?? []), lines.join('\n')]);
			}
			const tasks: TransferTask[] = board
				.cards!.filter((c) => !c.closed && c.name?.trim())
				.map((c) => {
					const done =
						Boolean(c.dueComplete) ||
						/^(done|complete|completed)$/i.test(listNames.get(c.idList) ?? '');
					return {
						title: clampTitle(c.name),
						notes: clampNotes(
							[c.desc ?? '', ...(checklists.get(c.id) ?? [])].filter(Boolean).join('\n\n')
						),
						dueAt: parseDate(c.due),
						labels: splitList((c.labels ?? []).map((l) => l.name || l.color || '').filter(Boolean)),
						projectId: registry.ensure(listNames.get(c.idList) ?? board.name),
						status: done ? 'done' : 'open',
						completedAt: done ? (parseDate(c.due) ?? new Date().toISOString()) : null
					};
				});
			return { data: { projects: registry.projects, tasks }, warnings: [] };
		}
	}
};

import type { Format } from '../types';
import logo from '$lib/assets/logos/notion.svg';
import { columnsOf, csvDetect, guessColumns, parseMapped } from './csv';

export const notion: Format = {
	id: 'notion',
	name: 'Notion',
	tagline: 'Database CSV export',
	extensions: ['.csv'],
	mark: 'N',
	hue: 0,
	container: 'csv',
	logo,
	importer: {
		instructions: [
			'In Notion, open the database page, click the three dots, then "Export" with format "Markdown & CSV". Unzip it and choose the .csv file.',
			"Notion property names vary, so you'll confirm which columns hold the title, status, due date and so on next."
		],
		detect: (text, filename) => csvDetect(text, filename) * 0.9,
		columns: columnsOf,
		guessMapping: guessColumns,
		parse: parseMapped
	}
};

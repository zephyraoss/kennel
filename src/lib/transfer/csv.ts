export const parseCsv = (text: string, delimiter = ','): string[][] => {
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = '';
	let quoted = false;
	let i = 0;
	const source = text.replace(/^\uFEFF/, '');
	while (i < source.length) {
		const char = source[i];
		if (quoted) {
			if (char === '"') {
				if (source[i + 1] === '"') {
					cell += '"';
					i += 2;
					continue;
				}
				quoted = false;
				i++;
				continue;
			}
			cell += char;
			i++;
			continue;
		}
		if (char === '"') {
			quoted = true;
			i++;
			continue;
		}
		if (char === delimiter) {
			row.push(cell);
			cell = '';
			i++;
			continue;
		}
		if (char === '\r' || char === '\n') {
			row.push(cell);
			rows.push(row);
			row = [];
			cell = '';
			if (char === '\r' && source[i + 1] === '\n') i++;
			i++;
			continue;
		}
		cell += char;
		i++;
	}
	if (cell !== '' || row.length) {
		row.push(cell);
		rows.push(row);
	}
	return rows.filter((r) => r.some((c) => c.trim() !== ''));
};

export type CsvTable = { headers: string[]; records: Record<string, string>[] };

export const csvTable = (rows: string[][], headerIndex = 0): CsvTable => {
	const headers = (rows[headerIndex] ?? []).map((h) => h.trim());
	const records = rows
		.slice(headerIndex + 1)
		.map((cells) => Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? '').trim()])));
	return { headers, records };
};

export const detectDelimiter = (text: string) => {
	const firstLine = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? '';
	const counts = [',', ';', '\t'].map((d) => [d, firstLine.split(d).length - 1] as const);
	return counts.sort((a, b) => b[1] - a[1])[0][0];
};

const escapeCell = (value: unknown) => {
	const text = value == null ? '' : String(value);
	return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const toCsv = (rows: unknown[][]) =>
	rows.map((r) => r.map(escapeCell).join(',')).join('\r\n');

export const findHeader = (headers: string[], ...candidates: string[]) => {
	const normalized = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
	for (const candidate of candidates) {
		const index = normalized.indexOf(candidate.toLowerCase().replace(/[^a-z0-9]/g, ''));
		if (index >= 0) return headers[index];
	}
	return undefined;
};

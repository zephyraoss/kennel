import type { Repeat } from './db/schema/tasks';

const DAY_MS = 24 * 60 * 60 * 1000;

const daysInMonth = (year: number, monthIndex: number) =>
	new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

const addMonths = (date: Date, months: number) => {
	const total = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
	const year = Math.floor(total / 12);
	const monthIndex = total - year * 12;
	const day = Math.min(date.getUTCDate(), daysInMonth(year, monthIndex));
	const next = new Date(date);
	next.setUTCFullYear(year, monthIndex, day);
	return next;
};

const occurrence = (anchor: Date, repeat: Repeat, n: number) => {
	const units = repeat.interval * n;
	switch (repeat.every) {
		case 'day':
			return new Date(anchor.getTime() + units * DAY_MS);
		case 'week':
			return new Date(anchor.getTime() + units * 7 * DAY_MS);
		case 'month':
			return addMonths(anchor, units);
	}
};

export const nextOccurrence = (dueAt: Date | null, repeat: Repeat, now: Date) => {
	const anchor = dueAt ?? now;
	let n = 1;
	let next = occurrence(anchor, repeat, n);
	while (next <= now) next = occurrence(anchor, repeat, ++n);
	return next;
};

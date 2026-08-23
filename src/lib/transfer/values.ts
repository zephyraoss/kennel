import type { Repeat, TaskPriority } from '$lib/task-types';

const DAY_MS = 24 * 60 * 60 * 1000;

const compactStamp = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/;

export const parseDate = (value: string | number | null | undefined): string | null => {
	if (value == null || value === '') return null;
	if (typeof value === 'number') return new Date(value < 1e11 ? value * 1000 : value).toISOString();
	const text = value.trim();
	if (!text) return null;
	const compact = compactStamp.exec(text);
	if (compact) {
		const [, y, m, d, hh = '0', mm = '0', ss = '0', z] = compact;
		const date =
			z || !compact[4]
				? new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss))
				: new Date(+y, +m - 1, +d, +hh, +mm, +ss);
		return isNaN(date.getTime()) ? null : date.toISOString();
	}
	if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
		const [y, m, d] = text.split('-').map(Number);
		return new Date(Date.UTC(y, m - 1, d)).toISOString();
	}
	const numeric = Number(text);
	if (!isNaN(numeric) && text.length >= 10) return parseDate(numeric);
	const parsed = Date.parse(text.replace(/(\+\d{2})(\d{2})$/, '$1:$2'));
	if (isNaN(parsed)) return null;
	return (/\b\d{4}\b/.test(text) ? new Date(parsed) : upcoming(new Date(parsed))).toISOString();
};

const upcoming = (date: Date) => {
	const now = new Date();
	const candidate = new Date(date);
	candidate.setFullYear(now.getFullYear());
	if (candidate.getTime() < now.getTime() - 30 * DAY_MS)
		candidate.setFullYear(now.getFullYear() + 1);
	return candidate;
};

export const dateOnly = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '');

export const compactDate = (iso: string | null | undefined) =>
	iso ? iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '') : '';

export const parseBoolean = (value: string | boolean | number | null | undefined) => {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return value !== 0;
	return /^(true|yes|y|1|x|done|completed|complete|checked)$/i.test((value ?? '').trim());
};

export const splitList = (value: string | string[] | null | undefined) =>
	(Array.isArray(value) ? value : (value ?? '').split(/[,;|]/))
		.map((s) => s.trim().replace(/^#/, '').slice(0, 50))
		.filter(Boolean)
		.slice(0, 20);

export const parsePriority = (value: string | number | null | undefined): TaskPriority => {
	if (value == null) return 'none';
	const text = String(value).trim().toLowerCase();
	if (!text) return 'none';
	if (/^(high|urgent|critical|p1|h|1|!!!|⏫|🔺|highest)$/.test(text)) return 'high';
	if (/^(medium|normal|med|p2|m|2|!!|🔼)$/.test(text)) return 'medium';
	if (/^(low|minor|p3|l|3|!|🔽|⏬|lowest)$/.test(text)) return 'low';
	return 'none';
};

export const parseRepeat = (value: string | null | undefined): Repeat | null => {
	if (!value) return null;
	const text = value.trim().toLowerCase();
	if (!text) return null;
	const rrule = /freq=(daily|weekly|monthly)(?:.*interval=(\d+))?/.exec(text);
	if (rrule) {
		const every = rrule[1] === 'daily' ? 'day' : rrule[1] === 'weekly' ? 'week' : 'month';
		return { every, interval: Math.max(1, Number(rrule[2] ?? 1)) };
	}
	if (/^(daily|every ?day|everyday|day)$/.test(text)) return { every: 'day', interval: 1 };
	if (/^(weekly|every ?week|week)$/.test(text)) return { every: 'week', interval: 1 };
	if (/^(monthly|every ?month|month)$/.test(text)) return { every: 'month', interval: 1 };
	if (/^(biweekly|every other week|fortnightly)$/.test(text)) return { every: 'week', interval: 2 };
	if (/^every other day$/.test(text)) return { every: 'day', interval: 2 };
	if (/^every other month$/.test(text)) return { every: 'month', interval: 2 };
	const everyN = /^(?:every )?(\d+) ?(d|day|days|w|wk|week|weeks|m|mo|month|months)$/.exec(text);
	if (everyN) {
		const unit = everyN[2][0] === 'd' ? 'day' : everyN[2][0] === 'w' ? 'week' : 'month';
		return { every: unit, interval: Math.max(1, Number(everyN[1])) };
	}
	if (/^p(\d+)d$/.test(text)) return { every: 'day', interval: Number(/\d+/.exec(text)![0]) };
	if (/^p(\d+)w$/.test(text)) return { every: 'week', interval: Number(/\d+/.exec(text)![0]) };
	if (/^p(\d+)m$/.test(text)) return { every: 'month', interval: Number(/\d+/.exec(text)![0]) };
	if (/^every (mon|tue|wed|thu|fri|sat|sun)/.test(text)) return { every: 'week', interval: 1 };
	if (/^(weekdays|every weekday|every workday)$/.test(text)) return { every: 'day', interval: 1 };
	return null;
};

export const repeatToRrule = (repeat: Repeat | null | undefined) => {
	if (!repeat) return '';
	const freq = repeat.every === 'day' ? 'DAILY' : repeat.every === 'week' ? 'WEEKLY' : 'MONTHLY';
	return `FREQ=${freq};INTERVAL=${repeat.interval}`;
};

export const repeatToText = (repeat: Repeat | null | undefined) => {
	if (!repeat) return '';
	if (repeat.interval === 1) return `every ${repeat.every}`;
	return `every ${repeat.interval} ${repeat.every}s`;
};

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export const parseNaturalDate = (value: string | null | undefined): string | null => {
	if (!value) return null;
	const text = value.trim().toLowerCase();
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	if (text === 'today' || text === 'tod') return today.toISOString();
	if (text === 'tomorrow' || text === 'tom')
		return new Date(today.getTime() + DAY_MS).toISOString();
	if (text === 'yesterday') return new Date(today.getTime() - DAY_MS).toISOString();
	const weekday = WEEKDAYS.findIndex((d) => text === d || text === d.slice(0, 3));
	if (weekday >= 0) {
		const offset = (weekday - today.getDay() + 7) % 7 || 7;
		return new Date(today.getTime() + offset * DAY_MS).toISOString();
	}
	const inDays = /^in (\d+) days?$/.exec(text);
	if (inDays) return new Date(today.getTime() + Number(inDays[1]) * DAY_MS).toISOString();
	const inWeeks = /^in (\d+) weeks?$/.exec(text);
	if (inWeeks) return new Date(today.getTime() + Number(inWeeks[1]) * 7 * DAY_MS).toISOString();
	if (text === 'next week') return new Date(today.getTime() + 7 * DAY_MS).toISOString();
	return parseDate(value);
};

export const parseSchedule = (value: string | null | undefined) => {
	if (!value?.trim()) return { dueAt: null, repeat: null, unsupported: false };
	const text = value.trim();
	const lower = text.toLowerCase();
	const atSplit = lower.split(/\s+at\s+\d/)[0];
	if (/^every|^daily$|^weekly$|^monthly$|^yearly$|^annually$/.test(atSplit)) {
		const repeat = parseRepeat(atSplit.replace(/^every!/, 'every').replace(/\s+starting.*$/, ''));
		const start = /starting (.+)$/.exec(lower);
		const dueAt = start ? parseNaturalDate(start[1]) : null;
		return { dueAt, repeat, unsupported: repeat === null };
	}
	return { dueAt: parseNaturalDate(text), repeat: null, unsupported: false };
};

export const projectRegistry = () => {
	const byName = new Map<string, string>();
	const projects: { id: string; name: string }[] = [];
	const ensure = (name: string | null | undefined) => {
		const trimmed = name?.trim();
		if (!trimmed) return null;
		const key = trimmed.toLowerCase();
		const existing = byName.get(key);
		if (existing) return existing;
		const id = `p${projects.length + 1}`;
		byName.set(key, id);
		projects.push({ id, name: trimmed.slice(0, 100) });
		return id;
	};
	return { ensure, projects };
};

export const clampTitle = (value: string | null | undefined) =>
	(value ?? '').trim().slice(0, 500) || 'Untitled';

export const clampNotes = (value: string | null | undefined) => {
	const trimmed = (value ?? '').trim();
	return trimmed ? trimmed.slice(0, 10_000) : null;
};

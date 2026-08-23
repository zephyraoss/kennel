export const parseStoredScopes = (value: unknown): string[] => {
	if (Array.isArray(value)) return value.map(String);
	if (typeof value !== 'string') return [];
	try {
		return parseStoredScopes(JSON.parse(value));
	} catch {
		return value.split(' ').filter(Boolean);
	}
};

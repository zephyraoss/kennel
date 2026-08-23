import { invalid } from '@sveltejs/kit';
import { form, getRequestEvent } from '$app/server';

type Raw = Record<string, string | undefined>;

export const createApiKey = form('unchecked', async (data: Raw) => {
	const name = (data.name ?? '').trim();
	if (!name) invalid('Name is required');
	const { locals, request } = getRequestEvent();
	const created = await locals.auth.api.createApiKey({
		headers: request.headers,
		body: { name }
	});
	return { createdKey: created.key, createdName: name };
});

export const deleteApiKey = form('unchecked', async (data: Raw) => {
	const { locals, request } = getRequestEvent();
	await locals.auth.api.deleteApiKey({
		headers: request.headers,
		body: { keyId: data.id ?? '' }
	});
});

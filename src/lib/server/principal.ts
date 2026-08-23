import { and, eq, gt, isNull } from 'drizzle-orm';
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from 'jose';
import { API_KEY_PREFIX, TASK_SCOPES, tokenAudience, type Auth } from './auth';
import type { Database } from './db';
import { oauthAccessToken } from './db/schema/auth';
import { parseStoredScopes } from './oauth-scopes';

export type Scope = (typeof TASK_SCOPES)[number];

export type Principal = {
	userId: string;
	scopes: ReadonlySet<Scope>;
	via: 'api-key' | 'oauth';
};

export type PrincipalFailure = { reason: 'missing' | 'invalid' };

const allScopes = new Set<Scope>(TASK_SCOPES);

const bearerToken = (request: Request) => {
	const header = request.headers.get('authorization') ?? '';
	const [scheme, token] = header.split(' ');
	if (scheme?.toLowerCase() === 'bearer' && token) return token;
	return request.headers.get('x-api-key') ?? null;
};

const taskScopes = (granted: Iterable<string>) =>
	new Set([...granted].filter((s): s is Scope => allScopes.has(s as Scope)));

const looksLikeJwt = (token: string) => token.split('.').length === 3;

const sha256Base64Url = async (value: string) => {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return btoa(String.fromCharCode(...new Uint8Array(digest)))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/, '');
};

const fromApiKey = async (auth: Auth, key: string): Promise<Principal | null> => {
	const result = await auth.api.verifyApiKey({ body: { key } });
	if (!result.valid || !result.key) return null;
	return { userId: result.key.referenceId, scopes: allScopes, via: 'api-key' };
};

const fromJwt = async (auth: Auth, token: string): Promise<Principal | null> => {
	const { baseURL } = await auth.$context;
	const jwks = createLocalJWKSet((await auth.api.getJwks()) as JSONWebKeySet);
	try {
		const { payload } = await jwtVerify(token, jwks, {
			issuer: baseURL,
			audience: tokenAudience(baseURL)
		});
		if (!payload.sub) return null;
		return {
			userId: payload.sub,
			scopes: taskScopes(String(payload.scope ?? '').split(' ')),
			via: 'oauth'
		};
	} catch {
		return null;
	}
};

const fromOpaqueToken = async (db: Database, token: string): Promise<Principal | null> => {
	const [row] = await db
		.select({ userId: oauthAccessToken.userId, scopes: oauthAccessToken.scopes })
		.from(oauthAccessToken)
		.where(
			and(
				eq(oauthAccessToken.token, await sha256Base64Url(token)),
				isNull(oauthAccessToken.revoked),
				gt(oauthAccessToken.expiresAt, new Date())
			)
		)
		.limit(1);
	if (!row?.userId) return null;
	return { userId: row.userId, scopes: taskScopes(parseStoredScopes(row.scopes)), via: 'oauth' };
};

export const resolvePrincipal = async (
	auth: Auth,
	db: Database,
	request: Request
): Promise<Principal | PrincipalFailure> => {
	const token = bearerToken(request);
	if (!token) return { reason: 'missing' };
	const principal = token.startsWith(API_KEY_PREFIX)
		? await fromApiKey(auth, token)
		: looksLikeJwt(token)
			? await fromJwt(auth, token)
			: await fromOpaqueToken(db, token);
	return principal ?? { reason: 'invalid' };
};

export const isPrincipal = (value: Principal | PrincipalFailure): value is Principal =>
	'userId' in value;

export const protectedResourceMetadataUrl = (baseURL: string) =>
	`${new URL(baseURL).origin}/.well-known/oauth-protected-resource/mcp`;

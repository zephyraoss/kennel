import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { corePlugins } from './src/lib/server/auth-plugins';

const emptyResult = { results: [], success: true, meta: {} };

const stubD1 = {
	prepare: () => ({
		bind: () => ({
			all: async () => emptyResult,
			run: async () => emptyResult,
			first: async () => null,
			raw: async () => []
		})
	})
} as unknown as D1Database;

const oauthResource = sqliteTable('oauth_resource', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	name: text('name'),
	accessTokenTtl: integer('access_token_ttl'),
	refreshTokenTtl: integer('refresh_token_ttl'),
	signingAlgorithm: text('signing_algorithm'),
	signingKeyId: text('signing_key_id'),
	allowedScopes: text('allowed_scopes'),
	customClaims: text('custom_claims'),
	dpopBoundAccessTokensRequired: integer('dpop_bound_access_tokens_required', { mode: 'boolean' }),
	disabled: integer('disabled', { mode: 'boolean' }),
	policyVersion: integer('policy_version'),
	metadata: text('metadata'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
});

export const auth = betterAuth({
	baseURL: 'http://localhost:5173',
	database: drizzleAdapter(drizzle(stubD1, { schema: { oauthResource } }), {
		provider: 'sqlite',
		schema: { oauthResource }
	}),
	socialProviders: { github: { clientId: 'x', clientSecret: 'x' } },
	plugins: corePlugins('http://localhost:5173')
});

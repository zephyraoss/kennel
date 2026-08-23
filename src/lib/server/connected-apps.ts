import { and, eq } from 'drizzle-orm';
import type { Database } from './db';
import { oauthAccessToken, oauthClient, oauthConsent, oauthRefreshToken } from './db/schema/auth';
import { parseStoredScopes } from './oauth-scopes';

export const createConnectedAppsService = (db: Database, userId: string) => {
	const list = async () => {
		const rows = await db
			.select({
				id: oauthConsent.id,
				clientId: oauthConsent.clientId,
				scopes: oauthConsent.scopes,
				createdAt: oauthConsent.createdAt,
				updatedAt: oauthConsent.updatedAt,
				name: oauthClient.name,
				clientUri: oauthClient.uri,
				ownerId: oauthClient.userId
			})
			.from(oauthConsent)
			.leftJoin(oauthClient, eq(oauthClient.clientId, oauthConsent.clientId))
			.where(eq(oauthConsent.userId, userId));
		return rows.map((r) => ({
			id: r.id,
			clientId: r.clientId,
			name: r.name ?? r.clientId,
			clientUri: r.clientUri ?? null,
			ownedByMe: r.ownerId === userId,
			scopes: parseStoredScopes(r.scopes).filter((s) => s.startsWith('tasks:')),
			authorizedAt: r.createdAt.toISOString(),
			lastUsedAt: r.updatedAt.toISOString()
		}));
	};

	const revoke = async (consentId: string) => {
		const [consent] = await db
			.select({ clientId: oauthConsent.clientId })
			.from(oauthConsent)
			.where(and(eq(oauthConsent.id, consentId), eq(oauthConsent.userId, userId)))
			.limit(1);
		if (!consent?.clientId) return false;
		const mine = (table: typeof oauthRefreshToken | typeof oauthAccessToken) =>
			and(eq(table.userId, userId), eq(table.clientId, consent.clientId));
		await db.delete(oauthRefreshToken).where(mine(oauthRefreshToken));
		await db.delete(oauthAccessToken).where(mine(oauthAccessToken));
		await db.delete(oauthConsent).where(eq(oauthConsent.id, consentId));
		return true;
	};

	return { list, revoke };
};

export type ConnectedApp = Awaited<
	ReturnType<ReturnType<typeof createConnectedAppsService>['list']>
>[number];

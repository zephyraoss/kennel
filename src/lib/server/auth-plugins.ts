import { jwt } from 'better-auth/plugins';
import { apiKey } from '@better-auth/api-key';
import { mcp } from '@better-auth/mcp';
import { oauthDeviceAuthorization } from '@better-auth/oauth-provider';

export const API_KEY_PREFIX = 'kn_';
export const TASK_SCOPES = ['tasks:read', 'tasks:write'] as const;
export const OAUTH_SCOPES = ['openid', 'profile', 'email', 'offline_access', ...TASK_SCOPES];

export const resourceUrls = (baseURL: string) => {
	const origin = new URL(baseURL).origin;
	return { mcp: `${origin}/mcp`, api: `${origin}/api/v1` };
};

export const tokenAudience = (baseURL: string) => resourceUrls(baseURL).mcp;

export const corePlugins = (baseURL: string) => {
	const resources = resourceUrls(baseURL);
	return [
		jwt(),
		apiKey({
			defaultPrefix: API_KEY_PREFIX,
			requireName: true,
			enableMetadata: false,
			rateLimit: { enabled: false }
		}),
		mcp({
			loginPage: '/login',
			consentPage: '/consent',
			resource: resources.mcp,
			scopes: OAUTH_SCOPES,
			allowDynamicClientRegistration: true,
			allowUnauthenticatedClientRegistration: true
		}),
		oauthDeviceAuthorization({ verificationUri: '/device' })
	];
};

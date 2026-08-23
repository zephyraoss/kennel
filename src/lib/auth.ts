import { createAuthClient } from 'better-auth/svelte';
import { apiKeyClient } from '@better-auth/api-key/client';
import { oauthProviderClient } from '@better-auth/oauth-provider/client';
import { deviceAuthorizationClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
	plugins: [apiKeyClient(), oauthProviderClient(), deviceAuthorizationClient()]
});

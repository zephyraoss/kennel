import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

const buildId = () => {
	const today = new Date().toISOString().slice(0, 10);
	const commitsToday = Number(
		execSync(`git rev-list --count --since=${today}T00:00:00Z HEAD`).toString().trim()
	);
	return `${today.replaceAll('-', '')}.${String(Math.max(commitsToday, 1)).padStart(2, '0')}`;
};

export default defineConfig({
	define: { __BUILD_ID__: JSON.stringify(buildId()) },
	build: { rollupOptions: { external: (id) => id.endsWith('.wasm') } },
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ config: 'wrangler.kit.jsonc' }),
			csrf: { checkOrigin: false }
		})
	]
});

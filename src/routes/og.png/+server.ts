import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import { render } from 'svelte/server';
import satori, { init as initSatori } from 'satori/standalone';
import { html } from 'satori-html';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import OgImage from '$lib/components/og-image.svelte';
import resvgWasmUrl from '@resvg/resvg-wasm/index_bg.wasm?url';
import yogaWasmUrl from 'satori/yoga.wasm?url';
import interRegularUrl from '@fontsource/inter/files/inter-latin-400-normal.woff?url';
import interSemiboldUrl from '@fontsource/inter/files/inter-latin-600-normal.woff?url';

const width = 1200;
const height = 630;

type Loader = (path: string) => Promise<ArrayBuffer>;

let wasmReady: Promise<void> | null = null;

const loadWasmModules = (load: Loader) =>
	dev
		? Promise.all([
				load(resvgWasmUrl).then((bytes) => WebAssembly.compile(bytes)),
				load(yogaWasmUrl).then((bytes) => WebAssembly.compile(bytes))
			])
		: Promise.all([
				import('@resvg/resvg-wasm/index_bg.wasm').then((wasm) => wasm.default),
				import('satori/yoga.wasm').then((wasm) => wasm.default)
			]);

const ensureWasm = (load: Loader) => {
	wasmReady ??= loadWasmModules(load)
		.then(([resvg, yoga]) => Promise.all([initWasm(resvg), initSatori(yoga)]))
		.then(() => undefined)
		.catch((cause) => {
			wasmReady = null;
			throw cause;
		});
	return wasmReady;
};

const assetLoader = (fetcher: typeof fetch, origin: string): Loader =>
	function load(path) {
		return fetcher(new URL(path, origin)).then((response) => response.arrayBuffer());
	};

export const GET: RequestHandler = async ({ url, platform }) => {
	const assets = dev ? null : platform?.env.ASSETS;
	if (!dev && !assets) error(500, 'ASSETS binding unavailable');
	const load = assetLoader(assets ? assets.fetch.bind(assets) : fetch, url.origin);

	const title = url.searchParams.get('title') ?? 'A task list for apps and agents';
	const subtitle =
		url.searchParams.get('subtitle') ?? 'Dashboard, REST API, and a remote MCP server.';

	const [, regular, semibold] = await Promise.all([
		ensureWasm(load),
		load(interRegularUrl),
		load(interSemiboldUrl)
	]);

	const { body } = render(OgImage, { props: { title, subtitle } });
	const svg = await satori(html(body), {
		width,
		height,
		fonts: [
			{ name: 'Inter', data: regular, weight: 400, style: 'normal' },
			{ name: 'Inter', data: semibold, weight: 600, style: 'normal' }
		]
	});
	const png = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();

	return new Response(new Uint8Array(png), {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=86400, s-maxage=604800'
		}
	});
};

/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;
const cacheName = `kennel-${version}`;
const precached = [...build, ...files];

const precache = async () => {
	const cache = await caches.open(cacheName);
	await cache.addAll(precached);
};

const evictStaleCaches = async () => {
	const names = await caches.keys();
	await Promise.all(names.filter((name) => name !== cacheName).map((name) => caches.delete(name)));
};

const isPrecached = (url: URL) => precached.includes(url.pathname);

const isCacheableRequest = (request: Request, url: URL) =>
	request.method === 'GET' && url.origin === location.origin && !url.pathname.startsWith('/api/');

const cacheFirst = async (request: Request) => {
	const cached = await caches.match(request);
	return cached ?? fetch(request);
};

const networkFirst = async (request: Request) => {
	const cache = await caches.open(cacheName);
	try {
		const response = await fetch(request);
		if (response.ok) cache.put(request, response.clone());
		return response;
	} catch (cause) {
		const cached = await cache.match(request);
		if (cached) return cached;
		throw cause;
	}
};

worker.addEventListener('install', (event) => {
	event.waitUntil(precache().then(() => worker.skipWaiting()));
});

worker.addEventListener('activate', (event) => {
	event.waitUntil(evictStaleCaches().then(() => worker.clients.claim()));
});

worker.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (!isCacheableRequest(event.request, url)) return;
	if (isPrecached(url)) {
		event.respondWith(cacheFirst(event.request));
		return;
	}
	if (event.request.mode === 'navigate') {
		event.respondWith(networkFirst(event.request));
	}
});

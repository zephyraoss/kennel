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

type PushPayload = { title?: string; body?: string; url?: string; tag?: string };

const readPayload = (data: PushMessageData | null): PushPayload => {
	try {
		return data?.json() ?? {};
	} catch {
		return { body: data?.text() };
	}
};

const showPush = (payload: PushPayload) =>
	worker.registration.showNotification(payload.title ?? 'kennel', {
		body: payload.body,
		icon: '/icon-192.png',
		badge: '/icon-192.png',
		tag: payload.tag ?? 'kennel',
		data: { url: payload.url ?? '/app' }
	});

const focusOrOpen = async (url: string) => {
	const target = new URL(url, location.origin).href;
	const windows = await worker.clients.matchAll({ type: 'window', includeUncontrolled: true });
	const existing = windows.find((client) => client.url.startsWith(location.origin));
	if (!existing) return worker.clients.openWindow(target);
	await existing.focus();
	return existing.navigate(target);
};

const resubscribe = async (event: Event) => {
	const { oldSubscription } = event as Event & { oldSubscription: PushSubscription | null };
	const applicationServerKey = oldSubscription?.options.applicationServerKey;
	if (!applicationServerKey) return;
	const subscription = await worker.registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey
	});
	await fetch('/app/push', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(subscription.toJSON())
	});
};

worker.addEventListener('push', (event) => {
	event.waitUntil(showPush(readPayload(event.data)));
});

worker.addEventListener('notificationclick', (event) => {
	event.notification.close();
	event.waitUntil(focusOrOpen(event.notification.data?.url ?? '/app'));
});

worker.addEventListener('pushsubscriptionchange', (event) => {
	(event as ExtendableEvent).waitUntil(resubscribe(event));
});

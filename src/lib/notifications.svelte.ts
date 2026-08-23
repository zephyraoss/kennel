import { browser } from '$app/environment';

const SUBSCRIBE_URL = '/app/push';

const supported = () =>
	browser && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

const decodeKey = (base64url: string) => {
	const padded = base64url.padEnd(base64url.length + ((4 - (base64url.length % 4)) % 4), '=');
	const binary = atob(padded.replaceAll('-', '+').replaceAll('_', '/'));
	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const send = (method: 'POST' | 'DELETE', body: unknown) =>
	fetch(SUBSCRIBE_URL, {
		method,
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});

const createNotifications = () => {
	let enabled = $state(false);
	let ready = $state(false);
	let permission = $state<NotificationPermission>(supported() ? Notification.permission : 'denied');

	const currentSubscription = async () => {
		const registration = await navigator.serviceWorker.ready;
		return registration.pushManager.getSubscription();
	};

	const refresh = async () => {
		if (!supported()) return;
		enabled = (await currentSubscription()) !== null;
		ready = true;
	};

	const enable = async (vapidPublicKey: string) => {
		if (!supported()) return false;
		permission = await Notification.requestPermission();
		if (permission !== 'granted') return false;
		const registration = await navigator.serviceWorker.ready;
		const subscription = await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: decodeKey(vapidPublicKey)
		});
		const response = await send('POST', subscription.toJSON());
		if (!response.ok) {
			await subscription.unsubscribe();
			return false;
		}
		enabled = true;
		return true;
	};

	const disable = async () => {
		const subscription = await currentSubscription();
		if (subscription) {
			await send('DELETE', { endpoint: subscription.endpoint });
			await subscription.unsubscribe();
		}
		enabled = false;
	};

	return {
		get supported() {
			return supported();
		},
		get enabled() {
			return enabled;
		},
		get ready() {
			return ready;
		},
		get permission() {
			return permission;
		},
		refresh,
		enable,
		disable
	};
};

export const notifications = createNotifications();

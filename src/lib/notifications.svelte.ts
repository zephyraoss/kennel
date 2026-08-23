import { browser } from '$app/environment';

const PREFERENCE_KEY = 'kennel:notifications';
const NOTIFIED_KEY = 'kennel:notified';

export type DueTask = { id: string; title: string; dueAt: string };

const supported = () => browser && 'Notification' in window && 'serviceWorker' in navigator;

const readPreference = () => browser && localStorage.getItem(PREFERENCE_KEY) === 'on';

const createNotifications = () => {
	let enabled = $state(readPreference());
	let permission = $state<NotificationPermission>(supported() ? Notification.permission : 'denied');

	const enable = async () => {
		if (!supported()) return false;
		permission = await Notification.requestPermission();
		enabled = permission === 'granted';
		localStorage.setItem(PREFERENCE_KEY, enabled ? 'on' : 'off');
		return enabled;
	};

	const disable = () => {
		enabled = false;
		if (browser) localStorage.setItem(PREFERENCE_KEY, 'off');
	};

	const alreadyNotified = (): Record<string, string> => {
		try {
			return JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? '{}');
		} catch {
			return {};
		}
	};

	const remind = async (tasks: DueTask[]) => {
		if (!enabled || permission !== 'granted' || tasks.length === 0) return;
		const today = new Date().toDateString();
		const notified = alreadyNotified();
		const pending = tasks.filter((t) => notified[t.id] !== today);
		if (pending.length === 0) return;
		const registration = await navigator.serviceWorker.ready;
		const title = pending.length === 1 ? pending[0].title : `${pending.length} tasks due`;
		const body =
			pending.length === 1
				? `Due ${new Date(pending[0].dueAt).toLocaleDateString()}`
				: pending.map((t) => t.title).join(', ');
		await registration.showNotification(title, {
			body,
			icon: '/icon-192.png',
			badge: '/icon-192.png',
			tag: 'kennel-due'
		});
		const kept = Object.fromEntries(tasks.map((t) => [t.id, notified[t.id] ?? today]));
		for (const t of pending) kept[t.id] = today;
		localStorage.setItem(NOTIFIED_KEY, JSON.stringify(kept));
	};

	return {
		get supported() {
			return supported();
		},
		get enabled() {
			return enabled;
		},
		get permission() {
			return permission;
		},
		enable,
		disable,
		remind
	};
};

export const notifications = createNotifications();

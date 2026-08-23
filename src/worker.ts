import kit from 'kennel:kit-worker';
import { getDrizzle } from './lib/server/db';
import { sendDueReminders } from './lib/server/reminders';

const runReminders = async (env: Env) => {
	const result = await sendDueReminders(getDrizzle(env.D1), env);
	console.log(`reminders: ${result.notifications} notifications to ${result.users} users`);
};

export default {
	fetch: kit.fetch,
	scheduled: (_controller, env, ctx) => ctx.waitUntil(runReminders(env))
} satisfies ExportedHandler<Env>;

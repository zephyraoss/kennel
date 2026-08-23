declare module 'kennel:kit-worker' {
	const handler: { fetch: ExportedHandlerFetchHandler<Env> };
	export default handler;
}

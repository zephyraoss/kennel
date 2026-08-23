import type { RequestHandler } from './$types';

const publicPaths = ['/', '/docs'];

export const GET: RequestHandler = ({ url }) => {
	const entries = publicPaths
		.map((path) => `  <url><loc>${url.origin}${path}</loc></url>`)
		.join('\n');
	const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};

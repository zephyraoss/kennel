<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<svelte:head>
	<title>kennel docs</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-6 py-8">
	<header class="mb-8 flex items-center justify-between text-sm">
		<a href={resolve('/')} class="font-semibold">kennel</a>
		<a
			href={data.user ? resolve('/app') : resolve('/login')}
			class="text-muted-foreground hover:text-foreground"
		>
			{data.user ? 'Dashboard' : 'Sign in'}
		</a>
	</header>

	<article
		class="prose prose-sm max-w-none prose-headings:font-semibold prose-pre:bg-muted prose-pre:text-foreground"
	>
		<h1>Docs</h1>
		<p>
			kennel is a simple task list. You can use it from a REST API, a remote MCP server, or the
			dashboard. Every request needs either an API key or an OAuth access token.
		</p>

		<h2>Endpoints</h2>
		<table>
			<tbody>
				<tr><td>REST</td><td><code>{data.urls.api}</code></td></tr>
				<tr><td>MCP</td><td><code>{data.urls.mcp}</code></td></tr>
				<tr><td>OAuth issuer</td><td><code>{data.issuer}</code></td></tr>
			</tbody>
		</table>

		<h2>API keys</h2>
		<p>
			Create a key under <a href={resolve('/app/keys')}>API keys</a>. Keys start with
			<code>kn_</code>, are shown once, and have full read and write access to your tasks. Send it
			as a bearer token:
		</p>
		<pre><code
				>curl {data.urls.api}/tasks \
  -H "Authorization: Bearer kn_..."</code
			></pre>

		<h2>OAuth</h2>
		<p>
			Register a client under <a href={resolve('/app/oauth')}>OAuth</a>, or have your MCP client
			register itself through dynamic client registration. The flow is authorization code with PKCE.
			Scopes:
		</p>
		<ul>
			<li><code>tasks:read</code> to list and read tasks and projects</li>
			<li><code>tasks:write</code> to create, update, complete, and delete them</li>
		</ul>
		<p>Discovery metadata:</p>
		<ul>
			<li>
				<code
					>{data.urls.api.replace(
						'/api/v1',
						''
					)}/.well-known/oauth-authorization-server/api/auth</code
				>
			</li>
			<li>
				<code>{data.urls.api.replace('/api/v1', '')}/.well-known/oauth-protected-resource/mcp</code>
			</li>
		</ul>
		<p>
			Access tokens are JWTs and go in the <code>Authorization: Bearer</code> header, same as keys.
			You can see and revoke every app you've authorized under
			<a href={resolve('/app/oauth')}>OAuth</a>.
		</p>

		<h2>REST</h2>
		<table>
			<thead><tr><th>Method</th><th>Path</th><th>Scope</th></tr></thead>
			<tbody>
				<tr><td>GET</td><td><code>/tasks</code></td><td>tasks:read</td></tr>
				<tr><td>POST</td><td><code>/tasks</code></td><td>tasks:write</td></tr>
				<tr><td>GET</td><td><code>/tasks/:id</code></td><td>tasks:read</td></tr>
				<tr><td>PATCH</td><td><code>/tasks/:id</code></td><td>tasks:write</td></tr>
				<tr><td>DELETE</td><td><code>/tasks/:id</code></td><td>tasks:write</td></tr>
				<tr><td>GET</td><td><code>/projects</code></td><td>tasks:read</td></tr>
				<tr><td>POST</td><td><code>/projects</code></td><td>tasks:write</td></tr>
				<tr><td>GET</td><td><code>/projects/:id</code></td><td>tasks:read</td></tr>
				<tr><td>PATCH</td><td><code>/projects/:id</code></td><td>tasks:write</td></tr>
				<tr><td>DELETE</td><td><code>/projects/:id</code></td><td>tasks:write</td></tr>
			</tbody>
		</table>
		<p>
			<code>GET /tasks</code> accepts <code>status</code> (<code>open</code> or <code>done</code>),
			<code>projectId</code>, and <code>label</code> query params.
		</p>
		<p>A task looks like this:</p>
		<pre><code
				>{`{
  "id": "…",
  "title": "Walk the dog",
  "notes": null,
  "labels": ["home"],
  "projectId": null,
  "status": "open",
  "priority": "medium",
  "dueAt": "2026-08-30T00:00:00.000Z",
  "completedAt": null,
  "createdAt": "…",
  "updatedAt": "…"
}`}</code
			></pre>
		<table>
			<thead><tr><th>Field</th><th>Type</th><th>Notes</th></tr></thead>
			<tbody>
				<tr><td><code>title</code></td><td>string</td><td>Required on <code>POST</code></td></tr>
				<tr><td><code>notes</code></td><td>string or null</td><td></td></tr>
				<tr
					><td><code>priority</code></td><td
						><code>none</code> · <code>low</code> · <code>medium</code> · <code>high</code></td
					><td>Defaults to <code>none</code></td></tr
				>
				<tr><td><code>dueAt</code></td><td>ISO 8601 datetime or null</td><td></td></tr>
				<tr><td><code>labels</code></td><td>string[]</td><td></td></tr>
				<tr
					><td><code>projectId</code></td><td>string or null</td><td>Must be an existing project</td
					></tr
				>
				<tr><td><code>status</code></td><td><code>open</code> · <code>done</code></td><td></td></tr>
			</tbody>
		</table>
		<p>
			On <code>PATCH</code> every field is optional and anything you leave out stays unchanged.
		</p>
		<p>Errors come back with a non-2xx status and this body:</p>
		<pre><code>{`{ "error": { "code": "validation_error", "message": "title: Too small" } }`}</code
			></pre>

		<h2>MCP</h2>
		<p>
			Point any MCP client at <code>{data.urls.mcp}</code>. It speaks Streamable HTTP. Without a
			token it answers with a <code>WWW-Authenticate</code> challenge so clients that support OAuth discover
			the login flow on their own. For clients that only take a static header, use an API key.
		</p>
		<p>Tools:</p>
		<ul>
			<li>
				<code>list_tasks</code>, <code>get_task</code>, <code>create_task</code>,
				<code>update_task</code>, <code>complete_task</code>, <code>delete_task</code>
			</li>
			<li><code>list_projects</code>, <code>create_project</code>, <code>delete_project</code></li>
		</ul>
		<p>Example config for a client that takes a JSON server entry:</p>
		<pre><code
				>{`{
  "mcpServers": {
    "kennel": {
      "url": "${data.urls.mcp}",
      "headers": { "Authorization": "Bearer kn_..." }
    }
  }
}`}</code
			></pre>
	</article>
</main>

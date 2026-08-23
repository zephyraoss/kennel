<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import CheckIcon from '@lucide/svelte/icons/check';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import {
		FIELDS,
		acceptFor,
		detectFormat,
		entriesFor,
		exportFormats,
		importFormats,
		type Card,
		type ColumnMapping,
		type Entry,
		type Field,
		type Format,
		type TransferData
	} from '$lib/transfer';

	let { mode, open = $bindable(false) }: { mode: 'import' | 'export'; open?: boolean } = $props();

	type Step = 'format' | 'file' | 'mapping' | 'review' | 'progress' | 'done';

	const BATCH_SIZE = 200;

	const FIELD_LABELS: Record<Field, string> = {
		title: 'Title',
		notes: 'Notes',
		status: 'Status / done',
		priority: 'Priority',
		dueAt: 'Due date',
		repeat: 'Repeat',
		labels: 'Labels / tags',
		project: 'Project / list',
		completedAt: 'Completed at',
		createdAt: 'Created at'
	};

	const selectClass =
		'h-9 w-full min-w-0 rounded-md border bg-background px-2 text-base sm:text-sm';

	let step = $state<Step>('format');
	let format = $state<Format | null>(null);
	let container = $state<Extract<Entry, { kind: 'container' }> | null>(null);
	let file = $state<{ name: string; text: string } | null>(null);
	let suggestion = $state<Format | null>(null);
	let columns = $state<string[]>([]);
	let mapping = $state<ColumnMapping>({});
	let parsed = $state<{ data: TransferData; warnings: string[] } | null>(null);
	let includeCompleted = $state(true);
	let error = $state<string | null>(null);
	let dragging = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);

	let progress = $state({ phase: '', done: 0, total: 0 });
	let result = $state<{ tasks: number; projects: number; skipped: number } | null>(null);
	let download = $state<{ url: string; filename: string; link?: string; count: number } | null>(
		null
	);
	let controller: AbortController | null = null;

	const formats = $derived(mode === 'import' ? importFormats() : exportFormats());
	const entries = $derived(entriesFor(formats));

	const steps = $derived<{ id: Step; label: string }[]>(
		mode === 'import'
			? [
					{ id: 'format', label: 'Source' },
					{ id: 'file', label: 'File' },
					...(format?.importer?.columns ? [{ id: 'mapping' as Step, label: 'Columns' }] : []),
					{ id: 'review', label: 'Review' },
					{ id: 'progress', label: 'Import' }
				]
			: [
					{ id: 'format', label: 'Destination' },
					{ id: 'review', label: 'Options' },
					{ id: 'progress', label: 'Export' }
				]
	);

	const stepIndex = $derived(
		Math.max(
			0,
			steps.findIndex((s) => s.id === (step === 'done' ? 'progress' : step))
		)
	);

	const selectedTasks = $derived(
		parsed ? parsed.data.tasks.filter((t) => includeCompleted || t.status !== 'done') : []
	);

	const completedCount = $derived(
		parsed?.data.tasks.filter((t) => t.status === 'done').length ?? 0
	);

	const percent = $derived(progress.total ? Math.round((progress.done / progress.total) * 100) : 0);

	const reset = () => {
		controller?.abort();
		controller = null;
		step = 'format';
		format = null;
		container = null;
		file = null;
		suggestion = null;
		columns = [];
		mapping = {};
		parsed = null;
		includeCompleted = true;
		error = null;
		result = null;
		if (download) URL.revokeObjectURL(download.url);
		download = null;
		progress = { phase: '', done: 0, total: 0 };
	};

	$effect(() => {
		if (!open) reset();
	});

	const markStyle = (f: Card) =>
		`background: oklch(0.93 0.05 ${f.hue}); color: oklch(0.4 0.12 ${f.hue});`;

	const choose = (f: Format) => {
		format = f;
		error = null;
		step = mode === 'import' ? 'file' : 'review';
	};

	const back = () => {
		error = null;
		if (step === 'file') {
			file = null;
			step = 'format';
		} else if (step === 'mapping') step = 'file';
		else if (step === 'review') {
			parsed = null;
			step = mode === 'import' ? (format?.importer?.columns ? 'mapping' : 'file') : 'format';
		}
	};

	const parse = () => {
		if (!format?.importer || !file) return;
		try {
			parsed = format.importer.parse(file.text, { filename: file.name, mapping });
			if (!parsed.data.tasks.length) {
				error = 'No tasks were found in that file.';
				parsed = null;
				return;
			}
			error = null;
			step = 'review';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'That file could not be read.';
		}
	};

	const loadFile = async (chosen: File | undefined) => {
		if (!chosen || !format?.importer) return;
		error = null;
		suggestion = null;
		if (chosen.size > 25 * 1024 * 1024) {
			error = 'That file is larger than 25 MB.';
			return;
		}
		const text = await chosen.text();
		file = { name: chosen.name, text };
		const ownScore = format.importer.detect(text, chosen.name.toLowerCase());
		const best = detectFormat(text, chosen.name);
		if (best && best.format.id !== format.id && best.score > ownScore) suggestion = best.format;
		if (format.importer.columns) {
			try {
				columns = format.importer.columns(text);
				mapping = format.importer.guessMapping?.(columns) ?? {};
				step = 'mapping';
			} catch (cause) {
				error = cause instanceof Error ? cause.message : 'That file could not be read.';
			}
			return;
		}
		if (ownScore === 0 && suggestion) return;
		parse();
	};

	const switchTo = (f: Format) => {
		format = f;
		suggestion = null;
		if (file) loadFile(new File([file.text], file.name));
	};

	const onDrop = (event: DragEvent) => {
		event.preventDefault();
		dragging = false;
		loadFile(event.dataTransfer?.files[0]);
	};

	type ImportResponse = { mapping?: Record<string, string>; created?: number; imported?: number };

	const post = async (body: unknown, signal: AbortSignal): Promise<ImportResponse> => {
		const response = await fetch(resolve('/app/settings/import'), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body),
			signal
		});
		if (!response.ok) {
			const detail = (await response.json().catch(() => null)) as { error?: string } | null;
			throw new Error(detail?.error ?? `Import failed (${response.status})`);
		}
		return response.json();
	};

	const runImport = async () => {
		if (!parsed) return;
		step = 'progress';
		error = null;
		controller = new AbortController();
		const { signal } = controller;
		const tasks = selectedTasks;
		const usedProjects = new Set(tasks.map((t) => t.projectId).filter(Boolean));
		const projects = parsed.data.projects.filter((p) => usedProjects.has(p.id));
		progress = { phase: 'Creating projects', done: 0, total: tasks.length };
		try {
			let mapping: Record<string, string> = {};
			let createdProjects = 0;
			if (projects.length) {
				const response = await post({ projects }, signal);
				mapping = response.mapping ?? {};
				createdProjects = response.created ?? 0;
			}
			const rows = tasks.map((t) => ({
				...t,
				projectId: t.projectId ? (mapping[t.projectId] ?? null) : null
			}));
			let imported = 0;
			for (let i = 0; i < rows.length; i += BATCH_SIZE) {
				progress = { phase: 'Importing tasks', done: imported, total: rows.length };
				const batch = rows.slice(i, i + BATCH_SIZE);
				const response = await post({ tasks: batch }, signal);
				imported += response.imported ?? batch.length;
			}
			progress = { phase: 'Finished', done: imported, total: rows.length };
			result = {
				tasks: imported,
				projects: createdProjects,
				skipped: parsed.data.tasks.length - tasks.length
			};
			step = 'done';
			await invalidateAll();
		} catch (cause) {
			if (signal.aborted) return;
			error = cause instanceof Error ? cause.message : 'Import failed.';
			result = { tasks: progress.done, projects: 0, skipped: 0 };
			step = 'done';
			await invalidateAll();
		}
	};

	const triggerDownload = () => {
		if (!download) return;
		const anchor = document.createElement('a');
		anchor.href = download.url;
		anchor.download = download.filename;
		anchor.click();
	};

	const runExport = async () => {
		if (!format?.exporter) return;
		step = 'progress';
		error = null;
		progress = { phase: 'Fetching your tasks', done: 0, total: 0 };
		try {
			const response = await fetch(resolve('/app/settings/export'));
			if (!response.ok) throw new Error(`Export failed (${response.status})`);
			const data = (await response.json()) as TransferData;
			const tasks = data.tasks.filter((t) => includeCompleted || t.status !== 'done');
			progress = { phase: `Converting ${tasks.length} tasks`, done: 0, total: tasks.length };
			const stamp = new Date().toISOString().slice(0, 10);
			const exported = format.exporter.serialize({ projects: data.projects, tasks }, stamp);
			const blob = new Blob([exported.content], { type: exported.mime });
			download = {
				url: URL.createObjectURL(blob),
				filename: exported.filename,
				link: exported.link,
				count: tasks.length
			};
			progress = { phase: 'Ready', done: tasks.length, total: tasks.length };
			triggerDownload();
			step = 'done';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Export failed.';
			step = 'done';
		}
	};

	const cancel = () => {
		controller?.abort();
		open = false;
	};
</script>

{#snippet card(entry: Card, select: () => void)}
	<button
		type="button"
		onclick={select}
		class="group/card relative flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none {entry
			.apps?.length
			? 'pb-8'
			: ''}"
	>
		<span
			class="flex size-8 items-center justify-center rounded-md text-xs font-semibold"
			style={markStyle(entry)}
			aria-hidden="true"
		>
			{#if entry.logo}
				<img src={entry.logo} alt="" class="size-5" />
			{:else}
				{entry.mark}
			{/if}
		</span>
		<span class="flex flex-col">
			<span class="font-medium">{entry.name}</span>
			<span class="text-xs text-muted-foreground">{entry.tagline}</span>
		</span>
		{#if entry.apps?.length}
			<span
				class="absolute right-2 bottom-2 flex"
				aria-label="Used by {entry.apps.map((a) => a.name).join(', ')}"
			>
				{#each entry.apps as app, i (app.name)}
					<span
						class="group/avatar relative transition-[margin,transform] duration-200 ease-out hover:-translate-y-0.5 {i >
						0
							? '-ml-2 group-hover/card:ml-1'
							: ''}"
						style="z-index: {entry.apps.length - i}"
					>
						<img
							src={app.logo}
							alt={app.name}
							class="size-5 rounded-full bg-white p-0.5 ring-2 ring-background transition-transform duration-200 group-hover/avatar:scale-110"
						/>
						<span
							role="tooltip"
							class="pointer-events-none absolute right-0 bottom-full mb-1.5 rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-background opacity-0 transition-opacity duration-150 group-hover/avatar:opacity-100"
						>
							{app.name}
						</span>
					</span>
				{/each}
			</span>
		{/if}
	</button>
{/snippet}

<Dialog.Root bind:open>
	<Dialog.Content class="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-xl">
		<Dialog.Header class="border-b px-5 py-4">
			<Dialog.Title>{mode === 'import' ? 'Import tasks' : 'Export tasks'}</Dialog.Title>
			<Dialog.Description class="sr-only">
				{mode === 'import'
					? 'Bring tasks in from another app, step by step.'
					: 'Send your tasks to another app, step by step.'}
			</Dialog.Description>
			<ol class="mt-3 flex items-center gap-2 text-xs" aria-label="Progress">
				{#each steps as s, i (s.id)}
					<li
						class="flex items-center gap-1.5 {i === stepIndex
							? 'text-foreground'
							: 'text-muted-foreground'}"
						aria-current={i === stepIndex ? 'step' : undefined}
					>
						<span
							class="flex size-5 items-center justify-center rounded-full border text-[10px] font-medium {i <
							stepIndex
								? 'border-primary bg-primary text-primary-foreground'
								: i === stepIndex
									? 'border-foreground'
									: 'border-border'}"
						>
							{#if i < stepIndex}
								<CheckIcon class="size-3" aria-hidden="true" />
							{:else}
								{i + 1}
							{/if}
						</span>
						<span class="hidden sm:inline">{s.label}</span>
					</li>
					{#if i < steps.length - 1}
						<li aria-hidden="true" class="h-px flex-1 bg-border"></li>
					{/if}
				{/each}
			</ol>
		</Dialog.Header>

		<div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
			{#if step === 'format'}
				{#if container}
					<p class="mb-3 text-muted-foreground">
						Which app {mode === 'import' ? 'made' : 'should read'} this {container.card.name} file?
					</p>
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
						{#each container.members as f (f.id)}
							{@render card(f, () => choose(f))}
						{/each}
					</div>
				{:else}
					<p class="mb-3 text-muted-foreground">
						{mode === 'import'
							? 'Where are your tasks coming from?'
							: 'Where are your tasks going?'}
					</p>
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
						{#each entries as entry (entry.kind === 'format' ? entry.format.id : entry.id)}
							{#if entry.kind === 'format'}
								{@render card(entry.format, () => choose(entry.format))}
							{:else}
								{@render card(entry.card, () => (container = entry))}
							{/if}
						{/each}
					</div>
				{/if}
			{:else if step === 'file' && format?.importer}
				<div class="flex flex-col gap-4">
					<div class="flex flex-col gap-1.5 text-muted-foreground">
						{#each format.importer.instructions as line, i (i)}
							<p>{line}</p>
						{/each}
					</div>
					<div
						role="presentation"
						ondragover={(e) => {
							e.preventDefault();
							dragging = true;
						}}
						ondragleave={() => (dragging = false)}
						ondrop={onDrop}
						class="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center transition-colors {dragging
							? 'border-primary bg-muted'
							: ''}"
					>
						<UploadIcon class="size-6 text-muted-foreground" aria-hidden="true" />
						<p class="text-muted-foreground">
							Drop your {format.name} file here, or
						</p>
						<input
							bind:this={fileInput}
							type="file"
							accept={acceptFor(format)}
							class="sr-only"
							aria-label="Choose a file"
							onchange={(e) => loadFile(e.currentTarget.files?.[0])}
						/>
						<Button variant="outline" onclick={() => fileInput?.click()}>Choose a file</Button>
						{#if file}
							<p class="text-xs text-muted-foreground">{file.name}</p>
						{/if}
					</div>
					{#if suggestion}
						<div class="flex flex-wrap items-center gap-2 rounded-md bg-muted p-3">
							<TriangleAlertIcon class="size-4 shrink-0" aria-hidden="true" />
							<span class="flex-1">This looks like a {suggestion.name} file.</span>
							<Button size="sm" variant="outline" onclick={() => switchTo(suggestion!)}>
								Import as {suggestion.name}
							</Button>
						</div>
					{/if}
					{#if error}
						<p role="alert" class="text-destructive">{error}</p>
					{/if}
				</div>
			{:else if step === 'mapping' && format?.importer}
				<div class="flex flex-col gap-4">
					<p class="text-muted-foreground">
						Match the columns in <span class="text-foreground">{file?.name}</span> to kennel fields. Only
						the title is required.
					</p>
					<div class="grid gap-3 sm:grid-cols-2">
						{#each FIELDS as field (field)}
							<label class="grid gap-1 text-sm text-muted-foreground sm:text-xs">
								{FIELD_LABELS[field]}{field === 'title' ? ' (required)' : ''}
								<select
									class={selectClass}
									value={mapping[field] ?? ''}
									onchange={(e) => {
										mapping = { ...mapping, [field]: e.currentTarget.value || undefined };
									}}
								>
									<option value="">{field === 'title' ? 'Choose a column' : 'Skip'}</option>
									{#each columns as column (column)}
										<option value={column}>{column}</option>
									{/each}
								</select>
							</label>
						{/each}
					</div>
					{#if error}
						<p role="alert" class="text-destructive">{error}</p>
					{/if}
				</div>
			{:else if step === 'review' && mode === 'import' && parsed && format}
				<div class="flex flex-col gap-4">
					<div class="grid grid-cols-3 gap-2">
						<div class="rounded-md border p-3">
							<div class="text-2xl font-semibold tabular-nums">{selectedTasks.length}</div>
							<div class="text-xs text-muted-foreground">tasks</div>
						</div>
						<div class="rounded-md border p-3">
							<div class="text-2xl font-semibold tabular-nums">{parsed.data.projects.length}</div>
							<div class="text-xs text-muted-foreground">projects</div>
						</div>
						<div class="rounded-md border p-3">
							<div class="text-2xl font-semibold tabular-nums">{completedCount}</div>
							<div class="text-xs text-muted-foreground">completed</div>
						</div>
					</div>
					{#if completedCount > 0}
						<label class="flex items-center gap-2">
							<input
								type="checkbox"
								bind:checked={includeCompleted}
								class="size-4 accent-primary"
							/>
							Include completed tasks
						</label>
					{/if}
					{#each parsed.warnings as warning, i (i)}
						<div class="flex gap-2 rounded-md bg-muted p-3 text-muted-foreground">
							<TriangleAlertIcon class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
							<span>{warning}</span>
						</div>
					{/each}
					<div class="flex flex-col gap-1">
						<p class="text-xs text-muted-foreground">Preview</p>
						<ul class="divide-y rounded-md border">
							{#each selectedTasks.slice(0, 6) as t, i (i)}
								<li class="flex items-center gap-2 px-3 py-2">
									<span
										class="size-3.5 shrink-0 rounded-sm border {t.status === 'done'
											? 'border-primary bg-primary'
											: ''}"
										aria-hidden="true"
									></span>
									<span class="min-w-0 flex-1 truncate {t.status === 'done' ? 'line-through' : ''}"
										>{t.title}</span
									>
									{#if t.dueAt}
										<span class="shrink-0 text-xs text-muted-foreground"
											>{t.dueAt.slice(0, 10)}</span
										>
									{/if}
								</li>
							{/each}
							{#if selectedTasks.length > 6}
								<li class="px-3 py-2 text-xs text-muted-foreground">
									and {selectedTasks.length - 6} more
								</li>
							{/if}
						</ul>
					</div>
					<p class="text-xs text-muted-foreground">
						Imported tasks are added alongside what's already here. Projects with a matching name
						are reused instead of duplicated.
					</p>
				</div>
			{:else if step === 'review' && mode === 'export' && format?.exporter}
				<div class="flex flex-col gap-4">
					<div class="flex items-center gap-3">
						<span
							class="flex size-9 items-center justify-center rounded-md text-sm font-semibold"
							style={markStyle(format)}
							aria-hidden="true"
						>
							{#if format.logo}
								<img src={format.logo} alt="" class="size-6" />
							{:else}
								{format.mark}
							{/if}
						</span>
						<div>
							<div class="font-medium">{format.name}</div>
							<div class="text-xs text-muted-foreground">{format.extensions.join(', ')}</div>
						</div>
					</div>
					<div class="flex flex-col gap-1.5 text-muted-foreground">
						{#each format.exporter.instructions as line, i (i)}
							<p>{line}</p>
						{/each}
					</div>
					<label class="flex items-center gap-2">
						<input type="checkbox" bind:checked={includeCompleted} class="size-4 accent-primary" />
						Include completed tasks
					</label>
				</div>
			{:else if step === 'progress'}
				<div class="flex flex-col gap-4 py-4">
					<div class="flex items-center gap-2">
						<LoaderCircleIcon class="size-4 animate-spin" aria-hidden="true" />
						<span aria-live="polite">{progress.phase}</span>
					</div>
					<div
						role="progressbar"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={percent}
						class="h-2 overflow-hidden rounded-full bg-muted"
					>
						<div
							class="h-full rounded-full bg-primary transition-[width] duration-300"
							style="width: {mode === 'import' ? percent : 50}%"
						></div>
					</div>
					{#if mode === 'import'}
						<p class="text-xs text-muted-foreground tabular-nums">
							{progress.done} of {progress.total} tasks
						</p>
					{/if}
				</div>
			{:else if step === 'done'}
				<div class="flex flex-col gap-4 py-2">
					{#if error}
						<div class="flex gap-2 text-destructive">
							<TriangleAlertIcon class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
							<div>
								<p>{error}</p>
								{#if result && result.tasks > 0}
									<p class="text-muted-foreground">
										{result.tasks} tasks were imported before the error.
									</p>
								{/if}
							</div>
						</div>
					{:else if mode === 'import' && result}
						<div class="flex items-start gap-3">
							<span
								class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
							>
								<CheckIcon class="size-4" aria-hidden="true" />
							</span>
							<div>
								<p class="font-medium">
									Imported {result.tasks} task{result.tasks === 1 ? '' : 's'}
								</p>
								<p class="text-muted-foreground">
									{#if result.projects > 0}
										{result.projects} new project{result.projects === 1 ? '' : 's'} created.
									{/if}
									{#if result.skipped > 0}
										{result.skipped} completed task{result.skipped === 1 ? '' : 's'} skipped.
									{/if}
								</p>
							</div>
						</div>
					{:else if mode === 'export' && download && format}
						<div class="flex items-start gap-3">
							<span
								class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
							>
								<CheckIcon class="size-4" aria-hidden="true" />
							</span>
							<div class="flex flex-col gap-3">
								<div>
									<p class="font-medium">
										Exported {download.count} task{download.count === 1 ? '' : 's'} for {format.name}
									</p>
									<p class="text-muted-foreground">
										Your download should have started. If not, use the button below.
									</p>
								</div>
								<div class="flex flex-wrap gap-2">
									<Button variant="outline" onclick={triggerDownload}>
										<DownloadIcon aria-hidden="true" />
										{download.filename}
									</Button>
									{#if download.link}
										<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
										<a href={download.link} class={buttonVariants()}>
											<ExternalLinkIcon aria-hidden="true" />
											Open in {format.name}
										</a>
									{/if}
								</div>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<div class="flex items-center justify-between gap-2 border-t px-5 py-3">
			<div>
				{#if step === 'format' && container}
					<Button variant="ghost" onclick={() => (container = null)}>
						<ArrowLeftIcon aria-hidden="true" />
						Back
					</Button>
				{:else if step === 'file' || step === 'mapping' || step === 'review'}
					<Button variant="ghost" onclick={back}>
						<ArrowLeftIcon aria-hidden="true" />
						Back
					</Button>
				{/if}
			</div>
			<div class="flex items-center gap-2">
				{#if step === 'progress'}
					<Button variant="ghost" onclick={cancel}>Cancel</Button>
				{:else if step === 'done'}
					<Button onclick={() => (open = false)}>Done</Button>
				{:else}
					<Dialog.Close class={buttonVariants({ variant: 'ghost' })}>Cancel</Dialog.Close>
					{#if step === 'mapping'}
						<Button onclick={parse} disabled={!mapping.title}>Continue</Button>
					{:else if step === 'review' && mode === 'import'}
						<Button onclick={runImport} disabled={selectedTasks.length === 0}>
							Import {selectedTasks.length} task{selectedTasks.length === 1 ? '' : 's'}
						</Button>
					{:else if step === 'review' && mode === 'export'}
						<Button onclick={runExport}>Export</Button>
					{/if}
				{/if}
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>

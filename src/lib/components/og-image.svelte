<script lang="ts">
	let { title, subtitle }: { title: string; subtitle: string } = $props();
</script>

<div
	style="display:flex;flex-direction:column;justify-content:space-between;width:1200px;height:630px;padding:72px;background:#ffffff;color:#0a0a0a;font-family:Inter"
>
	<div style="display:flex;align-items:center;gap:20px">
		<svg width="56" height="56" viewBox="0 0 64 64">
			<rect width="64" height="64" rx="14" fill="#8b7fb8" />
			<path d="M32 12 L54 30 V52 H10 V30 Z" fill="#fff" />
			<path
				d="M25 40 L30 45 L40 33"
				fill="none"
				stroke="#8b7fb8"
				stroke-width="5"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
		<div style="font-size:36px;font-weight:600">kennel</div>
	</div>
	<div style="display:flex;flex-direction:column;gap:24px">
		<div style="font-size:64px;font-weight:600;line-height:1.1;letter-spacing:-0.02em">{title}</div>
		<div style="font-size:30px;color:#6b6b6b;line-height:1.4">{subtitle}</div>
	</div>
	<div style="font-size:24px;color:#6b6b6b">kennel.work</div>
</div>

<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let loading = $state(false);
</script>

<header>
	<h1>Recherche sémantique</h1>
	<p>{data.count.toLocaleString('fr-FR')} définitions françaises vectorisées</p>
</header>

<main>
	<form
		method="POST"
		action="?/search"
		use:enhance={() => {
			loading = true;
			return async ({ update }) => {
				await update();
				loading = false;
			};
		}}
	>
		<input
			name="query"
			type="text"
			placeholder="un mot ou une idée… ex : « félin domestique »"
			value={form && 'query' in form ? form.query : ''}
			required
			minlength="1"
			autocomplete="off"
		/>
		<button disabled={loading}>{loading ? 'Recherche…' : 'Chercher'}</button>
	</form>

	{#if form && 'error' in form}
		<p class="error">{form.error}</p>
	{/if}

	{#if form && 'results' in form}
		<ul class="results">
			{#each form.results as r, i (i)}
				<li>
					<div class="head">
						<span class="rank">{i + 1}</span>
						<strong>{r.forme}</strong>
						{#if r.pos}<span class="pos">{r.pos}</span>{/if}
						<span class="score">{Math.round(r.similarity * 100)}%</span>
					</div>
					<div class="bar"><span style="width: {Math.round(r.similarity * 100)}%"></span></div>
					<p class="gloss">{r.gloss}</p>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	header {
		padding: 1rem;
		background-color: black;
		color: white;

		p {
			margin: 0.25rem 0 0;
			opacity: 0.7;
			font-size: 0.875rem;
		}
	}

	main {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
		margin: 0 auto;
		width: 100%;
		max-width: 720px;
	}

	form {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.75rem;
		position: sticky;
		top: 1rem;
	}

	input {
		padding: 0.6rem 0.75rem;
		border: 1px solid #ccc;
		border-radius: 0.5rem;
		font-size: 1rem;
	}

	button {
		padding: 0.6rem 1.1rem;
		border: 0;
		border-radius: 0.5rem;
		background: black;
		color: white;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.error {
		color: #c0392b;
		margin: 0;
	}

	ul.results {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;

		li {
			padding: 0.75rem 1rem;
			border: 1px solid #eee;
			border-radius: 0.5rem;
			background: white;
		}
	}

	.head {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;

		.rank {
			color: #aaa;
			font-variant-numeric: tabular-nums;
			min-width: 1.5rem;
		}

		.pos {
			color: #888;
			font-style: italic;
			font-size: 0.85rem;
		}

		.score {
			margin-left: auto;
			font-variant-numeric: tabular-nums;
			color: #555;
		}
	}

	.bar {
		height: 4px;
		background: #eee;
		border-radius: 2px;
		margin: 0.4rem 0;
		overflow: hidden;

		span {
			display: block;
			height: 100%;
			background: #2ecc71;
		}
	}

	.gloss {
		margin: 0.25rem 0 0;
		color: #333;
	}
</style>
